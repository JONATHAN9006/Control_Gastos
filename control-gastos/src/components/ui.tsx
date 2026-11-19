import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { miles } from '../lib/format';

export function Modal({ titulo, tono = 'turq', onClose, children }: { titulo: string; tono?: 'verde' | 'rojo' | 'turq' | 'oro'; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onClose]);
  const borde = { verde: 'border-tech-500', rojo: 'border-alert-500', turq: 'border-turq-500', oro: 'border-gold-500' }[tono];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={titulo} className={`max-h-[94vh] w-full overflow-y-auto rounded-t-2xl border ${borde} bg-navy-850 shadow-2xl sm:max-w-lg sm:rounded-2xl`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-navy-600 bg-navy-850 px-4 py-3">
          <h3 className="text-base font-bold text-white">{titulo}</h3>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-md p-1 text-slate-300 hover:bg-navy-700"><X size={18} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function Campo({ label, children, ancho = false }: { label: string; children: ReactNode; ancho?: boolean }) {
  return (
    <label className={`block ${ancho ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-xs font-medium text-slate-300">{label}</span>
      {children}
    </label>
  );
}

/** Entrada de dinero con separador de miles ($ 60.000). */
export function Dinero({ value, onChange, className = 'inp', placeholder = '0', autoFocus }: { value: number; onChange: (v: number) => void; className?: string; placeholder?: string; autoFocus?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
      <input
        inputMode="numeric" autoFocus={autoFocus} placeholder={placeholder}
        className={`${className} pl-7`}
        value={value ? miles(value) : ''}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '').slice(0, 13)) || 0)}
      />
    </div>
  );
}

export function Barra({ pct, color = '#3df06c', alto = 8 }: { pct: number; color?: string; alto?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-navy-700" style={{ height: alto }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}

export function Dona({ datos, size = 132, centro }: { datos: { label: string; value: number; color: string }[]; size?: number; centro?: ReactNode }) {
  const total = datos.reduce((a, d) => a + d.value, 0);
  const r = 42, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="-rotate-90" role="img" aria-label="Distribución de gastos por categoría">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#143353" strokeWidth="13" />
        {total > 0 && datos.map((d) => {
          const len = (d.value / total) * c;
          const el = <circle key={d.label} cx="50" cy="50" r={r} fill="none" stroke={d.color} strokeWidth="13" strokeDasharray={`${Math.max(0, len - 1)} ${c - Math.max(0, len - 1)}`} strokeDashoffset={-acc}><title>{d.label}</title></circle>;
          acc += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{centro}</div>
    </div>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-navy-600 px-3 py-4 text-center text-xs text-slate-400">{children}</p>;
}

export function Titulo({ icono, children, extra }: { icono: ReactNode; children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="text-tech-400">{icono}</span>
      <h4 className="flex-1 text-[15px] font-bold text-white">{children}</h4>
      {extra}
    </div>
  );
}
