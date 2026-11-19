import { AlertTriangle, ArrowDownUp, Bug, Check, CheckCircle2, CircleCheck, CircleX, Info, Lightbulb, Pencil, PiggyBank, Plus, RotateCcw, Search, Target, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CATEGORIAS_GASTO, CLASIFICACIONES, DEUDA, FRECUENCIAS, HORMIGA, MESES } from '../lib/constants';
import { capacidadAhorro, esDiscrecional, evaluarGasto, hormiga, mesAnterior, movsMes, porCategoria, presupuesto, resumenMes, type Nivel } from '../lib/finance';
import { cop, fechaCorta, pct } from '../lib/format';
import type { DB, Kind, Movimiento } from '../types';
import { Dinero, Titulo, Vacio } from './ui';

export interface TabProps { db: DB; anio: number; mes: number; abrirMov: (kind: Kind, inicial?: Movimiento) => void; eliminarMov: (m: Movimiento) => Promise<boolean> }

const TIPO_BADGE: Record<Kind, string> = { ingreso: 'bg-tech-500 text-navy-950', gasto: 'bg-alert-300 text-alert-900', ahorro: 'bg-gold-400 text-navy-950' };
const TIPO_TXT: Record<Kind, string> = { ingreso: 'Ingreso', gasto: 'Gasto', ahorro: 'Ahorro' };

export function PresupuestoRestante({ db, anio, mes }: { db: DB; anio: number; mes: number }) {
  const p = presupuesto(db, anio, mes);
  const color = p.restante < 0 ? 'text-alert-300 border-alert-700' : 'text-tech-300 border-tech-800';
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-lg border bg-navy-900/60 px-3 py-1.5 text-xs ${color}`} title="Saldo del mes − cuotas de obligaciones por pagar − ahorro programado por aportar">
      <span className="font-semibold text-slate-200">Presupuesto restante</span>
      <span className="text-[11px] text-slate-400">Saldo {cop(p.saldo)} − cuotas {cop(p.obligaciones)} − ahorro {cop(p.ahorroPendiente)}</span>
      <span className="text-sm font-bold">{cop(p.restante)}</span>
    </div>
  );
}

export function MovimientosTab(props: TabProps) {
  const { db, anio, mes, abrirMov, eliminarMov } = props;
  const [q, setQ] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [fCat, setFCat] = useState('');
  const [asc, setAsc] = useState(true);
  const [porBorrar, setPorBorrar] = useState('');
  const [verTotales, setVerTotales] = useState(false);
  const todos = useMemo(() => movsMes(db, anio, mes), [db, anio, mes]);
  const categorias = useMemo(() => [...new Set(todos.map((m) => m.categoria))].sort(), [todos]);
  const lista = useMemo(() => todos
    .filter((m) => (!fTipo || m.kind === fTipo) && (!fCat || m.categoria === fCat) && (!q || m.concepto.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (a.fecha === b.fecha ? 0 : a.fecha < b.fecha ? -1 : 1) * (asc ? 1 : -1)), [todos, q, fTipo, fCat, asc]);
  const totales = useMemo(() => porCategoria(lista.filter((m) => m.kind !== 'ahorro')), [lista]);
  const filtrando = !!(q || fTipo || fCat);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <button className="btn border-2 border-tech-500 bg-tech-900/40 py-2 text-[15px] text-white hover:bg-tech-800/70" onClick={() => abrirMov('ingreso')}><Plus size={20} className="text-tech-400" />Agregar Ingreso</button>
        <button className="btn border-2 border-alert-500 bg-alert-900/40 py-2 text-[15px] text-white hover:bg-alert-700/50" onClick={() => abrirMov('gasto')}><Plus size={20} className="text-alert-400" />Agregar Gasto</button>
      </div>
      <PresupuestoRestante db={db} anio={anio} mes={mes} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[120px] flex-1">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input aria-label="Buscar por concepto" className="inp py-1.5 pl-7 text-xs" placeholder="Buscar concepto…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select aria-label="Filtrar por tipo" className="inp w-auto py-1.5 text-xs" value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
          <option value="">Tipo: todos</option><option value="ingreso">Ingresos</option><option value="gasto">Gastos</option><option value="ahorro">Ahorro</option>
        </select>
        <select aria-label="Filtrar por categoría" className="inp w-auto max-w-[140px] py-1.5 text-xs" value={fCat} onChange={(e) => setFCat(e.target.value)}>
          <option value="">Categoría: todas</option>{categorias.map((c) => <option key={c}>{c}</option>)}
        </select>
        {filtrando && <button className="rounded-md p-1.5 text-slate-300 hover:bg-navy-700" title="Quitar filtros" onClick={() => { setQ(''); setFTipo(''); setFCat(''); }}><X size={14} /></button>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-navy-600">
        <table className="mov-table w-full text-[13px]">
          <thead className="bg-navy-800 text-slate-100">
            <tr>
              <th className="px-1.5 py-1.5 text-left font-semibold"><button className="inline-flex items-center gap-1" onClick={() => setAsc(!asc)} title="Ordenar por fecha">Fecha<ArrowDownUp size={12} className="text-turq-300" /></button></th>
              <th className="px-1.5 py-1.5 text-left font-semibold">Concepto</th>
              <th className="mov-tipo px-1.5 py-1.5 text-center font-semibold">Tipo</th>
              <th className="px-1.5 py-1.5 text-left font-semibold">Categoría</th>
              <th className="px-1.5 py-1.5 text-right font-semibold">Valor</th>
              <th className="px-1.5 py-1.5 text-center font-semibold">Acción</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((m) => {
              const esHormiga = m.kind === 'gasto' && m.tipo === HORMIGA;
              return (
                <tr key={m.id} className="border-t border-navy-700 hover:bg-navy-800/60">
                  <td className="whitespace-nowrap px-1.5 py-1.5 text-slate-100">{fechaCorta(m.fecha)}</td>
                  <td className="mov-concepto max-w-[130px] truncate px-1.5 py-1.5 text-white" title={m.observaciones || m.concepto}>{m.concepto}</td>
                  <td className="mov-tipo px-1.5 py-1.5 text-center"><span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${TIPO_BADGE[m.kind]}`}>{TIPO_TXT[m.kind]}</span></td>
                  <td className="px-1.5 py-1.5">
                    <span title={m.kind === 'gasto' ? m.tipo : undefined} className={`mov-cat inline-flex max-w-[128px] items-center gap-1 overflow-hidden whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${esHormiga ? 'bg-gold-500/80 text-navy-950' : m.kind === 'ahorro' ? 'bg-turq-700 text-white' : 'bg-sky2-500/70 text-white'}`}>
                      {esHormiga && <Bug size={11} className="shrink-0" />}<span className="truncate">{esHormiga ? `Hormiga · ${m.categoria}` : m.tipo === DEUDA ? `Deuda · ${m.categoria}` : m.categoria}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-1.5 py-1.5 text-right font-medium text-white">{cop(m.valor)}</td>
                  <td className="whitespace-nowrap px-1.5 py-1.5 text-center">
                    {porBorrar === m.id ? (
                      <span className="inline-flex items-center gap-1">
                        <button className="rounded bg-alert-500 p-1 text-white" title="Confirmar eliminación" onClick={async () => { await eliminarMov(m); setPorBorrar(''); }}><Check size={13} /></button>
                        <button className="rounded bg-navy-600 p-1 text-white" title="Cancelar" onClick={() => setPorBorrar('')}><X size={13} /></button>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <button className="text-turq-300 hover:text-white" title="Editar" aria-label={`Editar ${m.concepto}`} onClick={() => abrirMov(m.kind, m)}><Pencil size={15} /></button>
                        <button className="text-alert-400 hover:text-alert-300" title="Eliminar" aria-label={`Eliminar ${m.concepto}`} onClick={() => setPorBorrar(m.id)}><Trash2 size={15} /></button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {lista.length === 0 && <div className="p-3"><Vacio>{todos.length === 0 ? `Aún no hay movimientos en ${MESES[mes - 1]} ${anio}. Empieza con «Agregar Ingreso» o «Agregar Gasto».` : 'Ningún movimiento coincide con los filtros.'}</Vacio></div>}
      </div>

      {lista.length > 0 && (
        <div>
          <button className="text-xs font-medium text-turq-300 hover:underline" onClick={() => setVerTotales(!verTotales)}>{verTotales ? 'Ocultar' : 'Ver'} total por categoría{filtrando ? ' (filtrado)' : ''}</button>
          {verTotales && (
            <ul className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
              {totales.map((c) => <li key={c.categoria} className="flex justify-between border-b border-navy-700/70 py-0.5"><span className="text-slate-200">{c.categoria} <span className="text-slate-500">×{c.n}</span></span><span className="font-semibold text-white">{cop(c.total)}</span></li>)}
            </ul>
          )}
        </div>
      )}

      <Evaluador db={db} anio={anio} mes={mes} />
      <AhorroSugerido db={db} anio={anio} mes={mes} />
      <TipDelMes db={db} anio={anio} mes={mes} />
    </div>
  );
}

// ───────────────────────── ¿Debo realizar este gasto? ─────────────────────────
const NIVEL: Record<Nivel, { caja: string; icono: JSX.Element; txt: string }> = {
  verde: { caja: 'border-tech-500 bg-tech-900/50', icono: <CheckCircle2 size={20} className="text-tech-400" />, txt: 'text-tech-300' },
  amarillo: { caja: 'border-gold-500 bg-gold-900/60', icono: <AlertTriangle size={20} className="fill-gold-400 text-navy-950" />, txt: 'text-gold-300' },
  rojo: { caja: 'border-alert-500 bg-alert-900/60', icono: <CircleX size={20} className="text-alert-400" />, txt: 'text-alert-300' },
  'sin-datos': { caja: 'border-sky2-500/60 bg-sky2-900/40', icono: <Info size={20} className="text-sky2-400" />, txt: 'text-sky2-400' },
};

export function Evaluador({ db, anio, mes }: { db: DB; anio: number; mes: number }) {
  const [valor, setValor] = useState(0);
  const [frecuencia, setFrecuencia] = useState('Semanal');
  const [tipo, setTipo] = useState('Opcional');
  const [categoria, setCategoria] = useState('Café');
  const [manual, setManual] = useState<{ ingresos?: number; obligaciones?: number; presupuesto?: number }>({});
  const [verDatos, setVerDatos] = useState(false);

  const r = resumenMes(db, anio, mes);
  const p = presupuesto(db, anio, mes);
  const prev = mesAnterior(anio, mes);
  const disc = (a: number, m: number) => movsMes(db, a, m).filter(esDiscrecional).reduce((s, x) => s + x.valor, 0);
  const entrada = {
    valor, frecuencia, tipo, categoria,
    ingresos: manual.ingresos ?? r.ingresos,
    obligaciones: manual.obligaciones ?? p.obligaciones,
    presupuesto: manual.presupuesto ?? p.saldo,
    reservaAhorro: p.ahorroPendiente,
    discrecionalMes: disc(anio, mes), discrecionalAnterior: disc(prev.anio, prev.mes),
  };
  const ev = evaluarGasto(entrada);
  const n = NIVEL[ev.nivel];
  const hayManual = Object.keys(manual).length > 0;
  const fila = 'grid grid-cols-[92px_1fr] items-center gap-2 text-[13px] text-slate-100';

  return (
    <section className="panel-box">
      <Titulo icono={<Target size={22} />}>¿Debo realizar este gasto?</Titulo>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.05fr]">
        <div className="space-y-2">
          <label className={fila}><span>Valor del gasto</span><Dinero value={valor} onChange={setValor} className="inp py-1.5" placeholder="60.000" /></label>
          <label className={fila}><span>Frecuencia</span><select className="inp py-1.5" value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)}>{FRECUENCIAS.map((f) => <option key={f}>{f}</option>)}</select></label>
          <label className={fila}><span>Tipo</span><select className="inp py-1.5" value={tipo} onChange={(e) => setTipo(e.target.value)}>{CLASIFICACIONES.map((f) => <option key={f}>{f}</option>)}</select></label>
          <label className={fila}><span>Categoría</span><select className="inp py-1.5" value={categoria} onChange={(e) => setCategoria(e.target.value)}>{CATEGORIAS_GASTO.map((f) => <option key={f}>{f}</option>)}</select></label>
        </div>
        <div className={`rounded-lg border-2 p-2.5 ${n.caja}`} aria-live="polite">
          <div className="flex items-center gap-2">{n.icono}<span className={`text-sm font-bold ${n.txt}`}>Recomendación:</span></div>
          <div className={`text-center text-base font-extrabold ${n.txt}`}>{ev.titulo}</div>
          <p className="mt-1 text-xs leading-snug text-slate-100">{ev.mensaje}</p>
        </div>
      </div>
      {ev.nivel !== 'sin-datos' && (
        <div className="mt-2.5 grid grid-cols-3 gap-2 text-center text-[11px]">
          <div className="rounded-md bg-navy-900/70 px-1 py-1.5"><div className="text-slate-400">Sobre tus ingresos</div><div className="text-sm font-bold text-white">{pct(ev.pctIngresos ?? 0, 1)}</div></div>
          <div className="rounded-md bg-navy-900/70 px-1 py-1.5"><div className="text-slate-400">Presupuesto después</div><div className={`text-sm font-bold ${ev.restanteDespues < 0 ? 'text-alert-300' : 'text-white'}`}>{cop(ev.restanteDespues)}</div></div>
          <div className="rounded-md bg-navy-900/70 px-1 py-1.5"><div className="text-slate-400">Sobre tu ahorro</div><div className={`text-sm font-bold ${ev.ahorroComprometido > 0 ? 'text-gold-300' : 'text-white'}`}>{ev.ahorroComprometido > 0 ? `−${cop(ev.ahorroComprometido).slice(2)}` : 'No lo afecta'}</div></div>
        </div>
      )}
      <div className="mt-2 flex items-center gap-3 text-[11px]">
        <button className="text-turq-300 hover:underline" onClick={() => setVerDatos(!verDatos)}>{verDatos ? 'Ocultar' : 'Ver'} datos usados{hayManual ? ' (ajustados)' : ''}</button>
        {hayManual && <button className="inline-flex items-center gap-1 text-slate-300 hover:underline" onClick={() => setManual({})}><RotateCcw size={11} />Volver a mis datos reales</button>}
      </div>
      {verDatos && (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {([['ingresos', 'Ingresos mensuales'], ['obligaciones', 'Obligaciones pendientes'], ['presupuesto', 'Presupuesto disponible']] as const).map(([k, label]) => (
            <label key={k} className="text-[11px] text-slate-300">{label}
              <Dinero value={Math.max(0, entrada[k])} onChange={(v) => setManual((m) => ({ ...m, [k]: v }))} className="inp mt-0.5 py-1 text-xs" />
            </label>
          ))}
          <p className="text-[11px] text-slate-400 sm:col-span-3">Se llenan con lo registrado en {MESES[mes - 1]}: ingresos del mes, cuotas por pagar y saldo aún disponible. Ahorro programado por aportar: {cop(p.ahorroPendiente)}. Puedes ajustarlos para simular.</p>
        </div>
      )}
    </section>
  );
}

// ───────────────────────── Ahorro sugerido ─────────────────────────
export function AhorroSugerido({ db, anio, mes }: { db: DB; anio: number; mes: number }) {
  const c = capacidadAhorro(db, anio, mes);
  const rango = c.minimo > 0 && c.minimo < c.capacidad;
  const p = (v: number) => (c.ingresos > 0 ? pct((v / c.ingresos) * 100) : '—');
  const Linea = ({ ok, si, no }: { ok: boolean; si: string; no: string }) => (
    <li className="flex items-center gap-2">{ok ? <CircleCheck size={20} className="shrink-0 fill-tech-500 text-navy-900" /> : <AlertTriangle size={18} className="shrink-0 text-gold-400" />}<span>{ok ? si : no}</span></li>
  );
  return (
    <section className="panel-box">
      <Titulo icono={<PiggyBank size={24} />} extra={<span title="Ingresos − gastos registrados − cuotas de obligaciones por pagar. El mínimo es el aporte mensual de tus metas."><Info size={18} className="text-slate-300" /></span>}>
        Ahorro sugerido para {MESES[mes - 1]}
      </Titulo>
      {c.ingresos <= 0 ? <Vacio>Registra los ingresos de {MESES[mes - 1]} para calcular cuánto puedes ahorrar sin afectar tus obligaciones.</Vacio> : (
        <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1.15fr_1fr]">
          <div className={`rounded-xl border-2 px-3 py-2 text-center ${c.capacidad > 0 ? 'border-tech-500 bg-gradient-to-b from-tech-800 to-tech-900' : 'border-alert-500 bg-alert-900/60'}`}>
            <div className="text-sm font-bold text-white">{c.capacidad > 0 ? 'Puedes ahorrar:' : 'Este mes no hay margen'}</div>
            <div className="text-lg font-extrabold text-white">{c.capacidad > 0 ? (rango ? `${cop(c.minimo)} – ${cop(c.capacidad)}` : `hasta ${cop(c.capacidad)}`) : cop(0)}</div>
            {c.capacidad > 0 && <div className="text-xs text-slate-100">({rango ? `${p(c.minimo)} – ${p(c.capacidad)}` : p(c.capacidad)} de tus ingresos)</div>}
            {c.ahorrado > 0 && <div className="mt-0.5 text-[11px] text-tech-300">Ya reservaste {cop(c.ahorrado)}</div>}
          </div>
          <ul className="space-y-1.5 text-[13px] text-slate-100">
            <Linea ok={c.obligacionesCubiertas} si="Cumples tus obligaciones." no="No alcanzas a cubrir tus cuotas." />
            <Linea ok={c.estable} si="Mantienes tu estabilidad." no="Tu saldo queda comprometido." />
            <Linea ok={c.ahorrado > 0 && c.ahorrado >= c.programado} si="Te acerca a tus metas." no={c.programado > 0 ? `Faltan ${cop(Math.max(0, c.programado - c.ahorrado))} de tu aporte.` : 'Aún sin aportes este mes.'} />
          </ul>
        </div>
      )}
    </section>
  );
}

export function TipDelMes({ db, anio, mes }: { db: DB; anio: number; mes: number }) {
  const h = hormiga(db, anio, mes);
  const texto = h.n > 0
    ? `Llevas ${cop(h.total)} en ${h.n} ${h.n === 1 ? 'gasto hormiga' : 'gastos hormiga'} (cafés, snacks, compras pequeñas). Reducirlos entre 30% y 50% liberaría ${cop(h.total * 0.3)} – ${cop(h.total * 0.5)} mensuales.`
    : 'Registra cada compra pequeña (cafés, snacks, domicilios) como «Gasto hormiga»: al final del mes sabrás cuánto suman y cuánto podrías liberar.';
  return (
    <div className="flex items-start gap-2 rounded-xl border border-navy-600 bg-navy-900/60 px-3 py-2">
      <Lightbulb size={24} className="mt-0.5 shrink-0 text-gold-400" />
      <p className="text-xs leading-snug text-slate-100"><b className="mr-1 text-sm text-gold-400">Tip del mes:</b>{texto}</p>
    </div>
  );
}
