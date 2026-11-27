# Tasks: F07.2 — Revisión de ubicaciones

**Estado**: **aprobadas por Andre el 2026-11-27** (commit `c85dab4`). Sin SQL.
Formato: `T000: descripción (requisitos)`. Una casilla se marca solo con evidencia real en `evidence.md`.

## Fase 1 · Regla de «Reemplazada» (D-01 A)
- [ ] T001: Dominio: regla «pendiente con una propuesta más nueva de la misma farmacia, en cualquier estado» en el historial del dueño (`location-status.ts`). Pruebas con el caso real (dos envíos seguidos; la más nueva aprobada, rechazada o pendiente). (FR-003, FR-005)
- [ ] T002: SQL compartido `NEWER_EXISTS` y uso en `listLatestPending`, `isLatestPending` y `listHistory` (filtros PENDIENTE y REEMPLAZADA, total incluido); `decision: REEMPLAZADA` en el historial del revisor. Pruebas. (FR-003 a FR-005)
- [ ] T003: Prueba de igualdad dueño/revisor (condición de Andre) en memoria. (D-01)

## Fase 2 · Un solo envío (D-05 A)
- [ ] T004: Servidor: bloqueo por farmacia en la transacción y devolución de la propuesta idéntica del mismo autor en 10 s, sin insertar ni auditar. Pruebas. (FR-002)
- [ ] T005: Pantalla: guarda contra doble clic y «Enviar propuesta» desactivado tras el éxito mientras no cambie el formulario. Pruebas. (FR-001)

## Fase 3 · Búsqueda limitada y aviso (D-02, D-04, D-06 A)
- [ ] T006: Servidor: `centro` opcional validado en la búsqueda de direcciones; `viewbox` ±0,27° y `bounded=1` en Nominatim; mensaje sin resultados en la zona: «No encontramos esa dirección en Ciudad. Revisa cómo está escrita o marca el punto tocando el mapa» (pedido de Andre, con prueba). Pruebas con `fetch` falso. (FR-006)
- [ ] T007: `distance-check.js` (lista interna + distritos de Huamanga, haversine, umbral 30 km, ciudad desconocida). Pruebas. (FR-007, FR-010)
- [ ] T008: «Mi farmacia»: envía `centro`, aviso de distancia junto al botón y aviso de ciudad no limitada. Pruebas. (FR-006, FR-007, FR-009)
- [ ] T009: «Revisar ubicaciones»: aviso en pendientes e historial; filtro «Reemplazadas». Pruebas. (FR-005, FR-008, FR-009)
- [ ] T010: Contrato `contracts/mi-farmacia.openapi.yaml` actualizado y pruebas de contrato que lo apunten. (FR-005, FR-006)

## Fase 4 · Base real, regresión, copia y aceptación
- [ ] T011: `scripts/f07/verify-f072.mjs` con PostgreSQL real en base efímera marcada (borrada al final): caso STUART-FAR, igualdad dueño/revisor, envíos simultáneos, decidir la vieja → 409, RLS sin cambios. (FR-002 a FR-004, FR-011, D-01)
- [ ] T012: Regresión completa (backend, frontend, `check`, contratos, verificadores F07/F07.1 que correspondan) con resultados reales. (SC-001 a SC-004)
- [ ] T013: Copia temporal 3001/5174 con datos ficticios (doble envío, propuesta colgada, punto lejano); E2E, axe y 0 llamadas externas reales. Andre la revisa. (FR-013)
- [ ] T014: Revisión de seguridad y converge contra la spec. (FR-010, FR-011)
- [ ] T015: Aceptación de Andre en `acceptance.md` (**solo Andre decide**). Después: apagar la copia, PR y merge; actualizar la DEMO con aviso y copia de seguridad, y comprobar en solo lectura que la propuesta de STUART-FAR de 17:33:42 salió de «Pendientes» y aparece «Reemplazada», sin borrarse ni modificarse. (FR-012, D-03 A)
