# Evidencia F07.2 — Revisión de ubicaciones

## T001–T003 · Regla única de «Reemplazada» · 2026-11-27
- Dominio: `replacedProposals` (`application/location-status.ts`): una PENDIENTE con una propuesta más nueva de la misma farmacia, en cualquier estado, queda «Reemplazada» con la fecha de la inmediatamente más nueva. El historial del dueño la usa.
- SQL compartido `NEWER_PROPOSAL_EXISTS` y `REPLACED_AT` (`infrastructure/location-sql.ts`) en `listLatestPending`, `isLatestPending` (ya no solo contra pendientes) y `listHistory` (filtros PENDIENTE y REEMPLAZADA, total incluido). Historial del revisor con `decision: REEMPLAZADA`, fecha de reemplazo y motivo «Se envió una propuesta más reciente».
- `backend/tests/geolocation/f072-replaced.test.ts` **9/9** (caso real con la más nueva aprobada, rechazada o pendiente; tres pendientes; consultas y caso de uso). La **igualdad dueño/revisor** (condición de Andre) se comprueba con PostgreSQL real en T011, que es más fuerte que en memoria.

## T004–T005 · Un solo envío · 2026-11-27
- Servidor: `pg_advisory_xact_lock` por farmacia dentro de la transacción y `findRecentIdentical` (mismo autor, mismos datos, PENDIENTE, sin una más nueva, 10 s) → devuelve la misma propuesta sin insertar ni auditar. `f072-single-submit.test.ts` **3/3**.
- Pantalla: guarda `useRef` contra el doble clic; tras el éxito «Enviar propuesta» queda desactivado mientras no cambie el formulario («Propuesta enviada; cambia algún dato para enviar otra»); si el envío falla se puede reintentar.

## T006–T010 · Búsqueda limitada, aviso de distancia y contrato · 2026-11-27
- Servidor: `centro` opcional y validado; Nominatim con `viewbox` ±0,27° y `bounded=1`; doble control que descarta resultados fuera de la zona; la caché distingue la zona. `f072-search-area.test.ts` **6/6** (con `fetch` falso, sin red).
- `frontend/src/geolocation/distance-check.js`: lista interna F07.1 + 16 distritos de Huamanga, haversine, umbral 30 km; HUAMANFAR real → 571 km de Ayacucho.
- «Mi farmacia»: envía el centro; sin resultados en la zona, «No encontramos esa dirección en Ayacucho. Revisa cómo está escrita o marca el punto tocando el mapa» (texto pedido por Andre, con prueba); ciudad fuera de la lista → «No pudimos limitar la búsqueda…»; aviso de distancia junto al botón sin bloquear.
- «Revisar ubicaciones»: aviso en pendientes e historial; filtro «Reemplazadas».
- `frontend/tests/f072/revision-ubicaciones.test.jsx` **13/13**; prueba de F07.1 ajustada porque ahora la búsqueda envía el centro.
- Contrato `contracts/mi-farmacia.openapi.yaml` 0.2.0 (historial con REEMPLAZADA, búsqueda con `centro`); `f072-contract.test.ts` **2/2**.

## T011 · PostgreSQL real · 2026-11-27
- `scripts/f07/verify-f072.mjs`: base TEST efímera y marcada en el clúster de pruebas, todas las migraciones, usuarios y farmacias ficticios, **borrada al final**. **15/15**:
  - Caso real STUART-FAR (dos propuestas a 4 s): antes, «Pendientes» muestra solo la nueva; al aprobarla, la vieja **no** vuelve; el filtro «Reemplazadas» la muestra con fecha 17:33:46 y motivo.
  - **Igualdad dueño/revisor:** mismas propuestas «Reemplazada» y misma fecha en el historial del dueño.
  - Decidir la vieja → 409 «Propuesta reemplazada». **D-03:** la vieja no se borró ni se modificó (PENDIENTE, versión 1, sin revisor).
  - Envío idéntico → misma propuesta, una fila y una auditoría; propuesta distinta → la anterior queda «Reemplazada»; **dos envíos simultáneos por dos conexiones → una sola fila**.
  - RLS sin cambios: el revisor miembro de STUART-FAR no la ve; el dueño de Beta no puede proponer en STUART-FAR.

## T012 · Regresión · 2026-11-27
- Backend **666** pasan (2 fallos de entorno conocidos de F06.1, que necesitan su base madre); frontend **295/295**; `check` correcto (332 archivos); contratos OpenAPI 41 operaciones; verificación F03.2 con PostgreSQL real 35/35.

## T013 · Copia temporal 3001/5174 · 2026-11-27
- Base efímera propia (marca TEST), sin el Redis compartido. Datos ficticios: «Farmacia Copia Visual» del dueño de prueba (sin ubicación), «STUART-FAR (ficticia)» con la propuesta vieja pendiente y la nueva aprobada, y «Botica Lejana (ficticia)» con una propuesta pendiente en Moquegua que dice «Ayacucho».
- La búsqueda de direcciones usa Nominatim, el servicio gratuito ya aprobado en F07.1 (no se agrega ninguno). En la E2E automática se respondió en el navegador para no llamar al servicio. **Corrección del plan:** el plan decía «geocodificador falso en la copia, como en F07.1»; en F07.1 la copia usaba Nominatim real, y aquí también.
- E2E con Chrome: mensaje orientador y `centro` enviado; aviso de 571 km con el botón habilitado; doble clic → **1** petición y botón desactivado; se reactiva al cambiar un dato; «Pendientes» sin STUART-FAR y con aviso en las lejanas; «Reemplazadas» con STUART-FAR («Reemplazada», motivo); axe sin violaciones graves en las tres vistas; móvil sin desborde; 0 llamadas externas.
- Pendiente: revisión de Andre.

## T014 · Revisión de seguridad y converge · 2026-11-27
- **Sin SQL, sin cambios de RLS ni permisos.** Las consultas nuevas son solo de lectura (`EXISTS` sobre `f07.ubicacion_propuesta`) y respetan las políticas F07 002/007/009; el bloqueo es `pg_advisory_xact_lock`, estándar y sin privilegios nuevos.
- Entrada: `centro` cerrado (dos números dentro del Perú), sin campos extra; los textos siguen con sus límites. El aviso de distancia no envía nada: se calcula en la pantalla con la lista interna.
- Sin servicios, librerías ni costos nuevos. No cambia qué se publica ni quién propone o revisa.
- Converge: FR-001 a FR-011 y FR-013 cumplidos con las pruebas citadas; FR-012 (STUART-FAR) se comprobará en la DEMO tras la aceptación, en solo lectura.

## T015 · Aceptación · 2026-11-27
- Andre: **ACEPTO F07.2**, revisada en la copia temporal. Registrada en `acceptance.md`.
- Copia apagada; se borraron solo su base `farmafind_f01_test_88ad6587efe8` y sus dos usuarios técnicos. La DEMO siguió respondiendo.
- Foto de la DEMO en solo lectura antes de actualizarla: 3 propuestas y 5 auditorías; la de STUART-FAR de 17:33:42 está PENDIENTE, versión 1, sin revisor, con huella `e0522b38…` (md5 de la fila completa) para compararla después.
