import { Loader2 } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { probarConexion, getConexion } from '../lib/api';
import { CATEGORIAS_DEUDA, CATEGORIAS_GASTO, CATEGORIAS_HORMIGA, CATEGORIAS_INGRESO, CATEGORIAS_META, CLASIFICACIONES, DEUDA, FRECUENCIAS, HORMIGA, MESES, NECESIDADES, PALABRAS_HORMIGA, TIPOS_INGRESO } from '../lib/constants';
import { costoMensual, pasivoEstado } from '../lib/finance';
import { cop, hoyISO, partesFecha, uid } from '../lib/format';
import type { DB, EstadoConexion, Kind, Meta, Movimiento, Pasivo } from '../types';
import { Campo, Dinero, Modal } from './ui';

function fechaInicial(anio: number, mes: number) {
  const hoy = hoyISO();
  const p = partesFecha(hoy);
  return p.anio === anio && p.mes === mes ? hoy : `${anio}-${String(mes).padStart(2, '0')}-01`;
}

function Pie({ guardando, onClose, texto, tono }: { guardando: boolean; onClose: () => void; texto: string; tono: 'btn-green' | 'btn-red' }) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
      <button type="submit" disabled={guardando} className={tono}>{guardando && <Loader2 size={16} className="animate-spin" />}{guardando ? 'Guardando…' : texto}</button>
    </div>
  );
}
const ErrorMsg = ({ children }: { children: ReactNode }) => (children ? <p className="mt-3 rounded-lg border border-alert-700 bg-alert-900/50 px-3 py-2 text-xs text-alert-300">{children}</p> : null);

// ───────────────────────── Ingreso / Gasto / Aporte de ahorro ─────────────────────────
export function MovimientoForm({ kind, inicial, anio, mes, db, onGuardar, onClose }: {
  kind: Kind; inicial?: Movimiento; anio: number; mes: number; db: DB;
  onGuardar: (m: Movimiento, esNuevo: boolean) => Promise<boolean>; onClose: () => void;
}) {
  const [f, setF] = useState<Movimiento>(inicial ?? {
    id: uid(), kind, fecha: fechaInicial(anio, mes), anio, mes, concepto: '', valor: 0, observaciones: '',
    categoria: kind === 'ingreso' ? CATEGORIAS_INGRESO[0] : kind === 'gasto' ? CATEGORIAS_GASTO[0] : 'Ahorro',
    tipo: kind === 'ingreso' ? TIPOS_INGRESO[0] : kind === 'gasto' ? 'Necesario' : 'Ahorro',
    frecuencia: kind === 'gasto' ? 'Único' : undefined, necesidad: kind === 'gasto' ? 'Alta' : undefined,
    metaId: kind === 'ahorro' ? db.metas[0]?.id ?? '' : undefined,
  });
  const [tipoManual, setTipoManual] = useState(!!inicial);
  const [err, setErr] = useState('');
  const [guardando, setGuardando] = useState(false);
  const set = (p: Partial<Movimiento>) => setF((x) => ({ ...x, ...p }));

  /** Detección automática: sugiere la clasificación según categoría y descripción (el usuario puede cambiarla). */
  const sugerir = (categoria: string, concepto: string) => {
    if (kind !== 'gasto' || tipoManual) return {};
    const txt = concepto.toLowerCase();
    if (CATEGORIAS_HORMIGA.includes(categoria) || PALABRAS_HORMIGA.some((p) => txt.includes(p))) return { tipo: HORMIGA, necesidad: 'Baja' };
    if (CATEGORIAS_DEUDA.includes(categoria)) return { tipo: DEUDA, necesidad: 'Alta' };
    return f.tipo === HORMIGA || f.tipo === DEUDA ? { tipo: 'Necesario', necesidad: 'Alta' } : {};
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) return setErr('Selecciona una fecha válida.');
    if (!f.concepto.trim()) return setErr(kind === 'gasto' ? 'Describe el gasto.' : 'Escribe el concepto.');
    if (!(f.valor > 0)) return setErr('El valor debe ser mayor que cero.');
    const p = partesFecha(f.fecha);
    setErr(''); setGuardando(true);
    const ok = await onGuardar({ ...f, concepto: f.concepto.trim(), anio: p.anio, mes: p.mes, pasivoId: f.tipo === DEUDA ? f.pasivoId || undefined : undefined }, !inicial);
    setGuardando(false);
    if (ok) onClose(); else setErr('No se pudo guardar. El registro no quedó almacenado; intenta de nuevo.');
  };

  const p = partesFecha(f.fecha);
  const otroMes = p.anio !== anio || p.mes !== mes;
  const titulo = `${inicial ? 'Editar' : 'Agregar'} ${kind === 'ingreso' ? 'ingreso' : kind === 'gasto' ? 'gasto' : 'aporte de ahorro'}`;
  const recurrente = kind === 'gasto' && f.frecuencia && f.frecuencia !== 'Único' && f.frecuencia !== 'Mensual' && f.valor > 0;
  const activos = db.pasivos.filter((x) => pasivoEstado(db, x).activo || x.id === f.pasivoId);

  return (
    <Modal titulo={titulo} tono={kind === 'ingreso' ? 'verde' : kind === 'gasto' ? 'rojo' : 'oro'} onClose={onClose}>
      <form onSubmit={enviar}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Fecha"><input type="date" className="inp" value={f.fecha} onChange={(e) => set({ fecha: e.target.value })} required /></Campo>
          <Campo label={kind === 'ingreso' ? 'Valor recibido' : kind === 'gasto' ? 'Valor' : 'Valor del aporte'}><Dinero value={f.valor} onChange={(valor) => set({ valor })} autoFocus /></Campo>
          <Campo label={kind === 'gasto' ? 'Descripción del gasto' : 'Concepto o descripción'} ancho>
            <input className="inp" maxLength={80} value={f.concepto} placeholder={kind === 'ingreso' ? 'Ej.: Salario' : kind === 'gasto' ? 'Ej.: Café (cafetería)' : 'Ej.: Aporte mensual'}
              onChange={(e) => set({ concepto: e.target.value, ...sugerir(f.categoria, e.target.value) })} />
          </Campo>
          {kind === 'ahorro' ? (
            <Campo label="Meta de ahorro" ancho>
              <select className="inp" value={f.metaId ?? ''} onChange={(e) => set({ metaId: e.target.value })}>
                <option value="">Ahorro general (sin meta)</option>
                {db.metas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </Campo>
          ) : (
            <>
              <Campo label="Categoría">
                <select className="inp" value={f.categoria} onChange={(e) => set({ categoria: e.target.value, ...sugerir(e.target.value, f.concepto) })}>
                  {(kind === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO).map((c) => <option key={c}>{c}</option>)}
                </select>
              </Campo>
              <Campo label={kind === 'ingreso' ? 'Tipo de ingreso' : 'Tipo de gasto'}>
                <select className="inp" value={f.tipo} onChange={(e) => { setTipoManual(true); set({ tipo: e.target.value }); }}>
                  {(kind === 'ingreso' ? TIPOS_INGRESO : CLASIFICACIONES).map((c) => <option key={c}>{c}</option>)}
                </select>
              </Campo>
            </>
          )}
          {kind === 'gasto' && (
            <>
              <Campo label="Frecuencia"><select className="inp" value={f.frecuencia} onChange={(e) => set({ frecuencia: e.target.value })}>{FRECUENCIAS.map((c) => <option key={c}>{c}</option>)}</select></Campo>
              <Campo label="Nivel de necesidad"><select className="inp" value={f.necesidad} onChange={(e) => set({ necesidad: e.target.value })}>{NECESIDADES.map((c) => <option key={c}>{c}</option>)}</select></Campo>
              {f.tipo === DEUDA && (
                <Campo label="Obligación a la que abonas" ancho>
                  <select className="inp" value={f.pasivoId ?? ''} onChange={(e) => set({ pasivoId: e.target.value })}>
                    <option value="">Sin vincular</option>
                    {activos.map((x) => <option key={x.id} value={x.id}>{x.nombre} · cuota {cop(x.valorCuota)}</option>)}
                  </select>
                  <span className="mt-1 block text-[11px] text-slate-400">Se cuenta una sola vez como pago de pasivo; no se suma además como egreso de consumo.</span>
                </Campo>
              )}
            </>
          )}
          <Campo label="Observaciones" ancho><textarea className="inp" rows={2} maxLength={300} value={f.observaciones ?? ''} onChange={(e) => set({ observaciones: e.target.value })} /></Campo>
        </div>
        {recurrente && (
          <p className="mt-3 rounded-lg border border-gold-800 bg-gold-900/60 px-3 py-2 text-xs text-gold-300">
            Proyección: con frecuencia {f.frecuencia!.toLowerCase()} este gasto representa cerca de <b>{cop(costoMensual(f.valor, f.frecuencia!))} al mes</b>. Solo se registrará este movimiento de {cop(f.valor)}; la proyección no se suma a tus gastos.
          </p>
        )}
        {kind === 'ahorro' && <p className="mt-3 text-[11px] text-slate-400">El aporte queda como dinero reservado: se descuenta del saldo disponible, pero no cuenta como gasto.</p>}
        {otroMes && <p className="mt-3 text-[11px] text-turq-300">Por su fecha, este movimiento quedará en {MESES[p.mes - 1]} {p.anio}.</p>}
        <ErrorMsg>{err}</ErrorMsg>
        <Pie guardando={guardando} onClose={onClose} texto="Guardar" tono={kind === 'gasto' ? 'btn-red' : 'btn-green'} />
      </form>
    </Modal>
  );
}

// ───────────────────────── Obligación (pasivo) ─────────────────────────
export function PasivoForm({ inicial, onGuardar, onClose }: { inicial?: Pasivo; onGuardar: (p: Pasivo, esNuevo: boolean) => Promise<boolean>; onClose: () => void }) {
  const hoy = hoyISO();
  const [f, setF] = useState<Pasivo>(inicial ?? { id: uid(), fecha: hoy, ...partesFecha(hoy), nombre: '', saldoPendiente: 0, valorCuota: 0, fechaVencimiento: '', cuotasPendientes: 0, tasaInteres: 0, observaciones: '' });
  const [err, setErr] = useState('');
  const [guardando, setGuardando] = useState(false);
  const set = (p: Partial<Pasivo>) => setF((x) => ({ ...x, ...p }));
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.nombre.trim()) return setErr('Escribe el nombre de la obligación.');
    if (!(f.saldoPendiente > 0)) return setErr('El saldo pendiente debe ser mayor que cero.');
    if (!(f.valorCuota > 0)) return setErr('Indica el valor de la cuota.');
    setErr(''); setGuardando(true);
    const p = partesFecha(f.fecha);
    const ok = await onGuardar({ id: f.id, fecha: f.fecha, anio: p.anio, mes: p.mes, nombre: f.nombre.trim(), saldoPendiente: f.saldoPendiente, valorCuota: f.valorCuota, fechaVencimiento: f.fechaVencimiento, cuotasPendientes: f.cuotasPendientes, tasaInteres: f.tasaInteres, observaciones: f.observaciones ?? '' }, !inicial);
    setGuardando(false);
    if (ok) onClose(); else setErr('No se pudo guardar la obligación.');
  };
  return (
    <Modal titulo={`${inicial ? 'Editar' : 'Agregar'} obligación`} tono="rojo" onClose={onClose}>
      <form onSubmit={enviar}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Nombre de la obligación" ancho><input className="inp" maxLength={60} value={f.nombre} placeholder="Ej.: Crédito de libre inversión" onChange={(e) => set({ nombre: e.target.value })} autoFocus /></Campo>
          <Campo label="Saldo pendiente"><Dinero value={f.saldoPendiente} onChange={(v) => set({ saldoPendiente: v })} /></Campo>
          <Campo label="Valor de la cuota"><Dinero value={f.valorCuota} onChange={(v) => set({ valorCuota: v })} /></Campo>
          <Campo label="Saldo registrado el"><input type="date" className="inp" value={f.fecha} onChange={(e) => set({ fecha: e.target.value })} required /></Campo>
          <Campo label="Próximo vencimiento"><input type="date" className="inp" value={f.fechaVencimiento} onChange={(e) => set({ fechaVencimiento: e.target.value })} /></Campo>
          <Campo label="Cuotas pendientes (0 = rotativo)"><input type="number" min={0} max={600} className="inp" value={f.cuotasPendientes || ''} onChange={(e) => set({ cuotasPendientes: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} /></Campo>
          <Campo label="Interés mensual % (si aplica)"><input type="number" min={0} max={100} step="0.01" className="inp" value={f.tasaInteres || ''} onChange={(e) => set({ tasaInteres: Math.max(0, Number(e.target.value) || 0) })} /></Campo>
          <Campo label="Observaciones" ancho><textarea className="inp" rows={2} maxLength={300} value={f.observaciones ?? ''} onChange={(e) => set({ observaciones: e.target.value })} /></Campo>
        </div>
        <p className="mt-3 text-[11px] text-slate-400">Registrar la obligación no descuenta dinero. El saldo del mes solo baja cuando registras un gasto «Pago de deuda» vinculado a ella.</p>
        <ErrorMsg>{err}</ErrorMsg>
        <Pie guardando={guardando} onClose={onClose} texto="Guardar" tono="btn-red" />
      </form>
    </Modal>
  );
}

// ───────────────────────── Meta de ahorro ─────────────────────────
export function MetaForm({ inicial, sugerido, onGuardar, onClose }: { inicial?: Meta; sugerido: number; onGuardar: (m: Meta, esNuevo: boolean) => Promise<boolean>; onClose: () => void }) {
  const hoy = hoyISO();
  const [f, setF] = useState<Meta>(inicial ?? { id: uid(), fecha: hoy, ...partesFecha(hoy), nombre: '', categoria: CATEGORIAS_META[0], valorObjetivo: 0, fechaCumplimiento: '', aporteMensual: 0, descripcion: '' });
  const [err, setErr] = useState('');
  const [guardando, setGuardando] = useState(false);
  const set = (p: Partial<Meta>) => setF((x) => ({ ...x, ...p }));
  let meses = 0;
  if (f.fechaCumplimiento) { const a = partesFecha(f.fechaCumplimiento), b = partesFecha(hoy); meses = Math.max(1, (a.anio - b.anio) * 12 + (a.mes - b.mes) + 1); }
  const necesario = meses && f.valorObjetivo ? Math.ceil(f.valorObjetivo / meses) : 0;
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.nombre.trim()) return setErr('Ponle un nombre a la meta.');
    if (!(f.valorObjetivo > 0)) return setErr('El valor objetivo debe ser mayor que cero.');
    setErr(''); setGuardando(true);
    const p = partesFecha(f.fecha);
    const ok = await onGuardar({ id: f.id, fecha: f.fecha, anio: p.anio, mes: p.mes, nombre: f.nombre.trim(), categoria: f.categoria, valorObjetivo: f.valorObjetivo, fechaCumplimiento: f.fechaCumplimiento, aporteMensual: f.aporteMensual, descripcion: f.descripcion ?? '' }, !inicial);
    setGuardando(false);
    if (ok) onClose(); else setErr('No se pudo guardar la meta.');
  };
  return (
    <Modal titulo={`${inicial ? 'Editar' : 'Nueva'} meta de ahorro`} tono="verde" onClose={onClose}>
      <form onSubmit={enviar}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Meta de ahorro"><input className="inp" maxLength={60} value={f.nombre} placeholder="Ej.: Fondo de emergencias" onChange={(e) => set({ nombre: e.target.value })} autoFocus /></Campo>
          <Campo label="Tipo de objetivo"><select className="inp" value={f.categoria} onChange={(e) => set({ categoria: e.target.value })}>{CATEGORIAS_META.map((c) => <option key={c}>{c}</option>)}</select></Campo>
          <Campo label="Valor objetivo"><Dinero value={f.valorObjetivo} onChange={(v) => set({ valorObjetivo: v })} /></Campo>
          <Campo label="Fecha de cumplimiento"><input type="date" className="inp" value={f.fechaCumplimiento} onChange={(e) => set({ fechaCumplimiento: e.target.value })} /></Campo>
          <Campo label="Aporte mensual" ancho><Dinero value={f.aporteMensual} onChange={(v) => set({ aporteMensual: v })} /></Campo>
          <Campo label="Descripción de la meta" ancho><textarea className="inp" rows={2} maxLength={300} value={f.descripcion ?? ''} onChange={(e) => set({ descripcion: e.target.value })} /></Campo>
        </div>
        {(necesario > 0 || sugerido > 0) && (
          <div className="mt-3 space-y-1 rounded-lg border border-tech-800 bg-tech-900/40 px-3 py-2 text-xs text-slate-200">
            {necesario > 0 && <p>Para llegar a tiempo necesitas aportar <b className="text-tech-300">{cop(necesario)}</b> al mes durante {meses} {meses === 1 ? 'mes' : 'meses'}. <button type="button" className="underline text-turq-300" onClick={() => set({ aporteMensual: necesario })}>Usar este valor</button></p>}
            {sugerido > 0 && <p>Tu capacidad de ahorro de este mes, después de gastos y cuotas, es de <b className="text-tech-300">{cop(sugerido)}</b>.{necesario > sugerido ? ' El aporte necesario la supera: amplía la fecha o reduce gastos opcionales.' : ''}</p>}
          </div>
        )}
        <ErrorMsg>{err}</ErrorMsg>
        <Pie guardando={guardando} onClose={onClose} texto="Guardar meta" tono="btn-green" />
      </form>
    </Modal>
  );
}

// ───────────────────────── Conexión con Google Sheets ─────────────────────────
export function ConexionModal({ estado, error, umbral, onConectar, onUmbral, onReintentar, onClose }: {
  estado: EstadoConexion; error: string; umbral: number;
  onConectar: (url: string, token: string) => void; onUmbral: (v: number) => void; onReintentar: () => void; onClose: () => void;
}) {
  const c = getConexion();
  const [url, setUrl] = useState(c.url);
  const [token, setToken] = useState(c.token);
  const [prueba, setPrueba] = useState<{ ok: boolean; texto: string } | null>(null);
  const [probando, setProbando] = useState(false);
  const [u, setU] = useState(umbral);
  const valida = /^https:\/\/script\.google\.com\/.+\/exec$/.test(url.trim());
  const probar = async () => {
    setProbando(true); setPrueba(null);
    try { const hoja = await probarConexion(url.trim(), token.trim()); setPrueba({ ok: true, texto: `Conexión correcta con «${hoja}».` }); }
    catch (e) { setPrueba({ ok: false, texto: (e as Error).message }); }
    setProbando(false);
  };
  return (
    <Modal titulo="Conexión con Google Sheets" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className={`rounded-lg border px-3 py-2 text-xs ${estado === 'conectado' ? 'border-tech-600 text-tech-300' : estado === 'error' ? 'border-alert-500 text-alert-300' : 'border-gold-500/70 text-gold-300'}`}>
          {estado === 'conectado' && 'Conectado: cada registro se guarda en tu hoja de cálculo.'}
          {estado === 'conectando' && 'Conectando con Google Sheets…'}
          {estado === 'error' && `Sin conexión con Google Sheets. ${error} Mientras tanto no se guarda ningún registro.`}
          {estado === 'local' && 'Modo local: aún no hay una hoja de Google conectada. Los registros se guardan únicamente en el navegador de este dispositivo y NO llegan a Google Sheets.'}
        </p>
        <Campo label="URL de la aplicación web de Apps Script (termina en /exec)"><input className="inp" value={url} placeholder="https://script.google.com/macros/s/…/exec" onChange={(e) => { setUrl(e.target.value); setPrueba(null); }} /></Campo>
        <Campo label="Clave de acceso (opcional, propiedad API_TOKEN del script)"><input className="inp" type="password" value={token} onChange={(e) => setToken(e.target.value)} /></Campo>
        {url && !valida && <p className="text-xs text-alert-300">La URL debe empezar por https://script.google.com/ y terminar en /exec.</p>}
        {prueba && <p className={`text-xs ${prueba.ok ? 'text-tech-300' : 'text-alert-300'}`}>{prueba.texto}</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" disabled={!valida || probando} onClick={probar}>{probando && <Loader2 size={16} className="animate-spin" />}Probar conexión</button>
          <button className="btn-green" disabled={!valida} onClick={() => { onConectar(url, token); onClose(); }}>Guardar y conectar</button>
          {estado === 'error' && <button className="btn-ghost" onClick={() => { onReintentar(); onClose(); }}>Reintentar</button>}
          {c.url && <button className="btn-ghost" onClick={() => { onConectar('', ''); onClose(); }}>Desconectar (modo local)</button>}
        </div>
        <div className="border-t border-navy-600 pt-3">
          <Campo label={`Alerta amarilla: gastos desde el ${u}% de los ingresos del mes`}>
            <input type="range" min={50} max={100} step={5} value={u} onChange={(e) => setU(Number(e.target.value))} onMouseUp={() => onUmbral(u)} onTouchEnd={() => onUmbral(u)} onKeyUp={() => onUmbral(u)} className="w-full accent-yellow-400" />
          </Campo>
          <p className="text-[11px] text-slate-400">Define cuándo un mes pasa de verde a amarillo. Rojo siempre significa saldo negativo.</p>
        </div>
      </div>
    </Modal>
  );
}
