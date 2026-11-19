/**
 * MOTOR DE CÁLCULO FINANCIERO
 *
 * Regla contable (evita duplicaciones):
 *  - Cada movimiento vive en UNA sola hoja y se cuenta UNA sola vez.
 *  - Un gasto clasificado «Pago de deuda» es un PAGO DE PASIVO, no un egreso de consumo.
 *      egresos       = gastos cuya clasificación NO es «Pago de deuda»
 *      pagosPasivos  = gastos cuya clasificación SÍ es «Pago de deuda»
 *  - El ahorro es dinero reservado (hoja AHORROS): no es gasto, pero sale del saldo disponible.
 *      saldo = ingresos − egresos − pagosPasivos − ahorro
 *  - La frecuencia de un gasto solo alimenta PROYECCIONES; nunca multiplica movimientos reales.
 */
import type { DB, Meta, Movimiento, Pasivo } from '../types';
import { DEUDA, FACTOR_MENSUAL, HORMIGA, MESES } from './constants';
import { cop, pct } from './format';

export interface Resumen {
  ingresos: number;
  egresos: number;
  pagosPasivos: number;
  /** egresos + pagosPasivos: todo el dinero que salió (sin contar ahorro) */
  gastos: number;
  ahorro: number;
  saldo: number;
  movimientos: number;
}

const ym = (anio: number, mes: number) => anio * 12 + (mes - 1);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function mesAnterior(anio: number, mes: number) {
  return mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };
}
export function movsMes(db: DB, anio: number, mes: number): Movimiento[] {
  return db.movimientos.filter((m) => m.anio === anio && m.mes === mes);
}

export function resumen(movs: Movimiento[]): Resumen {
  let ingresos = 0, egresos = 0, pagosPasivos = 0, ahorro = 0;
  for (const m of movs) {
    if (m.kind === 'ingreso') ingresos += m.valor;
    else if (m.kind === 'ahorro') ahorro += m.valor;
    else if (m.tipo === DEUDA) pagosPasivos += m.valor;
    else egresos += m.valor;
  }
  return { ingresos, egresos, pagosPasivos, gastos: egresos + pagosPasivos, ahorro, saldo: ingresos - egresos - pagosPasivos - ahorro, movimientos: movs.length };
}
export const resumenMes = (db: DB, anio: number, mes: number) => resumen(movsMes(db, anio, mes));
export const resumenAnual = (db: DB, anio: number) => resumen(db.movimientos.filter((m) => m.anio === anio));
/** Saldo acumulado: todo lo que ha quedado disponible desde el primer registro hasta el mes indicado. */
export const saldoAcumulado = (db: DB, anio: number, mes: number) =>
  resumen(db.movimientos.filter((m) => ym(m.anio, m.mes) <= ym(anio, mes))).saldo;

export type EstadoMes = 'vacio' | 'ok' | 'alerta' | 'deficit';
/** umbral: % de los ingresos a partir del cual los gastos se consideran «cercanos al presupuesto» (configurable). */
export function estadoMes(r: Resumen, umbral: number): EstadoMes {
  if (r.movimientos === 0) return 'vacio';
  if (r.saldo < 0) return 'deficit';
  if (r.ingresos > 0 && (r.gastos / r.ingresos) * 100 >= umbral) return 'alerta';
  return 'ok';
}

// ───────────────────────── Pasivos ─────────────────────────
export function pasivoEstado(db: DB, p: Pasivo) {
  const pagos = db.movimientos.filter((m) => m.kind === 'gasto' && m.pasivoId === p.id && m.fecha >= p.fecha);
  const pagado = sum(pagos.map((m) => m.valor));
  const saldoEstimado = Math.max(0, p.saldoPendiente - pagado);
  const cuotasRestantes = Math.max(0, p.cuotasPendientes - pagos.length);
  const activo = saldoEstimado > 0 && (p.cuotasPendientes === 0 || cuotasRestantes > 0);
  return { pagado, nPagos: pagos.length, saldoEstimado, cuotasRestantes, activo };
}

/** Cuotas del mes: cuánto se ha pagado y cuánto falta por pagar de cada obligación vigente. */
export function cuotasDelMes(db: DB, anio: number, mes: number) {
  const items = db.pasivos
    .filter((p) => ym(p.anio, p.mes) <= ym(anio, mes))
    .map((p) => {
      const pagadoMes = sum(movsMes(db, anio, mes).filter((m) => m.kind === 'gasto' && m.pasivoId === p.id).map((m) => m.valor));
      const est = pasivoEstado(db, p);
      const pendiente = est.activo || pagadoMes > 0 ? Math.max(0, Math.min(p.valorCuota, est.saldoEstimado + pagadoMes) - pagadoMes) : 0;
      return { pasivo: p, pagadoMes, pendiente };
    });
  return { items, totalPendiente: sum(items.map((i) => i.pendiente)) };
}

// ───────────────────────── Ahorro ─────────────────────────
export function metaProgreso(db: DB, meta: Meta, hoy: { anio: number; mes: number }) {
  const aportado = sum(db.movimientos.filter((m) => m.kind === 'ahorro' && m.metaId === meta.id).map((m) => m.valor));
  const faltante = Math.max(0, meta.valorObjetivo - aportado);
  const porcentaje = meta.valorObjetivo > 0 ? Math.min(100, (aportado / meta.valorObjetivo) * 100) : 0;
  let mesesRestantes: number | null = null;
  if (meta.fechaCumplimiento) {
    const [a, m] = meta.fechaCumplimiento.split('-').map(Number);
    mesesRestantes = Math.max(1, ym(a, m) - ym(hoy.anio, hoy.mes) + 1);
  }
  const aporteNecesario = mesesRestantes ? faltante / mesesRestantes : meta.aporteMensual;
  return { aportado, faltante, porcentaje, mesesRestantes, aporteNecesario, cumplida: faltante <= 0 };
}

/** Ahorro programado del mes (aportes mensuales de las metas vigentes) y lo que falta por aportar. */
export function ahorroProgramado(db: DB, anio: number, mes: number) {
  const vigentes = db.metas.filter((meta) => {
    if (ym(meta.anio, meta.mes) > ym(anio, mes)) return false;
    if (metaProgreso(db, meta, { anio, mes }).cumplida) return false;
    if (meta.fechaCumplimiento) {
      const [a, m] = meta.fechaCumplimiento.split('-').map(Number);
      if (ym(anio, mes) > ym(a, m)) return false;
    }
    return true;
  });
  const programado = sum(vigentes.map((m) => m.aporteMensual));
  const aportado = resumenMes(db, anio, mes).ahorro;
  return { programado, aportado, pendiente: Math.max(0, programado - aportado) };
}

/**
 * PRESUPUESTO RESTANTE
 *   saldo     = dinero del mes que aún no se ha gastado ni ahorrado
 *   libre     = saldo − cuotas de obligaciones que faltan por pagar este mes
 *   restante  = libre − ahorro programado que falta por aportar   ← lo que realmente se puede gastar
 */
export function presupuesto(db: DB, anio: number, mes: number) {
  const r = resumenMes(db, anio, mes);
  const obligaciones = cuotasDelMes(db, anio, mes).totalPendiente;
  const ahorroPendiente = ahorroProgramado(db, anio, mes).pendiente;
  const libre = r.saldo - obligaciones;
  return { saldo: r.saldo, obligaciones, ahorroPendiente, libre, restante: libre - ahorroPendiente };
}

/** Capacidad de ahorro del mes: lo que queda de los ingresos tras gastos reales y cuotas aún por pagar. */
export function capacidadAhorro(db: DB, anio: number, mes: number) {
  const r = resumenMes(db, anio, mes);
  const obligaciones = cuotasDelMes(db, anio, mes).totalPendiente;
  const capacidad = Math.max(0, r.ingresos - r.gastos - obligaciones);
  const programado = ahorroProgramado(db, anio, mes).programado;
  return {
    capacidad,
    programado,
    minimo: Math.min(capacidad, programado),
    porAhorrar: Math.max(0, capacidad - r.ahorro),
    obligacionesCubiertas: r.ingresos - r.gastos - obligaciones >= 0,
    estable: r.saldo - obligaciones >= 0,
    ahorrado: r.ahorro,
    ingresos: r.ingresos,
  };
}

// ───────────────────────── Categorías y gastos hormiga ─────────────────────────
export function porCategoria(movs: Movimiento[]) {
  const map = new Map<string, { categoria: string; total: number; n: number }>();
  for (const m of movs) {
    const c = map.get(m.categoria) ?? { categoria: m.categoria, total: 0, n: 0 };
    c.total += m.valor; c.n += 1;
    map.set(m.categoria, c);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}
const soloGastos = (movs: Movimiento[]) => movs.filter((m) => m.kind === 'gasto');
export const esDiscrecional = (m: Movimiento) => m.kind === 'gasto' && (m.tipo === 'Opcional' || m.tipo === HORMIGA);

export function hormiga(db: DB, anio: number, mes: number) {
  const movs = movsMes(db, anio, mes);
  const h = movs.filter((m) => m.kind === 'gasto' && m.tipo === HORMIGA);
  const prev = mesAnterior(anio, mes);
  const hp = movsMes(db, prev.anio, prev.mes).filter((m) => m.kind === 'gasto' && m.tipo === HORMIGA);
  const total = sum(h.map((m) => m.valor));
  const ingresos = resumen(movs).ingresos;
  const porConcepto = new Map<string, { concepto: string; n: number; total: number }>();
  for (const m of h) {
    const k = m.concepto.trim().toLowerCase();
    const c = porConcepto.get(k) ?? { concepto: m.concepto.trim(), n: 0, total: 0 };
    c.n += 1; c.total += m.valor;
    porConcepto.set(k, c);
  }
  return {
    total,
    n: h.length,
    promedio: h.length ? total / h.length : 0,
    pctIngresos: ingresos > 0 ? (total / ingresos) * 100 : null,
    totalAnterior: sum(hp.map((m) => m.valor)),
    nAnterior: hp.length,
    frecuentes: [...porConcepto.values()].sort((a, b) => b.n - a.n || b.total - a.total),
  };
}

/** PROYECCIONES (separadas de lo ejecutado): cuánto costaría al mes un gasto recurrente si se mantiene su frecuencia. */
export function proyecciones(movs: Movimiento[]) {
  const map = new Map<string, { concepto: string; frecuencia: string; valores: number[]; registrado: number }>();
  for (const m of soloGastos(movs)) {
    if (!m.frecuencia || m.frecuencia === 'Único' || m.frecuencia === 'Mensual') continue;
    const k = m.concepto.trim().toLowerCase() + '|' + m.frecuencia;
    const c = map.get(k) ?? { concepto: m.concepto.trim(), frecuencia: m.frecuencia, valores: [], registrado: 0 };
    c.valores.push(m.valor); c.registrado += m.valor;
    map.set(k, c);
  }
  return [...map.values()].map((c) => {
    const unit = sum(c.valores) / c.valores.length;
    return { concepto: c.concepto, frecuencia: c.frecuencia, valorUnitario: unit, estimadoMensual: unit * FACTOR_MENSUAL[c.frecuencia], registrado: c.registrado, n: c.valores.length };
  }).sort((a, b) => b.estimadoMensual - a.estimadoMensual);
}

export function costoMensual(valor: number, frecuencia: string) {
  return valor * (FACTOR_MENSUAL[frecuencia] ?? 1);
}

// ───────────────────────── ¿Debo realizar este gasto? ─────────────────────────
export type Nivel = 'verde' | 'amarillo' | 'rojo' | 'sin-datos';
export interface EntradaEvaluacion {
  valor: number;
  frecuencia: string;
  tipo: string;
  categoria: string;
  ingresos: number;
  /** cuotas de obligaciones que faltan por pagar este mes */
  obligaciones: number;
  /** dinero del mes aún no gastado ni ahorrado */
  presupuesto: number;
  /** ahorro programado que falta por aportar este mes */
  reservaAhorro: number;
  /** gasto opcional + hormiga ya ejecutado este mes y el mes anterior */
  discrecionalMes: number;
  discrecionalAnterior: number;
}
export function evaluarGasto(e: EntradaEvaluacion) {
  const costo = costoMensual(e.valor, e.frecuencia);
  const recurrente = e.frecuencia !== 'Único';
  const libre = e.presupuesto - e.obligaciones;
  const restante = libre - e.reservaAhorro;
  const base = {
    costoMensual: costo,
    costoAnual: recurrente ? costo * 12 : costo,
    pctIngresos: e.ingresos > 0 ? (costo / e.ingresos) * 100 : null,
    restanteAntes: restante,
    restanteDespues: restante - costo,
    ahorroComprometido: Math.max(0, Math.min(e.reservaAhorro, costo - Math.max(0, restante))),
    deficit: Math.max(0, costo - libre),
  };
  if (e.valor <= 0) return { ...base, nivel: 'sin-datos' as Nivel, titulo: 'Ingresa un valor', mensaje: 'Escribe el valor del gasto para evaluarlo con tus datos del mes.' };
  if (e.ingresos <= 0) return { ...base, nivel: 'sin-datos' as Nivel, titulo: 'Faltan datos', mensaje: 'Registra primero los ingresos del mes; sin ellos no es posible medir el impacto de este gasto.' };

  const equivale = `${recurrente ? 'Este gasto equivale a' : 'Este gasto es de'} ${cop(costo)}${recurrente ? ' al mes' : ''} (${pct(base.pctIngresos!, 1)} de tus ingresos).`;
  const forzoso = e.tipo === 'Obligatorio' || e.tipo === DEUDA;
  const discrecional = e.tipo === 'Opcional' || e.tipo === HORMIGA;

  if (costo > libre) {
    return {
      ...base, nivel: 'rojo' as Nivel,
      titulo: forzoso ? 'Faltan recursos' : 'No es recomendable',
      mensaje: forzoso
        ? `${equivale} Es una obligación, pero hoy te faltarían ${cop(base.deficit)} después de tus cuotas pendientes. Recorta gastos opcionales o reprograma antes de pagarlo.`
        : `${equivale} Supera en ${cop(base.deficit)} lo que te queda después de tus obligaciones (${cop(libre)}): generaría un déficit.`,
    };
  }
  if (costo > restante) {
    return {
      ...base, nivel: 'amarillo' as Nivel,
      titulo: '¡Precaución!',
      mensaje: forzoso
        ? `${equivale} Puedes cubrirlo, pero tendrías que tomar ${cop(base.ahorroComprometido)} de tu ahorro programado de este mes.`
        : `${equivale} Cabe en tu saldo, pero se comería ${cop(base.ahorroComprometido)} del ahorro que programaste. Reduce la frecuencia o busca una alternativa más económica.`,
    };
  }
  if (discrecional && e.discrecionalAnterior > 0 && e.discrecionalMes + costo > e.discrecionalAnterior) {
    return {
      ...base, nivel: 'amarillo' as Nivel,
      titulo: '¡Precaución!',
      mensaje: `${equivale} Está dentro de tu presupuesto, pero con él tus gastos opcionales del mes (${cop(e.discrecionalMes + costo)}) superarían los del mes anterior (${cop(e.discrecionalAnterior)}). Puedes reducir su frecuencia para ahorrar más.`,
    };
  }
  return {
    ...base, nivel: 'verde' as Nivel,
    titulo: forzoso ? 'Cúbrelo sin problema' : 'Puedes realizarlo',
    mensaje: `${equivale} Está dentro de tu presupuesto: te quedarían ${cop(restante - costo)} después de obligaciones y ahorro programado.`,
  };
}

// ───────────────────────── Análisis automático ─────────────────────────
export function variacionCategorias(db: DB, anio: number, mes: number) {
  const prev = mesAnterior(anio, mes);
  const act = porCategoria(soloGastos(movsMes(db, anio, mes)));
  const ant = new Map(porCategoria(soloGastos(movsMes(db, prev.anio, prev.mes))).map((c) => [c.categoria, c.total]));
  return act.map((c) => ({ categoria: c.categoria, actual: c.total, anterior: ant.get(c.categoria) ?? 0, delta: c.total - (ant.get(c.categoria) ?? 0) }));
}

export function liquidez(db: DB, anio: number, mes: number, hoy: Date) {
  const r = resumenMes(db, anio, mes);
  const p = presupuesto(db, anio, mes);
  if (r.movimientos === 0) return { nivel: 'sin-datos' as Nivel, texto: 'Aún no hay movimientos en este mes.' };
  if (p.saldo < 0) return { nivel: 'rojo' as Nivel, texto: `El mes está en déficit: has comprometido ${cop(-p.saldo)} más de lo que ingresó.` };
  if (p.libre < 0) return { nivel: 'rojo' as Nivel, texto: `Tu saldo (${cop(p.saldo)}) no alcanza para las cuotas que faltan por pagar este mes (${cop(p.obligaciones)}). Faltan ${cop(-p.libre)}.` };
  const esActual = hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes;
  if (esActual) {
    const dia = hoy.getDate();
    const diasMes = new Date(anio, mes, 0).getDate();
    const variable = sum(movsMes(db, anio, mes).filter((m) => m.kind === 'gasto' && m.tipo !== DEUDA && m.tipo !== 'Obligatorio' && m.frecuencia !== 'Mensual').map((m) => m.valor));
    const ritmo = variable / dia;
    const falta = ritmo * (diasMes - dia);
    if (falta > p.libre) {
      return { nivel: 'amarillo' as Nivel, texto: `Al ritmo actual de gasto variable (${cop(ritmo)} por día) necesitarías ${cop(falta)} para terminar el mes y solo tienes ${cop(p.libre)} libres. Riesgo de quedarte sin liquidez.` };
    }
    return { nivel: 'verde' as Nivel, texto: `Al ritmo actual (${cop(ritmo)} por día en gasto variable) terminarías el mes con cerca de ${cop(p.libre - falta)} libres.` };
  }
  return { nivel: 'verde' as Nivel, texto: `El mes cierra con ${cop(p.libre)} libres después de obligaciones.` };
}

/** Recomendaciones en lenguaje sencillo, construidas solo con los datos registrados. */
export function recomendaciones(db: DB, anio: number, mes: number): string[] {
  const out: string[] = [];
  const nombre = MESES[mes - 1].toLowerCase();
  const prev = mesAnterior(anio, mes);
  const nombrePrev = MESES[prev.mes - 1].toLowerCase();
  const r = resumenMes(db, anio, mes);
  if (r.movimientos === 0) return ['Registra tus ingresos y gastos de este mes para generar el análisis.'];
  const h = hormiga(db, anio, mes);
  if (h.n > 0) {
    const top = h.frecuentes[0];
    out.push(`Durante ${nombre} registraste ${cop(h.total)} en ${h.n} ${h.n === 1 ? 'gasto hormiga' : 'gastos hormiga'} (promedio ${cop(h.promedio)} por compra). Si los reduces a la mitad podrías liberar aproximadamente ${cop(h.total / 2)} mensuales para tus objetivos de ahorro.`);
    if (top && top.n > 1) out.push(`Tu gasto hormiga más frecuente es «${top.concepto}»: ${top.n} veces por un total de ${cop(top.total)}.`);
    if (h.totalAnterior > 0) {
      const d = h.total - h.totalAnterior;
      out.push(d > 0 ? `Tus gastos hormiga subieron ${cop(d)} frente a ${nombrePrev}.` : d < 0 ? `Bien: tus gastos hormiga bajaron ${cop(-d)} frente a ${nombrePrev}.` : `Tus gastos hormiga se mantuvieron igual que en ${nombrePrev}.`);
    }
  }
  const sube = variacionCategorias(db, anio, mes).filter((v) => v.anterior > 0 && v.delta > 0).sort((a, b) => b.delta - a.delta)[0];
  if (sube) out.push(`Tu gasto en ${sube.categoria} aumentó ${cop(sube.delta)} respecto a ${nombrePrev} (de ${cop(sube.anterior)} a ${cop(sube.actual)}).`);
  const disc = porCategoria(movsMes(db, anio, mes).filter(esDiscrecional))[0];
  if (disc) out.push(`El gasto opcional donde más puedes recortar es ${disc.categoria}: ${cop(disc.total)} en ${disc.n} ${disc.n === 1 ? 'movimiento' : 'movimientos'}.`);
  const cap = capacidadAhorro(db, anio, mes);
  if (r.ingresos > 0 && r.ahorro === 0 && cap.capacidad > 0) out.push(`Aún no has registrado ahorro en ${nombre}. Después de gastos y cuotas pendientes podrías reservar hasta ${cop(cap.capacidad)}.`);
  if (r.saldo < 0) out.push(`El mes está en déficit por ${cop(-r.saldo)}. Revisa primero los gastos opcionales antes de asumir nuevos compromisos.`);
  return out;
}
