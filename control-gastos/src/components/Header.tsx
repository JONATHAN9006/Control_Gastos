import { BarChart3, CalendarDays, ChartNoAxesCombined, ChevronDown, Cloud, CloudOff, HandCoins, HardDrive, Loader2, ShoppingCart, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Resumen } from '../lib/finance';
import { cop } from '../lib/format';
import type { EstadoConexion } from '../types';

function Tarjeta({ icono, label, valor, clase }: { icono: ReactNode; label: string; valor: number; clase: string }) {
  return (
    <div className={`flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2 shadow-card ${clase}`}>
      <span className="shrink-0">{icono}</span>
      <div className="min-w-0">
        <div className="truncate text-xs text-slate-200 sm:text-[13px]">{label}</div>
        <div className="truncate text-base font-bold text-white sm:text-lg xl:text-xl">{cop(valor)}</div>
      </div>
    </div>
  );
}

export function Conexion({ estado, onClick }: { estado: EstadoConexion; onClick: () => void }) {
  const cfg = {
    conectado: { c: 'border-tech-600 text-tech-300', i: <Cloud size={14} />, t: 'Google Sheets conectado' },
    conectando: { c: 'border-turq-700 text-turq-300', i: <Loader2 size={14} className="animate-spin" />, t: 'Conectando…' },
    error: { c: 'border-alert-500 text-alert-300', i: <CloudOff size={14} />, t: 'Sin conexión con Sheets' },
    local: { c: 'border-gold-500/70 text-gold-300', i: <HardDrive size={14} />, t: 'Modo local · sin Google Sheets' },
  }[estado];
  return (
    <button onClick={onClick} title="Configurar conexión con Google Sheets" className={`inline-flex items-center gap-1.5 rounded-full border bg-navy-900/70 px-2.5 py-1 text-[11px] font-medium hover:bg-navy-800 ${cfg.c}`}>
      {cfg.i}<span>{cfg.t}</span>
    </button>
  );
}

export function Header({ anual, anio, anios, onAnio, estado, onConexion }: { anual: Resumen; anio: number; anios: number[]; onAnio: (a: number) => void; estado: EstadoConexion; onConexion: () => void }) {
  return (
    <header className="mb-4 flex flex-col gap-3 border-b border-navy-700/70 pb-4 2xl:flex-row 2xl:items-center">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[3px] border-tech-500 text-tech-400 shadow-[0_0_14px_rgba(43,255,94,.35)]">
          <ChartNoAxesCombined size={28} strokeWidth={2.4} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold leading-tight text-white sm:text-2xl">Control de Gastos Mensual</h1>
          <p className="text-xs text-slate-200 sm:text-sm">Registra tus ingresos, gastos y analiza tus gastos hormiga</p>
          <div className="mt-1"><Conexion estado={estado} onClick={onConexion} /></div>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-4">
        <Tarjeta label="Ingresos Anuales" valor={anual.ingresos} clase="border-tech-600/80 bg-gradient-to-b from-tech-900/80 to-navy-900" icono={<Wallet size={30} className="text-tech-400" />} />
        <Tarjeta label="Gastos Anuales" valor={anual.gastos} clase="border-alert-700 bg-gradient-to-b from-alert-900/80 to-navy-900" icono={<ShoppingCart size={30} className="text-alert-400" />} />
        <Tarjeta label="Ahorro Anual" valor={anual.ahorro} clase="border-gold-800 bg-gradient-to-b from-gold-900/90 to-navy-900" icono={<HandCoins size={30} className="text-gold-400" />} />
        <Tarjeta label="Saldo Anual" valor={anual.saldo} clase="border-sky2-500/50 bg-gradient-to-b from-sky2-900/80 to-navy-900" icono={<BarChart3 size={30} className="text-sky2-400" />} />
      </div>
      <label className="relative flex items-center gap-2 self-start rounded-xl border border-navy-500 bg-navy-800 px-3 py-2.5 shadow-card 2xl:self-auto">
        <CalendarDays size={22} className="text-slate-200" />
        <span className="text-sm text-slate-200">Año:</span>
        <select aria-label="Año" value={anio} onChange={(e) => onAnio(Number(e.target.value))} className="cursor-pointer appearance-none bg-transparent pr-6 text-lg font-bold text-white outline-none">
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <ChevronDown size={18} className="pointer-events-none absolute right-3 text-slate-200" />
      </label>
    </header>
  );
}
