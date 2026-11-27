# Implementation Plan: F07.2 — Revisión de ubicaciones

**Branch**: `feat/f072-revision-ubicaciones` | **Spec**: `spec.md` (aprobada 2026-11-27, D-01 a D-06 en A)
**Status**: **Aprobado por Andre el 2026-11-27** (commit `c85dab4`).
**SQL**: **ninguno.** Sin migraciones, sin cambios de restricciones, RLS ni permisos (D-01 A).

## Resumen
1. **Una regla única de «Reemplazada»** (D-01 A): una propuesta PENDIENTE está reemplazada si existe otra **más nueva de la misma farmacia, en cualquier estado** (orden por `propuesta_at` y luego `id`). Se aplica igual en el historial del dueño, en «Pendientes» del revisor, en su historial con el filtro nuevo «Reemplazadas» y al decidir.
2. **Un solo envío** (FR-001, FR-002, D-05 A): la pantalla bloquea el doble clic y el reenvío sin cambios; el servidor procesa de a uno los envíos de cada farmacia y devuelve la misma propuesta si llega una idéntica del mismo autor en 10 s.
3. **Búsqueda limitada** (D-02 A): la pantalla envía el centro de la ciudad de la lista interna; el servidor pide a Nominatim solo resultados dentro de un recuadro de ~30 km.
4. **Aviso de distancia** (D-04 A, D-06 A): misma función en «Mi farmacia» y en «Revisar ubicaciones»; > 30 km → «Este punto está a N km de Ciudad. ¿Es correcto?». Solo avisa.

## Revisión constitucional
| Principio | Cumplimiento |
|---|---|
| RLS siempre, sin permisos nuevos | Sin SQL. Las consultas siguen como `f01_runtime` con la sesión verificada; el revisor ya puede leer pendientes y decididas (F07 007/009) y el dueño su propia farmacia. |
| US$0 y sin servicios nuevos | Nominatim ya aprobado en F07.1; `viewbox` y `bounded` son parámetros del mismo servicio. Distancia con la lista interna. |
| Clean Architecture | Regla de reemplazo en dominio y en un fragmento SQL único compartido; aviso de distancia en un módulo de pantalla compartido. |
| Sin datos nuevos publicados | No cambia qué se publica ni quién propone o revisa. |

## Diseño

### Regla de «Reemplazada» (D-01 A, condición de Andre: igual para dueño y revisor)
- **Backend, dominio:** `isReplaced(item, newerExists)` y el recorrido del historial del dueño (`location-status.ts`): hoy solo marca si la más nueva sigue PENDIENTE; pasa a «si existe cualquier propuesta más nueva».
- **Backend, SQL compartido:** un único fragmento `NEWER_EXISTS` (texto constante en `infrastructure/location-sql.ts`) usado por:
  - `listLatestPending` → pendientes **sin** propuesta más nueva;
  - `isLatestPending` → idem al decidir (ya no basta con «no hay otra pendiente más nueva»);
  - `listHistory('REEMPLAZADA')` → pendientes **con** propuesta más nueva; `listHistory('PENDIENTE')` → sin ella. El total usa el mismo filtro.
- **Contrato del historial del revisor:** el filtro y el campo `decision` suman `REEMPLAZADA`; `decididaAt` = fecha de la propuesta que la reemplazó, `decididoPor` = null y motivo «Se envió una propuesta más reciente».
- **Prueba de igualdad (condición de Andre):** con el caso real (dos envíos seguidos y aprobación de la más nueva), el conjunto de propuestas «Reemplazada» del historial del dueño debe ser idéntico al del filtro «Reemplazadas» del revisor, en memoria y con PostgreSQL real.

### Un solo envío (FR-001, FR-002, D-05 A)
- **Pantalla (`LocationAdmin.jsx`):** guarda con `useRef` contra el doble clic en el mismo instante; tras el éxito recuerda la «firma» de lo enviado (dirección, ciudad, coordenadas a 6 decimales, fuente) y deja «Enviar propuesta» desactivado mientras el formulario no cambie, con el texto «Propuesta enviada; cambia algún dato para enviar otra».
- **Servidor (`manage-pharmacy-location.ts` + repositorio):** dentro de la misma transacción, `pg_advisory_xact_lock` por farmacia (función estándar de PostgreSQL, sin permisos nuevos) y búsqueda de una propuesta PENDIENTE idéntica del mismo autor de los últimos 10 s. Si existe, se devuelve esa (mismo `id` y `estado`) sin insertar ni auditar. Si no, se inserta como hoy (y la anterior queda «Reemplazada» por la regla).

### Búsqueda limitada (D-02 A)
- **Pantalla:** si la ciudad escrita está en la lista interna (`peru-cities.js` + distritos de Huamanga de `search-places.js`), envía `centro: { latitud, longitud }` junto con dirección y ciudad. Si no está, envía como hoy y muestra «No pudimos limitar la búsqueda a "X": no está en nuestra lista de ciudades».
- **Servidor (`address-suggestions.ts`, router y `nominatim-geocoder.ts`):** valida `centro` (opcional, dentro del Perú), arma `viewbox` de ±0,27° (~30 km) y `bounded=1`. Sin centro, igual que hoy. Sin resultados en la zona: «No encontramos esa dirección en Ciudad. Revisa cómo está escrita o marca el punto tocando el mapa» (texto pedido por Andre).
- La búsqueda inversa (clic en el mapa) no cambia.

### Aviso de distancia (FR-007 a FR-009, D-04 A, D-06 A)
- Módulo nuevo `frontend/src/geolocation/distance-check.js`: busca la ciudad en la lista interna (sin tildes ni mayúsculas), calcula la distancia en línea recta (haversine, redondeo a km) y devuelve `{ tipo: 'lejos', km, ciudad }`, `{ tipo: 'desconocida', ciudad }` o `null`.
- «Mi farmacia»: aviso visible junto a «Enviar propuesta» (`role="status"`), que se actualiza al mover el punto o cambiar la ciudad. No bloquea.
- «Revisar ubicaciones»: el mismo aviso en cada propuesta pendiente y en las filas del historial, antes de los botones de decisión. No bloquea.

### Contratos
- `contracts/mi-farmacia.openapi.yaml` (copia de la 021 con cambios): historial del revisor con `REEMPLAZADA` en filtro y `decision`; cuerpo de la búsqueda de direcciones con `centro` opcional. Sin otros cambios.

## Pruebas
- **Backend unitarias:** regla de reemplazo (dos envíos seguidos, la más nueva aprobada, rechazada o pendiente); idempotencia del envío (idéntico en 10 s, distinto, otro autor, pasados 10 s); validación de `centro`; parámetros `viewbox`/`bounded` de Nominatim con un `fetch` falso (sin red).
- **PostgreSQL real** (`scripts/f07/verify-f072.mjs`, base TEST efímera marcada, borrada al final): caso real STUART-FAR (dos envíos seguidos y aprobación) → «Pendientes» sin la vieja, filtro «Reemplazadas» con la vieja, historial del dueño igual; dos envíos idénticos simultáneos → una fila; decidir la vieja → 409 «Propuesta reemplazada»; RLS: miembro de la farmacia sigue sin ver su farmacia como revisor.
- **Frontend:** botón desactivado tras el éxito y reactivado al cambiar; aviso de distancia en ambas pantallas; ciudad desconocida; la búsqueda envía `centro`.
- **Regresión:** backend y frontend completos, `check`, contratos.
- **Copia temporal 3001/5174** con datos ficticios: doble envío, una propuesta vieja colgada y un punto a cientos de km; E2E con Chrome, axe y 0 llamadas externas reales (la búsqueda de direcciones usa un geocodificador falso en la copia, como en F07.1).

## Después de la aceptación
- PR y merge con las condiciones de siempre.
- Actualizar la DEMO con aviso previo y copia de seguridad (sin migraciones nuevas). **Comprobar en solo lectura** que la propuesta de STUART-FAR de 17:33:42 salió de «Pendientes» y aparece «Reemplazada», sin haberse borrado ni modificado (D-03 A).
- Andre corrige la ubicación de HUAMANFAR probando la búsqueda limitada y el aviso.

## Riesgos
- Nominatim con `bounded=1` puede no encontrar direcciones mal escritas: queda el mapa y el mensaje claro.
- El recuadro de ±0,27° es aproximado (más ancho en longitud cerca del ecuador); el aviso usa la distancia real.
- Ciudades fuera de la lista: sin límite ni aviso de distancia, con mensaje explícito.
