import { describe, expect, it } from 'vitest';
import type { DB, Movimiento } from '../types';
import { ahorroProgramado, capacidadAhorro, costoMensual, cuotasDelMes, estadoMes, evaluarGasto, hormiga, pasivoEstado, presupuesto, proyecciones, resumenAnual, resumenMes, saldoAcumulado } from './finance';

let n = 0;
const mov = (p: Partial<Movimiento> & Pick<Movimiento, 'kind' | 'fecha' | 'valor'>): Movimiento => {
  const [a, m] = p.fecha.split('-').map(Number);
  return { id: 'm' + n++, anio: a, mes: m, concepto: 'x', categoria: 'Otros', tipo: 'Necesario', ...p };
};
const db: DB = {
  config: {},
  pasivos: [{ id: 'p1', fecha: '2026-10-01', anio: 2026, mes: 10, nombre: 'Crédito', saldoPendiente: 3_000_000, valorCuota: 300_000, fechaVencimiento: '2026-11-20', cuotasPendientes: 10, tasaInteres: 1.5 }],
  metas: [{ id: 'g1', fecha: '2026-10-01', anio: 2026, mes: 10, nombre: 'Emergencias', categoria: 'Fondo de emergencias', valorObjetivo: 6_000_000, fechaCumplimiento: '2027-10-31', aporteMensual: 500_000 }],
  movimientos: [
    mov({ kind: 'ingreso', fecha: '2026-11-02', valor: 4_000_000, tipo: 'Fijo', categoria: 'Salario' }),
    mov({ kind: 'gasto', fecha: '2026-11-03', valor: 450_000, categoria: 'Alimentación' }),
    mov({ kind: 'gasto', fecha: '2026-11-05', valor: 6_000, concepto: 'Café', categoria: 'Café', tipo: 'Gasto hormiga', frecuencia: 'Diario' }),
    mov({ kind: 'gasto', fecha: '2026-11-06', valor: 6_000, concepto: 'café', categoria: 'Café', tipo: 'Gasto hormiga', frecuencia: 'Diario' }),
    mov({ kind: 'gasto', fecha: '2026-11-10', valor: 300_000, categoria: 'Créditos', tipo: 'Pago de deuda', pasivoId: 'p1' }),
    mov({ kind: 'ahorro', fecha: '2026-11-11', valor: 200_000, metaId: 'g1' }),
    mov({ kind: 'ingreso', fecha: '2026-10-02', valor: 4_000_000 }),
    mov({ kind: 'gasto', fecha: '2026-10-15', valor: 3_900_000 }),
  ],
};

describe('fórmulas', () => {
  const r = resumenMes(db, 2026, 11);
  it('el pago de deuda se cuenta una sola vez (como pasivo, no como egreso)', () => {
    expect(r.egresos).toBe(462_000);
    expect(r.pagosPasivos).toBe(300_000);
    expect(r.gastos).toBe(762_000);
  });
  it('el ahorro se descuenta del saldo sin ser gasto', () => {
    expect(r.ahorro).toBe(200_000);
    expect(r.saldo).toBe(4_000_000 - 462_000 - 300_000 - 200_000);
  });
  it('la frecuencia no duplica movimientos reales', () => {
    expect(hormiga(db, 2026, 11).total).toBe(12_000);
    const p = proyecciones(db.movimientos.filter((m) => m.mes === 11));
    expect(p[0].estimadoMensual).toBe(180_000);
    expect(p[0].registrado).toBe(12_000);
  });
  it('café de $6.000 diarios = $180.000 al mes; $60.000 semanal = $240.000', () => {
    expect(costoMensual(6000, 'Diario')).toBe(180_000);
    expect(costoMensual(60000, 'Semanal')).toBe(240_000);
  });
  it('saldo anual y acumulado', () => {
    expect(resumenAnual(db, 2026).saldo).toBe(r.saldo + 100_000);
    expect(saldoAcumulado(db, 2026, 10)).toBe(100_000);
    expect(saldoAcumulado(db, 2026, 11)).toBe(r.saldo + 100_000);
  });
  it('pasivo: la cuota pagada este mes ya no está pendiente', () => {
    expect(cuotasDelMes(db, 2026, 11).totalPendiente).toBe(0);
    expect(cuotasDelMes(db, 2026, 12).totalPendiente).toBe(300_000);
    expect(pasivoEstado(db, db.pasivos[0])).toMatchObject({ saldoEstimado: 2_700_000, cuotasRestantes: 9 });
  });
  it('presupuesto restante separa obligaciones y ahorro programado', () => {
    expect(ahorroProgramado(db, 2026, 11).pendiente).toBe(300_000);
    const p = presupuesto(db, 2026, 11);
    expect(p.libre).toBe(r.saldo);
    expect(p.restante).toBe(r.saldo - 300_000);
    expect(capacidadAhorro(db, 2026, 11).capacidad).toBe(4_000_000 - 762_000);
  });
  it('estado del mes', () => {
    expect(estadoMes(resumenMes(db, 2026, 10), 90)).toBe('alerta');
    expect(estadoMes(r, 90)).toBe('ok');
    expect(estadoMes(resumenMes(db, 2026, 1), 90)).toBe('vacio');
  });
  it('evaluador: verde / amarillo / rojo según datos reales', () => {
    const base = { frecuencia: 'Semanal', tipo: 'Opcional', categoria: 'Otros', ingresos: 4_000_000, obligaciones: 300_000, reservaAhorro: 500_000, discrecionalMes: 0, discrecionalAnterior: 0 };
    expect(evaluarGasto({ ...base, valor: 60_000, presupuesto: 2_000_000 }).nivel).toBe('verde');
    expect(evaluarGasto({ ...base, valor: 60_000, presupuesto: 1_000_000 }).nivel).toBe('amarillo'); // 240k > 200k restante, pero < 700k libre
    expect(evaluarGasto({ ...base, valor: 60_000, presupuesto: 500_000 }).nivel).toBe('rojo'); // 240k > 200k libre
    expect(evaluarGasto({ ...base, valor: 60_000, presupuesto: 2_000_000, discrecionalMes: 100_000, discrecionalAnterior: 200_000 }).nivel).toBe('amarillo');
  });
});
