import { BarChart3, CalendarDays, CloudOff, List, PiggyBank, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ConexionModal, MetaForm, MovimientoForm, PasivoForm } from './components/Forms';
import { Header } from './components/Header';
import { MonthCard } from './components/MonthCard';
import { MovimientosTab } from './components/MovimientosTab';
import { AhorroTab, AnalisisTab, ResumenTab } from './components/OtrasTabs';
import { entidadDe } from './lib/api';
import { MESES } from './lib/constants';
import { capacidadAhorro, estadoMes, resumenAnual, resumenMes } from './lib/finance';
import { useFinanzas } from './lib/useFinanzas';
import type { Kind, Meta, Movimiento, Pasivo } from './types';

type Tab = 'movimientos' | 'resumen' | 'analisis' | 'ahorro';
type ModalState =
  | { t: 'mov'; kind: Kind; inicial?: Movimiento }
  | { t: 'pasivo'; inicial?: Pasivo }
  | { t: 'meta'; inicial?: Meta }
  | { t: 'conexion' }
  | null;

const TABS: { id: Tab; label: string; icono: JSX.Element }[] = [
  { id: 'movimientos', label: 'Movimientos', icono: <List size={18} /> },
  { id: 'resumen', label: 'Resumen', icono: <List size={18} /> },
  { id: 'analisis', label: 'Análisis', icono: <BarChart3 size={18} /> },
  { id: 'ahorro', label: 'Ahorro', icono: <PiggyBank size={18} /> },
];

export default function App() {
  const fin = useFinanzas();
  const { db } = fin;
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState<number | null>(() => (window.matchMedia('(min-width: 1280px)').matches ? hoy.getMonth() + 1 : null));
  const [tab, setTab] = useState<Tab>('movimientos');
  const [modal, setModal] = useState<ModalState>(null);

  const umbral = Number(db.config.umbralAlerta) || 90;
  const anios = useMemo(() => {
    const ys = [hoy.getFullYear(), anio, ...db.movimientos.map((m) => m.anio)];
    const min = Math.min(...ys) - 2, max = Math.max(...ys) + 1;
    return Array.from({ length: max - min + 1 }, (_, i) => max - i);
  }, [db.movimientos, anio]);
  const meses = useMemo(() => MESES.map((_, i) => resumenMes(db, anio, i + 1)), [db, anio]);
  const anual = useMemo(() => resumenAnual(db, anio), [db, anio]);

  // En pantallas pequeñas el detalle ocupa toda la vista: se bloquea el scroll del fondo.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const f = () => { document.body.style.overflow = mes && !mq.matches ? 'hidden' : ''; };
    f(); mq.addEventListener('change', f);
    return () => { mq.removeEventListener('change', f); document.body.style.overflow = ''; };
  }, [mes]);

  const sinConexion = fin.estado === 'error';

  return (
    <div className="mx-auto max-w-[1720px] px-3 py-3 sm:px-5 sm:py-4">
      <Header anual={anual} anio={anio} anios={anios} onAnio={setAnio} estado={fin.estado} onConexion={() => setModal({ t: 'conexion' })} />

      {sinConexion && (
        <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-alert-500 bg-alert-900/60 px-4 py-2.5 text-sm text-white">
          <CloudOff size={20} className="text-alert-300" />
          <span className="flex-1"><b>Sin conexión con Google Sheets.</b> No se muestran ni se guardan registros hasta recuperar la conexión. <span className="text-alert-300">Detalle: {fin.error}</span></span>
          <button className="btn-ghost py-1" onClick={fin.reintentar}>Reintentar</button>
        </div>
      )}

      <div className="flex items-start gap-4">
        <main className={`grid min-w-0 flex-1 grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 `}>
          {MESES.map((nombre, i) => (
            <MonthCard key={nombre} nombre={nombre} r={meses[i]} estado={estadoMes(meses[i], umbral)} activo={mes === i + 1} compacto={!!mes} onClick={() => setMes(i + 1)} />
          ))}
        </main>

        {mes && (
          <aside className="detalle fixed inset-0 z-40 overflow-y-auto bg-navy-900 p-3 xl:sticky xl:inset-auto xl:top-3 xl:z-0 xl:max-h-[calc(100vh-24px)] xl:w-[420px] xl:shrink-0 xl:rounded-2xl xl:border xl:border-turq-500/80 xl:bg-navy-900/90 xl:shadow-[0_0_20px_rgba(34,184,217,.18)] min-[1500px]:w-[560px]">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays size={26} className="text-tech-400" />
              <h2 className="flex-1 text-2xl font-bold text-white">{MESES[mes - 1]} {anio}</h2>
              <button aria-label="Cerrar detalle" className="rounded-lg border border-navy-500 p-1.5 text-white hover:bg-navy-700" onClick={() => setMes(null)}><X size={20} /></button>
            </div>
            <div role="tablist" className="mb-3 grid grid-cols-4 gap-1.5">
              {TABS.map((t) => (
                <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border tab-btn px-0.5 py-2 text-sm font-semibold transition ${tab === t.id ? 'border-tech-400 bg-tech-500 text-navy-950' : 'border-navy-600 bg-navy-800 text-slate-100 hover:border-turq-500'}`}>
                  <span className="tab-ico">{t.icono}</span>{t.label}
                </button>
              ))}
            </div>
            {tab === 'movimientos' && <MovimientosTab db={db} anio={anio} mes={mes} abrirMov={(kind, inicial) => setModal({ t: 'mov', kind, inicial })} eliminarMov={(m) => fin.eliminar(entidadDe(m), m.id)} />}
            {tab === 'resumen' && <ResumenTab db={db} anio={anio} mes={mes} abrirPasivo={(inicial) => setModal({ t: 'pasivo', inicial })} eliminarPasivo={(p) => fin.eliminar('pasivos', p.id)} />}
            {tab === 'analisis' && <AnalisisTab db={db} anio={anio} mes={mes} />}
            {tab === 'ahorro' && <AhorroTab db={db} anio={anio} mes={mes} abrirMov={(kind, inicial) => setModal({ t: 'mov', kind, inicial })} abrirMeta={(inicial) => setModal({ t: 'meta', inicial })} eliminarMeta={(m) => fin.eliminar('metas', m.id)} eliminarMov={(m) => fin.eliminar(entidadDe(m), m.id)} />}
          </aside>
        )}
      </div>

      {modal?.t === 'mov' && mes && <MovimientoForm kind={modal.kind} inicial={modal.inicial} anio={anio} mes={mes} db={db} onClose={() => setModal(null)} onGuardar={(m, nuevo) => fin.guardar(entidadDe(m), m, nuevo)} />}
      {modal?.t === 'pasivo' && <PasivoForm inicial={modal.inicial} onClose={() => setModal(null)} onGuardar={(p, nuevo) => fin.guardar('pasivos', p, nuevo)} />}
      {modal?.t === 'meta' && <MetaForm inicial={modal.inicial} sugerido={mes ? capacidadAhorro(db, anio, mes).porAhorrar : 0} onClose={() => setModal(null)} onGuardar={(m, nuevo) => fin.guardar('metas', m, nuevo)} />}
      {modal?.t === 'conexion' && <ConexionModal estado={fin.estado} error={fin.error} umbral={umbral} onConectar={fin.conectar} onUmbral={(v) => fin.guardarConfig('umbralAlerta', String(v))} onReintentar={fin.reintentar} onClose={() => setModal(null)} />}

      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
        {fin.avisos.map((a) => (
          <div key={a.id} role="status" className={`rounded-lg border px-4 py-2 text-center text-sm font-medium text-white shadow-xl ${a.tipo === 'ok' ? 'border-tech-500 bg-tech-900' : 'border-alert-500 bg-alert-900'}`}>{a.texto}</div>
        ))}
      </div>
    </div>
  );
}
