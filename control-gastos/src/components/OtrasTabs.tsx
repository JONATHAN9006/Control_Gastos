import { Activity, Bug, Check, Landmark, Pencil, PieChart, PiggyBank, Plus, ShieldAlert, Sparkles, Target, Trash2, TrendingUp, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { COLORES_CATEGORIA, MESES } from '../lib/constants';
import { capacidadAhorro, cuotasDelMes, hormiga, liquidez, mesAnterior, metaProgreso, movsMes, pasivoEstado, porCategoria, proyecciones, recomendaciones, resumenMes, saldoAcumulado, variacionCategorias, esDiscrecional } from '../lib/finance';
import { cop, fechaCorta, pct } from '../lib/format';
import type { DB, Kind, Meta, Movimiento, Pasivo } from '../types';
import { AhorroSugerido, PresupuestoRestante } from './MovimientosTab';
import { Barra, Dona, Titulo, Vacio } from './ui';

function Dato({ label, valor, color = 'text-white', nota }: { label: string; valor: string; color?: string; nota?: string }) {
  return (
    <div className="rounded-lg border border-navy-600 bg-navy-900/60 px-3 py-2">
      <div className="text-[11px] text-slate-300">{label}</div>
      <div className={`text-base font-bold ${color}`}>{valor}</div>
      {nota && <div className="text-[10px] text-slate-400">{nota}</div>}
    </div>
  );
}
function Borrar({ onSi }: { onSi: () => void }) {
  const [c, setC] = useState(false);
  return c ? (
    <span className="inline-flex gap-1"><button className="rounded bg-alert-500 p-1 text-white" title="Confirmar" onClick={onSi}><Check size={13} /></button><button className="rounded bg-navy-600 p-1 text-white" title="Cancelar" onClick={() => setC(false)}><X size={13} /></button></span>
  ) : <button className="text-alert-400 hover:text-alert-300" title="Eliminar" onClick={() => setC(true)}><Trash2 size={15} /></button>;
}

// ───────────────────────── RESUMEN ─────────────────────────
export function ResumenTab({ db, anio, mes, abrirPasivo, eliminarPasivo }: { db: DB; anio: number; mes: number; abrirPasivo: (p?: Pasivo) => void; eliminarPasivo: (p: Pasivo) => void }) {
  const r = resumenMes(db, anio, mes);
  const cats = porCategoria(movsMes(db, anio, mes).filter((m) => m.kind === 'gasto'));
  const top = cats.slice(0, 7);
  const resto = cats.slice(7).reduce((a, c) => a + c.total, 0);
  const datos = [...top.map((c, i) => ({ label: c.categoria, value: c.total, color: COLORES_CATEGORIA[i] })), ...(resto ? [{ label: 'Otras', value: resto, color: COLORES_CATEGORIA[10] }] : [])];
  const pg = r.ingresos > 0 ? (r.gastos / r.ingresos) * 100 : 0;
  const pa = r.ingresos > 0 ? (r.ahorro / r.ingresos) * 100 : 0;
  const cuotas = cuotasDelMes(db, anio, mes);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Dato label="Total de ingresos" valor={cop(r.ingresos)} color="text-tech-300" />
        <Dato label="Total de egresos" valor={cop(r.egresos)} color="text-alert-300" nota="Gastos de consumo (sin deudas)" />
        <Dato label="Pagos de obligaciones" valor={cop(r.pagosPasivos)} color="text-alert-300" nota="Gastos «Pago de deuda»" />
        <Dato label="Total de ahorro" valor={cop(r.ahorro)} color="text-gold-300" nota="Dinero reservado" />
        <Dato label="Saldo disponible del mes" valor={cop(r.saldo)} color={r.saldo < 0 ? 'text-alert-300' : 'text-white'} nota="Ingresos − egresos − deudas − ahorro" />
        <Dato label="Saldo acumulado" valor={cop(saldoAcumulado(db, anio, mes))} nota={`Desde el primer registro hasta ${MESES[mes - 1].toLowerCase()}`} />
      </div>
      <PresupuestoRestante db={db} anio={anio} mes={mes} />
      <section className="panel-box space-y-2.5">
        <Titulo icono={<Activity size={20} />}>Uso de tus ingresos</Titulo>
        {r.ingresos <= 0 ? <Vacio>Sin ingresos registrados no es posible calcular porcentajes.</Vacio> : (<>
          <div><div className="mb-1 flex justify-between text-xs text-slate-200"><span>Destinado a gastos</span><b className="text-white">{pct(pg, 1)}</b></div><Barra pct={pg} color={pg >= 100 ? '#ef5350' : '#f87171'} /></div>
          <div><div className="mb-1 flex justify-between text-xs text-slate-200"><span>Destinado a ahorro</span><b className="text-white">{pct(pa, 1)}</b></div><Barra pct={pa} color="#ffd23f" /></div>
          <div><div className="mb-1 flex justify-between text-xs text-slate-200"><span>Disponible</span><b className="text-white">{pct(Math.max(0, 100 - pg - pa), 1)}</b></div><Barra pct={100 - pg - pa} color="#3df06c" /></div>
        </>)}
      </section>
      <section className="panel-box">
        <Titulo icono={<PieChart size={20} />}>Distribución de gastos por categoría</Titulo>
        {cats.length === 0 ? <Vacio>Aún no hay gastos en este mes.</Vacio> : (
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Dona datos={datos} centro={<><span className="text-[10px] text-slate-300">Gastos</span><span className="text-xs font-bold text-white">{cop(r.gastos)}</span></>} />
            <ul className="w-full space-y-1 text-xs">
              {datos.map((d) => (
                <li key={d.label} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
                  <span className="flex-1 truncate text-slate-100">{d.label}</span>
                  <span className="text-slate-400">{pct((d.value / r.gastos) * 100)}</span>
                  <span className="w-[86px] text-right font-semibold text-white">{cop(d.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <section className="panel-box">
        <Titulo icono={<Landmark size={20} />} extra={<button className="btn-ghost px-2 py-1 text-xs" onClick={() => abrirPasivo()}><Plus size={14} />Obligación</button>}>Obligaciones pendientes</Titulo>
        {db.pasivos.length === 0 ? <Vacio>Registra aquí tus créditos y tarjetas (saldo, cuota y vencimiento). No descuentan dinero hasta que registres el pago.</Vacio> : (
          <ul className="space-y-2">
            {db.pasivos.map((p) => {
              const e = pasivoEstado(db, p);
              const c = cuotas.items.find((i) => i.pasivo.id === p.id);
              const avance = p.saldoPendiente > 0 ? (e.pagado / p.saldoPendiente) * 100 : 0;
              return (
                <li key={p.id} className="rounded-lg border border-navy-600 bg-navy-900/60 p-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <b className="flex-1 truncate text-sm text-white">{p.nombre}</b>
                    {c && (c.pendiente > 0 ? <span className="rounded-full bg-gold-500/80 px-2 py-0.5 text-[10px] font-semibold text-navy-950">Cuota por pagar</span> : c.pagadoMes > 0 ? <span className="rounded-full bg-tech-500 px-2 py-0.5 text-[10px] font-semibold text-navy-950">Pagada este mes</span> : null)}
                    <button className="text-turq-300 hover:text-white" title="Editar" onClick={() => abrirPasivo(p)}><Pencil size={15} /></button>
                    <Borrar onSi={() => eliminarPasivo(p)} />
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-slate-200">
                    <span>Saldo estimado: <b className="text-white">{cop(e.saldoEstimado)}</b></span>
                    <span>Cuota: <b className="text-white">{cop(p.valorCuota)}</b></span>
                    <span>Cuotas restantes: <b className="text-white">{p.cuotasPendientes ? e.cuotasRestantes : 'Rotativo'}</b></span>
                    <span>Vence: <b className="text-white">{p.fechaVencimiento ? fechaCorta(p.fechaVencimiento) : '—'}</b>{p.tasaInteres ? ` · ${String(p.tasaInteres).replace('.', ',')}% m.v.` : ''}</span>
                  </div>
                  <div className="mt-1.5"><Barra pct={avance} color="#3fd0ee" alto={6} /></div>
                  <div className="mt-0.5 text-[10px] text-slate-400">Abonado {cop(e.pagado)} en {e.nPagos} {e.nPagos === 1 ? 'pago vinculado' : 'pagos vinculados'} · saldo sin recalcular intereses</div>
                </li>
              );
            })}
          </ul>
        )}
        {cuotas.totalPendiente > 0 && <p className="mt-2 text-xs text-gold-300">Cuotas por pagar en {MESES[mes - 1]}: <b>{cop(cuotas.totalPendiente)}</b></p>}
      </section>
    </div>
  );
}

// ───────────────────────── ANÁLISIS ─────────────────────────
function Var({ label, actual, anterior, bueno }: { label: string; actual: number; anterior: number; bueno: 'sube' | 'baja' }) {
  const d = actual - anterior;
  const ok = d === 0 || (bueno === 'sube' ? d > 0 : d < 0);
  return (
    <div className="rounded-lg border border-navy-600 bg-navy-900/60 px-3 py-2">
      <div className="text-[11px] text-slate-300">{label}</div>
      <div className="text-base font-bold text-white">{cop(actual)}</div>
      <div className={`text-[11px] ${anterior === 0 ? 'text-slate-400' : ok ? 'text-tech-300' : 'text-alert-300'}`}>
        {anterior === 0 ? 'Sin datos del mes anterior' : `${d >= 0 ? '+' : '−'}${cop(Math.abs(d)).slice(2)} (${pct(Math.abs(d / anterior) * 100)}) vs. mes anterior`}
      </div>
    </div>
  );
}
function Item({ icono, titulo, children }: { icono: ReactNode; titulo: string; children: ReactNode }) {
  return <li className="flex gap-2"><span className="mt-0.5 shrink-0 text-turq-300">{icono}</span><div><div className="text-xs font-semibold text-white">{titulo}</div><div className="text-xs text-slate-200">{children}</div></div></li>;
}

export function AnalisisTab({ db, anio, mes }: { db: DB; anio: number; mes: number }) {
  const [reduccion, setReduccion] = useState(50);
  const r = resumenMes(db, anio, mes);
  const prev = mesAnterior(anio, mes);
  const rp = resumenMes(db, prev.anio, prev.mes);
  const h = hormiga(db, anio, mes);
  const movs = movsMes(db, anio, mes);
  const top = porCategoria(movs.filter((m) => m.kind === 'gasto'))[0];
  const aumentos = variacionCategorias(db, anio, mes).filter((v) => v.anterior > 0 && v.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 4);
  const reducibles = porCategoria(movs.filter(esDiscrecional)).slice(0, 4);
  const proy = proyecciones(movs);
  const liq = liquidez(db, anio, mes, new Date());
  const cap = capacidadAhorro(db, anio, mes);
  const recs = recomendaciones(db, anio, mes);
  const dh = h.total - h.totalAnterior;
  if (r.movimientos === 0) return <Vacio>Registra movimientos en {MESES[mes - 1]} {anio} para generar el análisis automático.</Vacio>;
  return (
    <div className="space-y-3">
      <section className="panel-box">
        <Titulo icono={<Bug size={20} className="text-gold-400" />}>Control de gastos hormiga</Titulo>
        {h.n === 0 ? <Vacio>No hay gastos clasificados como «Gasto hormiga» este mes.</Vacio> : (<>
          <div className="grid grid-cols-2 gap-2">
            <Dato label="Total del mes" valor={cop(h.total)} color="text-gold-300" />
            <Dato label="Compras pequeñas" valor={String(h.n)} />
            <Dato label="Promedio por compra" valor={cop(h.promedio)} />
            <Dato label="Frente a tus ingresos" valor={h.pctIngresos == null ? '—' : pct(h.pctIngresos, 1)} />
          </div>
          <p className={`mt-2 text-xs ${h.totalAnterior === 0 ? 'text-slate-400' : dh > 0 ? 'text-alert-300' : 'text-tech-300'}`}>
            {h.totalAnterior === 0 ? `Sin gastos hormiga registrados en ${MESES[prev.mes - 1].toLowerCase()} para comparar.` : `${MESES[prev.mes - 1]}: ${cop(h.totalAnterior)} en ${h.nAnterior} compras → ${dh > 0 ? `subiste ${cop(dh)}` : dh < 0 ? `bajaste ${cop(-dh)}` : 'igual que el mes anterior'}.`}
          </p>
          <div className="mt-2 rounded-lg border border-tech-800 bg-tech-900/40 p-2.5">
            <label className="flex items-center justify-between text-xs text-slate-100"><span>Si los reduzco un <b className="text-white">{reduccion}%</b></span><input aria-label="Porcentaje de reducción" type="range" min={10} max={100} step={10} value={reduccion} onChange={(e) => setReduccion(Number(e.target.value))} className="w-1/2 accent-green-400" /></label>
            <div className="mt-1 text-sm text-white">Ahorrarías <b className="text-tech-300">{cop((h.total * reduccion) / 100)}</b> al mes · <b className="text-tech-300">{cop((h.total * reduccion * 12) / 100)}</b> al año</div>
          </div>
        </>)}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Var label="Ingresos" actual={r.ingresos} anterior={rp.ingresos} bueno="sube" />
        <Var label="Egresos (con deudas)" actual={r.gastos} anterior={rp.gastos} bueno="baja" />
      </div>

      <section className="panel-box">
        <Titulo icono={<TrendingUp size={20} />}>Hallazgos del mes</Titulo>
        <ul className="space-y-2.5">
          {top && <Item icono={<PieChart size={16} />} titulo="Categoría donde más gastas">{top.categoria}: {cop(top.total)} ({pct((top.total / r.gastos) * 100)} de tus gastos).</Item>}
          {h.frecuentes.length > 0 && <Item icono={<Bug size={16} />} titulo="Gastos hormiga más frecuentes">{h.frecuentes.slice(0, 3).map((f) => `${f.concepto} ×${f.n} (${cop(f.total)})`).join(' · ')}</Item>}
          <Item icono={<TrendingUp size={16} />} titulo="Gastos que aumentaron">{aumentos.length ? aumentos.map((a) => `${a.categoria} +${cop(a.delta).slice(2)}`).join(' · ') : rp.movimientos === 0 ? 'No hay datos del mes anterior para comparar.' : 'Ninguna categoría aumentó frente al mes anterior.'}</Item>
          <Item icono={<Target size={16} />} titulo="Gastos que puedes reducir">{reducibles.length ? reducibles.map((a) => `${a.categoria} ${cop(a.total)}`).join(' · ') : 'No registras gastos opcionales ni hormiga.'}</Item>
          <Item icono={<PiggyBank size={16} />} titulo="Capacidad de ahorro">{r.ingresos > 0 ? `${cop(cap.capacidad)} después de gastos y cuotas por pagar (${pct((cap.capacidad / r.ingresos) * 100)} de tus ingresos). Ya reservaste ${cop(r.ahorro)}.` : 'Registra tus ingresos para calcularla.'}</Item>
          <Item icono={<ShieldAlert size={16} className={liq.nivel === 'rojo' ? 'text-alert-400' : liq.nivel === 'amarillo' ? 'text-gold-400' : 'text-tech-400'} />} titulo="Riesgo de liquidez">{liq.texto}</Item>
        </ul>
      </section>

      {proy.length > 0 && (
        <section className="panel-box">
          <Titulo icono={<Activity size={20} />}>Proyección de gastos recurrentes</Titulo>
          <p className="mb-2 text-[11px] text-slate-400">Estimaciones según la frecuencia indicada. No son movimientos reales ni se suman a tus totales.</p>
          <ul className="space-y-1 text-xs">
            {proy.slice(0, 6).map((p) => (
              <li key={p.concepto + p.frecuencia} className="flex items-center justify-between gap-2 border-b border-navy-700/70 py-1">
                <span className="truncate text-slate-100">{p.concepto} <span className="text-slate-400">· {cop(p.valorUnitario)} {p.frecuencia.toLowerCase()}</span></span>
                <span className="shrink-0 text-right"><b className="text-gold-300">≈ {cop(p.estimadoMensual)}/mes</b><span className="block text-[10px] text-slate-400">registrado: {cop(p.registrado)}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel-box">
        <Titulo icono={<Sparkles size={20} />}>Recomendaciones</Titulo>
        <ul className="space-y-2 text-xs leading-relaxed text-slate-100">{recs.map((t, i) => <li key={i} className="rounded-lg bg-navy-900/60 px-3 py-2">{t}</li>)}{recs.length === 0 && <li className="text-slate-400">Sin observaciones: tus cifras del mes están equilibradas.</li>}</ul>
      </section>
    </div>
  );
}

// ───────────────────────── AHORRO ─────────────────────────
export function AhorroTab({ db, anio, mes, abrirMov, abrirMeta, eliminarMeta, eliminarMov }: {
  db: DB; anio: number; mes: number; abrirMov: (k: Kind, m?: Movimiento) => void; abrirMeta: (m?: Meta) => void; eliminarMeta: (m: Meta) => void; eliminarMov: (m: Movimiento) => Promise<boolean>;
}) {
  const aportes = movsMes(db, anio, mes).filter((m) => m.kind === 'ahorro');
  return (
    <div className="space-y-3">
      <AhorroSugerido db={db} anio={anio} mes={mes} />
      <div className="grid grid-cols-2 gap-3">
        <button className="btn-green py-2" onClick={() => abrirMov('ahorro')}><PiggyBank size={18} className="text-gold-400" />Registrar aporte</button>
        <button className="btn-ghost py-2" onClick={() => abrirMeta()}><Plus size={18} />Nueva meta</button>
      </div>
      <p className="text-[11px] text-slate-400">Cada aporte es dinero reservado: se descuenta una sola vez del saldo disponible y no se cuenta como gasto.</p>
      <section className="panel-box">
        <Titulo icono={<Target size={20} />}>Metas de ahorro</Titulo>
        {db.metas.length === 0 ? <Vacio>Crea tu primera meta: fondo de emergencias, viajes, tecnología, estudios, inversión…</Vacio> : (
          <ul className="space-y-2.5">
            {db.metas.map((m) => {
              const p = metaProgreso(db, m, { anio, mes });
              return (
                <li key={m.id} className="rounded-lg border border-navy-600 bg-navy-900/60 p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1"><b className="block truncate text-sm text-white">{m.nombre}</b><span className="text-[11px] text-slate-400">{m.categoria}{m.fechaCumplimiento ? ` · para ${fechaCorta(m.fechaCumplimiento)}-${m.fechaCumplimiento.slice(0, 4)}` : ''}</span></div>
                    <span className={`text-base font-extrabold ${p.cumplida ? 'text-tech-300' : 'text-white'}`}>{pct(p.porcentaje)}</span>
                    <button className="text-turq-300 hover:text-white" title="Editar" onClick={() => abrirMeta(m)}><Pencil size={15} /></button>
                    <Borrar onSi={() => eliminarMeta(m)} />
                  </div>
                  <div className="mt-1.5"><Barra pct={p.porcentaje} color={p.cumplida ? '#3df06c' : '#22d957'} alto={10} /></div>
                  <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-[11px] text-slate-200">
                    <span>{cop(p.aportado)} de {cop(m.valorObjetivo)}</span>
                    <span>{p.cumplida ? '¡Meta cumplida!' : `Faltan ${cop(p.faltante)}`}</span>
                  </div>
                  {!p.cumplida && (
                    <div className="mt-1 text-[11px] text-slate-400">
                      Aporte mensual: {cop(m.aporteMensual)}
                      {p.mesesRestantes ? ` · para llegar a tiempo: ${cop(p.aporteNecesario)}/mes (${p.mesesRestantes} ${p.mesesRestantes === 1 ? 'mes' : 'meses'})` : ''}
                      {p.mesesRestantes && m.aporteMensual < p.aporteNecesario - 1 ? <span className="text-gold-300"> · con tu aporte actual no alcanzas la fecha</span> : null}
                    </div>
                  )}
                  {m.descripcion && <div className="mt-1 text-[11px] italic text-slate-400">{m.descripcion}</div>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="panel-box">
        <Titulo icono={<PiggyBank size={20} />}>Aportes de {MESES[mes - 1]}</Titulo>
        {aportes.length === 0 ? <Vacio>Sin aportes este mes.</Vacio> : (
          <ul className="text-xs">
            {aportes.map((a) => (
              <li key={a.id} className="flex items-center gap-2 border-b border-navy-700/70 py-1.5">
                <span className="w-12 text-slate-300">{fechaCorta(a.fecha)}</span>
                <span className="flex-1 truncate text-white">{a.concepto}<span className="text-slate-400"> · {db.metas.find((m) => m.id === a.metaId)?.nombre ?? 'Ahorro general'}</span></span>
                <b className="text-gold-300">{cop(a.valor)}</b>
                <button className="text-turq-300 hover:text-white" title="Editar" onClick={() => abrirMov('ahorro', a)}><Pencil size={14} /></button>
                <Borrar onSi={() => eliminarMov(a)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
