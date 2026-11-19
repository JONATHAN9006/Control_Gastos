import { MESES_CORTO } from './constants';

const nf = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** $ 4.000.000  ·  -$ 400.000 */
export function cop(v: number): string {
  const n = Math.round(v || 0);
  return (n < 0 ? '-$\u00a0' : '$\u00a0') + nf.format(Math.abs(n));
}
export function miles(v: number): string {
  return nf.format(Math.round(v || 0));
}
export function pct(v: number, dec = 0): string {
  if (!isFinite(v)) return '—';
  return v.toFixed(dec).replace('.', ',') + '%';
}
/** 2026-11-02 -> 02-nov */
export function fechaCorta(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}-${MESES_CORTO[Number(m) - 1] ?? m}`;
}
export function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function partesFecha(iso: string): { anio: number; mes: number; dia: number } {
  const [a, m, d] = iso.split('-').map(Number);
  return { anio: a, mes: m, dia: d };
}
export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
