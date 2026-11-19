export type Kind = 'ingreso' | 'gasto' | 'ahorro';

/** Un movimiento real ejecutado. Cada uno se contabiliza UNA sola vez. */
export interface Movimiento {
  id: string;
  kind: Kind;
  fecha: string; // yyyy-mm-dd
  anio: number;
  mes: number; // 1-12
  concepto: string;
  categoria: string;
  valor: number;
  /** ingreso: tipo de ingreso · gasto: clasificación (Necesario, Obligatorio, Opcional, Gasto hormiga, Pago de deuda) */
  tipo: string;
  frecuencia?: string;
  necesidad?: string;
  /** gasto «Pago de deuda»: obligación a la que se abona */
  pasivoId?: string;
  /** ahorro: meta a la que se aporta */
  metaId?: string;
  observaciones?: string;
}

/** Obligación financiera pendiente (registro independiente de los movimientos). */
export interface Pasivo {
  id: string;
  fecha: string;
  anio: number;
  mes: number;
  nombre: string;
  saldoPendiente: number;
  valorCuota: number;
  fechaVencimiento: string;
  cuotasPendientes: number;
  tasaInteres: number;
  observaciones?: string;
}

export interface Meta {
  id: string;
  fecha: string;
  anio: number;
  mes: number;
  nombre: string;
  categoria: string;
  valorObjetivo: number;
  fechaCumplimiento: string;
  aporteMensual: number;
  descripcion?: string;
}

export interface DB {
  movimientos: Movimiento[];
  pasivos: Pasivo[];
  metas: Meta[];
  config: Record<string, string>;
}

export type Entidad = 'ingresos' | 'gastos' | 'ahorros' | 'pasivos' | 'metas';
export type EstadoConexion = 'local' | 'conectando' | 'conectado' | 'error';
