import { AlertCircle, AlertTriangle, CalendarDays, CheckCircle2, Info, PiggyBank, SquarePen, TrendingDown, TrendingUp } from 'lucide-react';
import type { EstadoMes, Resumen } from '../lib/finance';
import { cop } from '../lib/format';

const ESTADO: Record<EstadoMes, { icono: JSX.Element; titulo: string }> = {
  ok: { icono: <CheckCircle2 size={24} className="fill-tech-500 text-navy-900" />, titulo: 'Situación financiera favorable' },
  alerta: { icono: <AlertTriangle size={24} className="fill-gold-400 text-navy-900" />, titulo: 'Gastos cercanos al presupuesto' },
  deficit: { icono: <AlertCircle size={24} className="fill-alert-500 text-white" />, titulo: 'Déficit o desequilibrio financiero' },
  vacio: { icono: <Info size={24} className="fill-sky2-500 text-navy-900" />, titulo: 'Sin movimientos registrados' },
};

function Fila({ icono, label, valor }: { icono: JSX.Element; label: string; valor: number }) {
  return (
    <div className="mc-fila flex items-center justify-between gap-2 py-[5px] text-[13px] sm:text-[15px]">
      <span className="flex items-center gap-2 text-slate-100">{icono}{label}</span>
      <span className="font-medium text-white">{cop(valor)}</span>
    </div>
  );
}

/** compacto: el panel de detalle está abierto; en portátiles (1280–1499 px) se reduce el texto para conservar las 4 columnas. */
export function MonthCard({ nombre, r, estado, activo, compacto, onClick }: { nombre: string; r: Resumen; estado: EstadoMes; activo: boolean; compacto: boolean; onClick: () => void }) {
  const c = compacto ? 'cgm-compacto' : '';
  const neg = r.saldo < 0;
  return (
    <button
      onClick={onClick} aria-pressed={activo} title={ESTADO[estado].titulo}
      className={`group w-full rounded-xl border bg-gradient-to-b from-navy-800 to-navy-850 p-2 text-left shadow-card transition hover:border-turq-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-turq-400 ${c} ${activo ? 'border-tech-400 shadow-glow' : 'border-navy-600'}`}
    >
      <div className="flex items-center gap-2 px-2 pb-1 pt-1.5">
        <CalendarDays size={22} className="shrink-0 text-turq-300" />
        <span className="mc-titulo flex-1 truncate text-lg font-bold text-white sm:text-xl">{nombre}</span>
        {ESTADO[estado].icono}
        <SquarePen size={18} className="mc-edit ml-1 shrink-0 text-turq-400 opacity-80 group-hover:opacity-100" />
      </div>
      <div className="px-2">
        <Fila label="Ingresos" valor={r.ingresos} icono={<TrendingUp size={16} className="rounded bg-tech-500 p-[2px] text-navy-900" />} />
        <Fila label="Gastos" valor={r.gastos} icono={<TrendingDown size={16} className="rounded bg-alert-500 p-[2px] text-white" />} />
        <Fila label="Ahorro" valor={r.ahorro} icono={<PiggyBank size={16} className="text-gold-400" />} />
      </div>
      <div className={`mc-saldo mt-1.5 flex items-center justify-between rounded-lg border px-3 py-1.5 text-base font-bold sm:text-lg ${neg ? 'border-alert-700 bg-gradient-to-b from-alert-700/70 to-alert-900/80 text-white' : 'border-tech-800 bg-gradient-to-b from-tech-800 to-tech-900 text-white'}`}>
        <span>Saldo</span>
        <span>{cop(r.saldo)}</span>
      </div>
    </button>
  );
}
