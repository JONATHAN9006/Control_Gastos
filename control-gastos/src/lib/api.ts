/**
 * CAPA DE DATOS
 *  - Modo «sheets»: Google Sheets a través de Google Apps Script (fuente oficial de los datos).
 *  - Modo «local»: solo cuando NO se ha configurado la URL del script. Guarda en el navegador
 *    de este dispositivo y la interfaz lo indica claramente; nunca se presenta como guardado en Sheets.
 * Ninguna operación se da por guardada hasta que el backend responde ok.
 */
import type { DB, Entidad, Meta, Movimiento, Pasivo } from '../types';

const K_DB = 'cgm:db:v1';
const K_URL = 'cgm:gasUrl';
const K_TOKEN = 'cgm:gasToken';
const VACIA: DB = { movimientos: [], pasivos: [], metas: [], config: {} };

const ls = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { localStorage.setItem(k, v); },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } },
};

export function getConexion() {
  return {
    url: (ls.get(K_URL) ?? import.meta.env.VITE_GAS_URL ?? '').trim(),
    token: (ls.get(K_TOKEN) ?? import.meta.env.VITE_GAS_TOKEN ?? '').trim(),
  };
}
export function setConexion(url: string, token: string) {
  try {
    if (url) ls.set(K_URL, url.trim()); else ls.del(K_URL);
    if (token) ls.set(K_TOKEN, token.trim()); else ls.del(K_TOKEN);
  } catch { /* se usará solo durante esta sesión */ }
}

export type Registro = Movimiento | Pasivo | Meta;
export interface Store {
  modo: 'local' | 'sheets';
  cargar(): Promise<DB>;
  guardar(entidad: Entidad, registro: Registro, esNuevo: boolean): Promise<void>;
  eliminar(entidad: Entidad, id: string): Promise<void>;
  guardarConfig(clave: string, valor: string): Promise<void>;
}

export const entidadDe = (m: Movimiento): Entidad => (m.kind === 'ingreso' ? 'ingresos' : m.kind === 'gasto' ? 'gastos' : 'ahorros');

// ───────────────────────── Modo local ─────────────────────────
export function leerLocal(): DB {
  try {
    const raw = ls.get(K_DB);
    if (!raw) return structuredClone(VACIA);
    const d = JSON.parse(raw);
    return { movimientos: d.movimientos ?? [], pasivos: d.pasivos ?? [], metas: d.metas ?? [], config: d.config ?? {} };
  } catch {
    return structuredClone(VACIA);
  }
}
function escribirLocal(db: DB) {
  try {
    ls.set(K_DB, JSON.stringify(db));
  } catch {
    throw new Error('Este navegador no permitió guardar los datos en el dispositivo.');
  }
}
export function aplicar(db: DB, entidad: Entidad, registro: Registro | null, id: string): DB {
  const upsert = <T extends { id: string }>(xs: T[], r: T | null) => {
    const sin = xs.filter((x) => x.id !== id);
    return r ? [...sin, r] : sin;
  };
  if (entidad === 'pasivos') return { ...db, pasivos: upsert(db.pasivos, registro as Pasivo | null) };
  if (entidad === 'metas') return { ...db, metas: upsert(db.metas, registro as Meta | null) };
  return { ...db, movimientos: upsert(db.movimientos, registro as Movimiento | null) };
}

export function storeLocal(): Store {
  return {
    modo: 'local',
    async cargar() { return leerLocal(); },
    async guardar(entidad, registro) { escribirLocal(aplicar(leerLocal(), entidad, registro, registro.id)); },
    async eliminar(entidad, id) { escribirLocal(aplicar(leerLocal(), entidad, null, id)); },
    async guardarConfig(clave, valor) { const db = leerLocal(); escribirLocal({ ...db, config: { ...db.config, [clave]: valor } }); },
  };
}

// ───────────────────────── Modo Google Sheets ─────────────────────────
type Fila = Record<string, unknown>;
const num = (v: unknown) => Number(v) || 0;
const str = (v: unknown) => (v == null ? '' : String(v));

function aMovimiento(kind: Movimiento['kind'], f: Fila): Movimiento {
  return {
    id: str(f.id), kind, fecha: str(f.fecha), anio: num(f.anio), mes: num(f.mes),
    concepto: str(f.concepto), valor: num(f.valor), observaciones: str(f.observaciones),
    categoria: kind === 'ahorro' ? 'Ahorro' : str(f.categoria),
    tipo: kind === 'gasto' ? str(f.clasificacion) : kind === 'ingreso' ? str(f.tipo) : 'Ahorro',
    frecuencia: str(f.frecuencia) || undefined, necesidad: str(f.necesidad) || undefined,
    pasivoId: str(f.pasivoId) || undefined, metaId: str(f.metaId) || undefined,
  };
}
function aFila(entidad: Entidad, r: Registro): Fila {
  if (entidad === 'pasivos' || entidad === 'metas') return { ...r };
  const m = r as Movimiento;
  const base = { id: m.id, fecha: m.fecha, concepto: m.concepto, valor: m.valor, observaciones: m.observaciones ?? '' };
  if (entidad === 'ingresos') return { ...base, categoria: m.categoria, tipo: m.tipo };
  if (entidad === 'gastos') return { ...base, categoria: m.categoria, clasificacion: m.tipo, frecuencia: m.frecuencia ?? 'Único', necesidad: m.necesidad ?? '', pasivoId: m.pasivoId ?? '' };
  return { ...base, metaId: m.metaId ?? '' };
}

export function storeSheets(url: string, token: string): Store {
  async function llamar(init: RequestInit | undefined, qs = ''): Promise<any> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    let res: Response;
    try {
      res = await fetch(url + qs, { ...init, redirect: 'follow', signal: ctrl.signal });
    } catch {
      throw new Error('No se pudo contactar a Google Sheets (revisa tu internet o la URL del script).');
    } finally {
      clearTimeout(t);
    }
    let json: any;
    try { json = await res.json(); } catch { throw new Error('Google Apps Script respondió algo inesperado. Revisa la URL (/exec) y que el acceso sea «Cualquier usuario».'); }
    if (!json || json.ok !== true) throw new Error(json?.error || 'Google Sheets rechazó la operación.');
    return json.data;
  }
  // text/plain evita el preflight CORS que Apps Script no responde.
  const post = (body: object) => llamar({ method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, token }) });
  return {
    modo: 'sheets',
    async cargar() {
      const d = await llamar(undefined, `?action=bootstrap&token=${encodeURIComponent(token)}`);
      return {
        movimientos: [
          ...(d.ingresos as Fila[]).map((f) => aMovimiento('ingreso', f)),
          ...(d.gastos as Fila[]).map((f) => aMovimiento('gasto', f)),
          ...(d.ahorros as Fila[]).map((f) => aMovimiento('ahorro', f)),
        ],
        pasivos: (d.pasivos as Fila[]).map((f) => ({ ...f, anio: num(f.anio), mes: num(f.mes), saldoPendiente: num(f.saldoPendiente), valorCuota: num(f.valorCuota), cuotasPendientes: num(f.cuotasPendientes), tasaInteres: num(f.tasaInteres) }) as Pasivo),
        metas: (d.metas as Fila[]).map((f) => ({ ...f, anio: num(f.anio), mes: num(f.mes), valorObjetivo: num(f.valorObjetivo), aporteMensual: num(f.aporteMensual) }) as Meta),
        config: d.config ?? {},
      };
    },
    async guardar(entidad, registro, esNuevo) { await post({ action: esNuevo ? 'create' : 'update', entity: entidad, data: aFila(entidad, registro) }); },
    async eliminar(entidad, id) { await post({ action: 'delete', entity: entidad, id }); },
    async guardarConfig(clave, valor) { await post({ action: 'setConfig', clave, valor }); },
  };
}

export async function probarConexion(url: string, token: string): Promise<string> {
  let res: Response;
  try { res = await fetch(`${url}?action=ping&token=${encodeURIComponent(token)}`, { redirect: 'follow' }); }
  catch { throw new Error('No se pudo llegar a esa URL.'); }
  let json: any;
  try { json = await res.json(); } catch { throw new Error('La URL no respondió como la aplicación web del script.'); }
  if (!json.ok) throw new Error(json.error || 'El script rechazó la conexión.');
  return json.data?.hoja ?? 'Google Sheets';
}
