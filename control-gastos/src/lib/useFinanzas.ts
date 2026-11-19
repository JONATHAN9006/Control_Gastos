import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DB, Entidad, EstadoConexion } from '../types';
import { aplicar, getConexion, setConexion, storeLocal, storeSheets, type Registro, type Store } from './api';

export interface Aviso { id: number; tipo: 'ok' | 'error'; texto: string }

export function useFinanzas() {
  const [db, setDb] = useState<DB>({ movimientos: [], pasivos: [], metas: [], config: {} });
  const [estado, setEstado] = useState<EstadoConexion>('conectando');
  const [error, setError] = useState('');
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [version, setVersion] = useState(0); // fuerza reconexión
  const store = useRef<Store>(storeLocal());

  const avisar = useCallback((tipo: Aviso['tipo'], texto: string) => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a, { id, tipo, texto }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'ok' ? 3200 : 7000);
  }, []);

  useEffect(() => {
    let vivo = true;
    const { url, token } = getConexion();
    store.current = url ? storeSheets(url, token) : storeLocal();
    setEstado(url ? 'conectando' : 'local');
    setError('');
    store.current.cargar().then(
      (d) => { if (vivo) { setDb(d); setEstado(url ? 'conectado' : 'local'); } },
      (e: Error) => { if (vivo) { setDb({ movimientos: [], pasivos: [], metas: [], config: {} }); setEstado('error'); setError(e.message); } },
    );
    return () => { vivo = false; };
  }, [version]);

  const destino = () => (store.current.modo === 'sheets' ? 'Google Sheets' : 'este dispositivo');

  /** Solo actualiza la pantalla cuando el almacenamiento confirma. Devuelve true si se guardó. */
  const guardar = useCallback(async (entidad: Entidad, registro: Registro, esNuevo: boolean) => {
    if (estado === 'error' || estado === 'conectando') { avisar('error', 'Sin conexión con Google Sheets: el registro NO se guardó.'); return false; }
    try {
      await store.current.guardar(entidad, registro, esNuevo);
      setDb((d) => aplicar(d, entidad, registro, registro.id));
      avisar('ok', `Guardado en ${destino()}.`);
      return true;
    } catch (e) {
      avisar('error', `${(e as Error).message} El registro NO fue guardado.`);
      return false;
    }
  }, [estado, avisar]);

  const eliminar = useCallback(async (entidad: Entidad, id: string) => {
    if (estado === 'error' || estado === 'conectando') { avisar('error', 'Sin conexión con Google Sheets: no se eliminó nada.'); return false; }
    try {
      await store.current.eliminar(entidad, id);
      setDb((d) => aplicar(d, entidad, null, id));
      avisar('ok', `Eliminado de ${destino()}.`);
      return true;
    } catch (e) {
      avisar('error', `${(e as Error).message} No se eliminó nada.`);
      return false;
    }
  }, [estado, avisar]);

  const guardarConfig = useCallback(async (clave: string, valor: string) => {
    try {
      await store.current.guardarConfig(clave, valor);
      setDb((d) => ({ ...d, config: { ...d.config, [clave]: valor } }));
      return true;
    } catch (e) { avisar('error', (e as Error).message); return false; }
  }, [avisar]);

  const conectar = useCallback((url: string, token: string) => { setConexion(url, token); setVersion((v) => v + 1); }, []);
  const reintentar = useCallback(() => setVersion((v) => v + 1), []);

  return useMemo(() => ({ db, estado, error, avisos, guardar, eliminar, guardarConfig, conectar, reintentar }),
    [db, estado, error, avisos, guardar, eliminar, guardarConfig, conectar, reintentar]);
}
export type Finanzas = ReturnType<typeof useFinanzas>;
