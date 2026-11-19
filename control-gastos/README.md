# Control de Gastos Mensual

Aplicación web para registrar ingresos y gastos, controlar gastos hormiga, evaluar compras y fijar metas de ahorro.

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Google Apps Script (aplicación web)
- **Base de datos:** Google Sheets

## 1. Ejecutar

```bash
npm install
npm run dev        # desarrollo
npm run build      # producción en /dist (Netlify, Vercel, hosting estático)
npm test           # pruebas de las fórmulas financieras
```

En Netlify: comando `npm run build`, carpeta de publicación `dist`.

## 2. Conectar Google Sheets

1. Crea una hoja de cálculo nueva en Google Sheets.
2. **Extensiones → Apps Script**, borra el contenido y pega `apps-script/Code.gs` completo.
3. Ejecuta una vez la función **`setup`** y autoriza. Crea las hojas:
   `INGRESOS`, `GASTOS`, `AHORROS`, `PASIVOS`, `METAS_AHORRO`, `CATEGORIAS`, `CONFIGURACION`.
4. (Recomendado) **Configuración del proyecto → Propiedades del script**: agrega `API_TOKEN` con una clave tuya.
   La URL del script es pública; la clave impide que alguien que la conozca lea o escriba tus datos.
5. **Implementar → Nueva implementación → Aplicación web** · Ejecutar como: *Yo* · Acceso: *Cualquier usuario*.
6. Copia la URL que termina en `/exec` y pégala en la app (botón de estado de conexión, bajo el título),
   o en un archivo `.env` (ver `.env.example`).

Cuando cambies `Code.gs`: *Implementar → Gestionar implementaciones → Editar → Nueva versión*.

### Indicador de conexión
| Estado | Significado |
|---|---|
| Google Sheets conectado | Cada registro se guarda en tu hoja. |
| Sin conexión con Sheets | No se muestran ni se guardan registros; la app lo avisa y nunca afirma haber guardado. |
| Modo local · sin Google Sheets | No hay URL configurada: los datos quedan solo en el navegador de ese dispositivo. |

Los datos del modo local no se suben automáticamente al conectar la hoja.

## 3. Regla contable (sin duplicaciones)

| Concepto | De dónde sale |
|---|---|
| Ingresos | Hoja `INGRESOS` |
| Egresos | `GASTOS` cuya clasificación **no** es «Pago de deuda» |
| Pagos de pasivos | `GASTOS` con clasificación «Pago de deuda» (se cuentan solo aquí) |
| Ahorro | Hoja `AHORROS` (dinero reservado; no es gasto) |
| **Saldo disponible** | Ingresos − egresos − pagos de pasivos − ahorro |
| **Presupuesto restante** | Saldo − cuotas por pagar este mes − ahorro programado por aportar |

- Registrar una obligación en `PASIVOS` no mueve dinero; solo lo hace el gasto «Pago de deuda» vinculado.
- La **frecuencia** de un gasto solo alimenta proyecciones (Diario ×30, Semanal ×4, Quincenal ×2); nunca multiplica movimientos reales.
- Año y mes de cada registro se derivan de su fecha, en el servidor.
- Saldo mensual = solo ese mes. Saldo acumulado = desde el primer registro hasta ese mes.

## 4. Estructura

```
apps-script/Code.gs        Backend: doGet, doPost, CRUD, validaciones, resúmenes
src/lib/finance.ts         Motor de cálculo (fórmulas, evaluador, análisis)
src/lib/finance.test.ts    Pruebas de las fórmulas
src/lib/api.ts             Capa de datos: Google Sheets / modo local
src/lib/useFinanzas.ts     Estado y operaciones de guardado
src/components/            Header, MonthCard, pestañas, formularios
```

### API del script
`GET ?action=` `ping` · `bootstrap` · `movimientos&anio&mes` · `resumenMensual&anio&mes` · `resumenAnual&anio` · `pasivos` · `metas` · `categorias` · `config`

`POST` (JSON) `{ action: create|update|delete, entity: ingresos|gastos|ahorros|pasivos|metas, data | id }` · `{ action: setConfig, clave, valor }`

Todas las respuestas son `{ ok: true, data }` o `{ ok: false, error }`.
