export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const CATEGORIAS_INGRESO = ['Salario', 'Prima', 'Bonificaciones', 'Trabajos adicionales', 'Negocios', 'Mantenimiento de computadores', 'Otros ingresos'];
export const TIPOS_INGRESO = ['Fijo', 'Variable', 'Ocasional'];

export const CATEGORIAS_GASTO = [
  'Alimentación', 'Transporte', 'Combustible', 'Vivienda', 'Servicios públicos', 'Celular e internet', 'Educación', 'Salud',
  'Créditos', 'Tarjetas de crédito', 'Compras personales', 'Entretenimiento', 'Restaurantes', 'Café', 'Snacks', 'Domicilios',
  'Suscripciones', 'Otros',
];
export const HORMIGA = 'Gasto hormiga';
export const DEUDA = 'Pago de deuda';
export const CLASIFICACIONES = ['Necesario', 'Obligatorio', 'Opcional', HORMIGA, DEUDA];
export const FRECUENCIAS = ['Único', 'Diario', 'Semanal', 'Quincenal', 'Mensual'];
export const NECESIDADES = ['Alta', 'Media', 'Baja'];
export const CATEGORIAS_META = ['Fondo de emergencias', 'Viajes', 'Tecnología', 'Estudios', 'Inversión', 'Otros objetivos'];

/** Veces al mes que ocurre un gasto según su frecuencia (solo para PROYECCIONES). */
export const FACTOR_MENSUAL: Record<string, number> = { Único: 1, Diario: 30, Semanal: 4, Quincenal: 2, Mensual: 1 };

/** Categorías y palabras que sugieren automáticamente un gasto hormiga. */
export const CATEGORIAS_HORMIGA = ['Café', 'Snacks', 'Domicilios'];
export const PALABRAS_HORMIGA = ['cafe', 'café', 'tinto', 'snack', 'mecato', 'domicilio', 'antojo', 'bebida', 'gaseosa', 'dulce', 'helado', 'empanada', 'chicle', 'impuls'];
export const CATEGORIAS_DEUDA = ['Créditos', 'Tarjetas de crédito'];

export const COLORES_CATEGORIA = ['#3fd0ee', '#3df06c', '#ffd23f', '#f87171', '#4aa8ff', '#c084fc', '#fb923c', '#2dd4bf', '#f472b6', '#a3e635', '#94a3b8'];
