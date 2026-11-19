/**
 * CONTROL DE GASTOS MENSUAL — Backend en Google Apps Script
 * Base de datos: Google Sheets (script vinculado a la hoja de cálculo).
 *
 * INSTALACIÓN
 *  1. Crea una hoja de cálculo nueva en Google Sheets.
 *  2. Extensiones → Apps Script. Borra el contenido y pega este archivo completo.
 *  3. Ejecuta una vez la función `setup` (crea las 7 hojas con sus encabezados) y autoriza.
 *  4. (Opcional, recomendado) Configuración del proyecto → Propiedades del script →
 *     agrega API_TOKEN con una clave tuya. La app deberá enviar la misma clave.
 *  5. Implementar → Nueva implementación → Aplicación web
 *       Ejecutar como: Yo        Quién tiene acceso: Cualquier usuario
 *  6. Copia la URL que termina en /exec y pégala en la app (botón de conexión).
 *  Cada vez que cambies este código: Implementar → Gestionar implementaciones → editar → Nueva versión.
 *
 * REGLA CONTABLE (igual que en el frontend, evita duplicaciones)
 *  - INGRESOS: dinero recibido.
 *  - GASTOS: todo pago real. Si clasificacion = «Pago de deuda» es un PAGO DE PASIVO y
 *    NO se suma a los egresos de consumo; cualquier otra clasificación es egreso.
 *  - AHORROS: aportes reservados. No son gasto, pero se descuentan del saldo.
 *  - PASIVOS: registro independiente de obligaciones; no mueve dinero por sí mismo.
 *  saldo = ingresos − egresos − pagosPasivos − ahorro
 */

var HOJAS = {
  ingresos: 'INGRESOS',
  gastos: 'GASTOS',
  ahorros: 'AHORROS',
  pasivos: 'PASIVOS',
  metas: 'METAS_AHORRO'
};

var ESQUEMA = {
  INGRESOS: ['id', 'fecha', 'anio', 'mes', 'concepto', 'categoria', 'valor', 'tipo', 'observaciones', 'creado', 'actualizado'],
  GASTOS: ['id', 'fecha', 'anio', 'mes', 'concepto', 'categoria', 'valor', 'clasificacion', 'frecuencia', 'necesidad', 'pasivoId', 'observaciones', 'creado', 'actualizado'],
  AHORROS: ['id', 'fecha', 'anio', 'mes', 'concepto', 'metaId', 'valor', 'observaciones', 'creado', 'actualizado'],
  PASIVOS: ['id', 'fecha', 'anio', 'mes', 'nombre', 'saldoPendiente', 'valorCuota', 'fechaVencimiento', 'cuotasPendientes', 'tasaInteres', 'observaciones', 'creado', 'actualizado'],
  METAS_AHORRO: ['id', 'fecha', 'anio', 'mes', 'nombre', 'categoria', 'valorObjetivo', 'fechaCumplimiento', 'aporteMensual', 'descripcion', 'creado', 'actualizado'],
  CATEGORIAS: ['tipo', 'nombre'],
  CONFIGURACION: ['clave', 'valor']
};

var NUMERICOS = ['anio', 'mes', 'valor', 'saldoPendiente', 'valorCuota', 'cuotasPendientes', 'tasaInteres', 'valorObjetivo', 'aporteMensual'];
var FECHAS = ['fecha', 'fechaVencimiento', 'fechaCumplimiento'];

var CLASIFICACIONES = ['Necesario', 'Obligatorio', 'Opcional', 'Gasto hormiga', 'Pago de deuda'];
var FRECUENCIAS = ['Único', 'Diario', 'Semanal', 'Quincenal', 'Mensual'];
var PAGO_DEUDA = 'Pago de deuda';

var CATEGORIAS_INICIALES = {
  ingreso: ['Salario', 'Prima', 'Bonificaciones', 'Trabajos adicionales', 'Negocios', 'Mantenimiento de computadores', 'Otros ingresos'],
  gasto: ['Alimentación', 'Transporte', 'Combustible', 'Vivienda', 'Servicios públicos', 'Celular e internet', 'Educación', 'Salud', 'Créditos', 'Tarjetas de crédito', 'Compras personales', 'Entretenimiento', 'Restaurantes', 'Café', 'Snacks', 'Domicilios', 'Suscripciones', 'Otros'],
  meta: ['Fondo de emergencias', 'Viajes', 'Tecnología', 'Estudios', 'Inversión', 'Otros objetivos']
};

// ───────────────────────── Instalación ─────────────────────────

/** Crea (o completa) las 7 hojas. Se puede ejecutar varias veces sin perder datos. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(ESQUEMA).forEach(function (nombre) {
    var cols = ESQUEMA[nombre];
    var sh = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#0e2540').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    // Las fechas e identificadores se guardan como texto (yyyy-mm-dd) para que Sheets no los convierta.
    cols.forEach(function (c, i) {
      if (FECHAS.indexOf(c) >= 0 || /Id$|^id$/.test(c)) sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    });
  });
  var cat = ss.getSheetByName('CATEGORIAS');
  if (cat.getLastRow() < 2) {
    var filas = [];
    Object.keys(CATEGORIAS_INICIALES).forEach(function (tipo) {
      CATEGORIAS_INICIALES[tipo].forEach(function (n) { filas.push([tipo, n]); });
    });
    cat.getRange(2, 1, filas.length, 2).setValues(filas);
  }
  var cfg = ss.getSheetByName('CONFIGURACION');
  if (cfg.getLastRow() < 2) cfg.getRange(2, 1, 1, 2).setValues([['umbralAlerta', '90']]);
  var hoja1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (hoja1 && hoja1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(hoja1);
}

// ───────────────────────── Puntos de entrada ─────────────────────────

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    autorizar_(p.token);
    switch (p.action || 'ping') {
      case 'ping':
        return ok_({ hoja: SpreadsheetApp.getActiveSpreadsheet().getName(), fecha: new Date().toISOString() });
      case 'bootstrap':
        return ok_(todo_());
      case 'movimientos':
        return ok_(movimientos_(entero_(p.anio, 'anio'), p.mes ? entero_(p.mes, 'mes') : null));
      case 'resumenMensual':
        return ok_(resumen_(movimientos_(entero_(p.anio, 'anio'), entero_(p.mes, 'mes'))));
      case 'resumenAnual':
        return ok_(resumenAnual_(entero_(p.anio, 'anio')));
      case 'pasivos':
        return ok_(leer_('PASIVOS'));
      case 'metas':
        return ok_(leer_('METAS_AHORRO'));
      case 'categorias':
        return ok_(leer_('CATEGORIAS'));
      case 'config':
        return ok_(config_());
      default:
        throw new Error('Acción no reconocida: ' + p.action);
    }
  } catch (err) {
    return error_(err);
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error('Solicitud vacía.');
    var body;
    try { body = JSON.parse(e.postData.contents); } catch (x) { throw new Error('El cuerpo de la solicitud no es JSON válido.'); }
    autorizar_(body.token);
    lock.waitLock(20000); // una escritura a la vez
    switch (body.action) {
      case 'create':
        return ok_(crear_(hoja_(body.entity), body.data));
      case 'update':
        return ok_(actualizar_(hoja_(body.entity), body.data));
      case 'delete':
        return ok_(eliminar_(hoja_(body.entity), body.id));
      case 'setConfig':
        return ok_(setConfig_(body.clave, body.valor));
      default:
        throw new Error('Acción no reconocida: ' + body.action);
    }
  } catch (err) {
    return error_(err);
  } finally {
    try { lock.releaseLock(); } catch (x) { /* no se había tomado */ }
  }
}

// ───────────────────────── Respuestas y seguridad ─────────────────────────

function ok_(data) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, data: data })).setMimeType(ContentService.MimeType.JSON);
}
function error_(err) {
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String((err && err.message) || err) })).setMimeType(ContentService.MimeType.JSON);
}
function autorizar_(token) {
  var esperado = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (esperado && String(token || '') !== esperado) throw new Error('Clave de acceso incorrecta.');
}
function hoja_(entidad) {
  var nombre = HOJAS[entidad];
  if (!nombre) throw new Error('Entidad no reconocida: ' + entidad);
  return nombre;
}

// ───────────────────────── Acceso a hojas ─────────────────────────

function sheet_(nombre) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!sh) throw new Error('Falta la hoja ' + nombre + '. Ejecuta la función setup en Apps Script.');
  return sh;
}
function fechaTexto_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v == null ? '' : v);
}
function leer_(nombre) {
  var sh = sheet_(nombre);
  var cols = ESQUEMA[nombre];
  var n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, cols.length).getValues()
    .filter(function (f) { return String(f[0]) !== ''; })
    .map(function (f) {
      var o = {};
      cols.forEach(function (c, i) {
        var v = f[i];
        if (FECHAS.indexOf(c) >= 0 || c === 'creado' || c === 'actualizado') o[c] = c === 'creado' || c === 'actualizado' ? (v instanceof Date ? v.toISOString() : String(v)) : fechaTexto_(v);
        else if (NUMERICOS.indexOf(c) >= 0) o[c] = Number(v) || 0;
        else o[c] = String(v == null ? '' : v);
      });
      return o;
    });
}
function filaDe_(sh, id) {
  var n = sh.getLastRow() - 1;
  if (n < 1) return -1;
  var ids = sh.getRange(2, 1, n, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

// ───────────────────────── Validaciones ─────────────────────────

function texto_(v, campo, max, obligatorio) {
  var s = String(v == null ? '' : v).trim();
  if (obligatorio && !s) throw new Error('El campo «' + campo + '» es obligatorio.');
  if (s.length > max) throw new Error('El campo «' + campo + '» supera ' + max + ' caracteres.');
  // Evita que un texto se interprete como fórmula en la hoja.
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
function numero_(v, campo, minimo, estricto) {
  var n = Number(v);
  if (!isFinite(n)) throw new Error('«' + campo + '» debe ser un número.');
  if (estricto ? n <= minimo : n < minimo) throw new Error('«' + campo + '» debe ser ' + (estricto ? 'mayor que ' : 'mínimo ') + minimo + '.');
  return n;
}
function entero_(v, campo) {
  var n = Number(v);
  if (!isFinite(n) || Math.floor(n) !== n) throw new Error('Parámetro «' + campo + '» inválido.');
  if (campo === 'mes' && (n < 1 || n > 12)) throw new Error('El mes debe estar entre 1 y 12.');
  return n;
}
function fecha_(v, campo, obligatoria) {
  var s = String(v == null ? '' : v).trim();
  if (!s && !obligatoria) return '';
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error('«' + campo + '» debe tener formato AAAA-MM-DD.');
  var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) throw new Error('«' + campo + '» no es una fecha real.');
  return s;
}
function enLista_(v, lista, campo) {
  if (lista.indexOf(v) < 0) throw new Error('«' + campo + '» no es válido: ' + v);
  return v;
}

/** Devuelve el registro limpio y validado. Año y mes SIEMPRE se derivan de la fecha. */
function validar_(nombre, d) {
  if (!d || typeof d !== 'object') throw new Error('Faltan los datos del registro.');
  var r = { id: texto_(d.id, 'id', 80, true) };
  r.fecha = fecha_(d.fecha, 'fecha', true);
  r.anio = Number(r.fecha.substring(0, 4));
  r.mes = Number(r.fecha.substring(5, 7));
  switch (nombre) {
    case 'INGRESOS':
      r.concepto = texto_(d.concepto, 'concepto', 80, true);
      r.categoria = texto_(d.categoria, 'categoría', 60, true);
      r.valor = numero_(d.valor, 'valor', 0, true);
      r.tipo = texto_(d.tipo, 'tipo de ingreso', 40, false);
      r.observaciones = texto_(d.observaciones, 'observaciones', 300, false);
      break;
    case 'GASTOS':
      r.concepto = texto_(d.concepto, 'descripción', 80, true);
      r.categoria = texto_(d.categoria, 'categoría', 60, true);
      r.valor = numero_(d.valor, 'valor', 0, true);
      r.clasificacion = enLista_(String(d.clasificacion || ''), CLASIFICACIONES, 'tipo de gasto');
      r.frecuencia = enLista_(String(d.frecuencia || 'Único'), FRECUENCIAS, 'frecuencia');
      r.necesidad = texto_(d.necesidad, 'nivel de necesidad', 20, false);
      // Solo un pago de deuda puede vincularse a un pasivo.
      r.pasivoId = r.clasificacion === PAGO_DEUDA ? texto_(d.pasivoId, 'pasivo', 80, false) : '';
      if (r.pasivoId && filaDe_(sheet_('PASIVOS'), r.pasivoId) < 0) throw new Error('La obligación vinculada ya no existe.');
      r.observaciones = texto_(d.observaciones, 'observaciones', 300, false);
      break;
    case 'AHORROS':
      r.concepto = texto_(d.concepto, 'concepto', 80, true);
      r.metaId = texto_(d.metaId, 'meta', 80, false);
      if (r.metaId && filaDe_(sheet_('METAS_AHORRO'), r.metaId) < 0) throw new Error('La meta de ahorro ya no existe.');
      r.valor = numero_(d.valor, 'valor', 0, true);
      r.observaciones = texto_(d.observaciones, 'observaciones', 300, false);
      break;
    case 'PASIVOS':
      r.nombre = texto_(d.nombre, 'nombre de la obligación', 60, true);
      r.saldoPendiente = numero_(d.saldoPendiente, 'saldo pendiente', 0, true);
      r.valorCuota = numero_(d.valorCuota, 'valor de cuota', 0, true);
      r.fechaVencimiento = fecha_(d.fechaVencimiento, 'fecha de vencimiento', false);
      r.cuotasPendientes = Math.floor(numero_(d.cuotasPendientes || 0, 'cuotas pendientes', 0, false));
      r.tasaInteres = numero_(d.tasaInteres || 0, 'interés', 0, false);
      r.observaciones = texto_(d.observaciones, 'observaciones', 300, false);
      break;
    case 'METAS_AHORRO':
      r.nombre = texto_(d.nombre, 'meta de ahorro', 60, true);
      r.categoria = texto_(d.categoria, 'tipo de objetivo', 60, false);
      r.valorObjetivo = numero_(d.valorObjetivo, 'valor objetivo', 0, true);
      r.fechaCumplimiento = fecha_(d.fechaCumplimiento, 'fecha de cumplimiento', false);
      r.aporteMensual = numero_(d.aporteMensual || 0, 'aporte mensual', 0, false);
      r.descripcion = texto_(d.descripcion, 'descripción', 300, false);
      break;
  }
  return r;
}

// ───────────────────────── CRUD ─────────────────────────

function crear_(nombre, data) {
  var r = validar_(nombre, data);
  var sh = sheet_(nombre);
  if (filaDe_(sh, r.id) > 0) throw new Error('Ya existe un registro con ese identificador.');
  var ahora = new Date();
  r.creado = ahora;
  r.actualizado = ahora;
  var fila = ESQUEMA[nombre].map(function (c) { return r[c] === undefined ? '' : r[c]; });
  var n = sh.getLastRow() + 1;
  var rango = sh.getRange(n, 1, 1, fila.length);
  formatoTexto_(sh, nombre, n);
  rango.setValues([fila]);
  return { id: r.id };
}

function actualizar_(nombre, data) {
  var r = validar_(nombre, data);
  var sh = sheet_(nombre);
  var n = filaDe_(sh, r.id);
  if (n < 0) throw new Error('El registro que intentas editar ya no existe.');
  var cols = ESQUEMA[nombre];
  var actual = sh.getRange(n, 1, 1, cols.length).getValues()[0];
  r.creado = actual[cols.indexOf('creado')];
  r.actualizado = new Date();
  formatoTexto_(sh, nombre, n);
  sh.getRange(n, 1, 1, cols.length).setValues([cols.map(function (c) { return r[c] === undefined ? '' : r[c]; })]);
  return { id: r.id };
}

function eliminar_(nombre, id) {
  if (!id) throw new Error('Falta el identificador del registro.');
  var sh = sheet_(nombre);
  var n = filaDe_(sh, id);
  if (n < 0) throw new Error('El registro que intentas eliminar ya no existe.');
  sh.deleteRow(n);
  // Al borrar un pasivo o una meta, los movimientos conservan su valor pero pierden el vínculo.
  if (nombre === 'PASIVOS') desvincular_('GASTOS', 'pasivoId', id);
  if (nombre === 'METAS_AHORRO') desvincular_('AHORROS', 'metaId', id);
  return { id: id };
}

function desvincular_(nombre, columna, id) {
  var sh = sheet_(nombre);
  var n = sh.getLastRow() - 1;
  if (n < 1) return;
  var col = ESQUEMA[nombre].indexOf(columna) + 1;
  var rango = sh.getRange(2, col, n, 1);
  var vals = rango.getValues();
  var cambio = false;
  for (var i = 0; i < vals.length; i++) if (String(vals[i][0]) === String(id)) { vals[i][0] = ''; cambio = true; }
  if (cambio) rango.setValues(vals);
}

function formatoTexto_(sh, nombre, fila) {
  ESQUEMA[nombre].forEach(function (c, i) {
    if (FECHAS.indexOf(c) >= 0 || /Id$|^id$/.test(c)) sh.getRange(fila, i + 1).setNumberFormat('@');
  });
}

// ───────────────────────── Configuración ─────────────────────────

function config_() {
  var o = {};
  leer_('CONFIGURACION').forEach(function (f) { if (f.clave) o[f.clave] = f.valor; });
  return o;
}
function setConfig_(clave, valor) {
  clave = texto_(clave, 'clave', 40, true);
  valor = texto_(valor, 'valor', 200, false);
  var sh = sheet_('CONFIGURACION');
  var n = filaDe_(sh, clave);
  if (n < 0) sh.appendRow([clave, valor]); else sh.getRange(n, 2).setValue(valor);
  return { clave: clave, valor: valor };
}

// ───────────────────────── Consultas y resúmenes ─────────────────────────

function todo_() {
  return {
    ingresos: leer_('INGRESOS'),
    gastos: leer_('GASTOS'),
    ahorros: leer_('AHORROS'),
    pasivos: leer_('PASIVOS'),
    metas: leer_('METAS_AHORRO'),
    categorias: leer_('CATEGORIAS'),
    config: config_()
  };
}

function movimientos_(anio, mes) {
  var filtro = function (f) { return f.anio === anio && (mes === null || f.mes === mes); };
  return {
    ingresos: leer_('INGRESOS').filter(filtro),
    gastos: leer_('GASTOS').filter(filtro),
    ahorros: leer_('AHORROS').filter(filtro)
  };
}

function resumen_(m) {
  var suma = function (xs) { return xs.reduce(function (a, x) { return a + x.valor; }, 0); };
  var ingresos = suma(m.ingresos);
  var pagosPasivos = suma(m.gastos.filter(function (g) { return g.clasificacion === PAGO_DEUDA; }));
  var egresos = suma(m.gastos.filter(function (g) { return g.clasificacion !== PAGO_DEUDA; }));
  var hormiga = m.gastos.filter(function (g) { return g.clasificacion === 'Gasto hormiga'; });
  var ahorro = suma(m.ahorros);
  var porCategoria = {};
  m.gastos.forEach(function (g) { porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + g.valor; });
  return {
    ingresos: ingresos,
    egresos: egresos,
    pagosPasivos: pagosPasivos,
    gastos: egresos + pagosPasivos,
    ahorro: ahorro,
    saldo: ingresos - egresos - pagosPasivos - ahorro,
    gastosHormiga: { total: suma(hormiga), cantidad: hormiga.length },
    porCategoria: porCategoria,
    movimientos: m.ingresos.length + m.gastos.length + m.ahorros.length
  };
}

function resumenAnual_(anio) {
  var todos = movimientos_(anio, null);
  var meses = [];
  for (var mes = 1; mes <= 12; mes++) {
    var r = resumen_({
      ingresos: todos.ingresos.filter(function (f) { return f.mes === mes; }),
      gastos: todos.gastos.filter(function (f) { return f.mes === mes; }),
      ahorros: todos.ahorros.filter(function (f) { return f.mes === mes; })
    });
    r.mes = mes;
    meses.push(r);
  }
  var total = resumen_(todos);
  total.anio = anio;
  total.meses = meses;
  return total;
}
