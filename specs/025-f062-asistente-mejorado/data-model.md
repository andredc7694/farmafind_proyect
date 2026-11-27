# Data Model — F06.2

**Sin cambios en la base de datos.** Sin tablas, columnas, SQL, RLS ni permisos nuevos. El servidor no guarda conversaciones.

## Contrato de conversación 2.0 (borrador, `contracts/conversation.openapi.yaml`)
- **Petición:** `{ consulta: string(1..500), contexto?: Contexto }`.
- **Contexto** (cerrado, validado; vive solo en la memoria de la página):
  - `intencion`: `PRECIO | CERCANIA | HORARIO | ALTERNATIVA | null`
  - `medicamento`: string ≤ 120 | null
  - `variante`: string ≤ 120 | null (concentración y presentación elegidas)
  - `lugar`: `{ distrito: string de la lista }` | `{ latitud, longitud }` (3 decimales, dentro del Perú) | null
- **Respuesta:** `{ version: '2.0', estado, respuesta, aviso, fuentes, correlationId, proveedor: 'mock', contexto, tarjetas?, opciones?, sugerencia?, verTodas?, emergencia? }`
  - `tarjetas` (≤ 3): `{ etiqueta?, farmacia: { id, nombre, direccion }, producto: { id, nombre, concentracion, presentacion }, precioCentavos, distanciaKm|null, horarioHoy|null, reservarUrl }`
  - `opciones` (≤ 6): `{ texto, consulta }`
  - `sugerencia`: `{ texto: '¿Quisiste decir ibuprofeno?', consulta }`
  - `verTodas`: `{ texto: 'Ver todas en Buscar medicamentos', url: '/search?q=…' }`
  - `emergencia`: `{ mensaje, numeros: [{ servicio, numero }], fuente, verificadoEl }` (excluye tarjetas y opciones)

## Pantalla
- Indicador de panel minimizado: `sessionStorage['farmafind.chat.minimized']` (solo `'1'`/ausente; con try/catch).
- `search-context.js`: ruta, término y lugar actuales de «Buscar medicamentos», en memoria.
