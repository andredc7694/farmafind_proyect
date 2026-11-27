# Tasks: F03.1: búsqueda simplificada y mapa

Una casilla se marca solo si hay evidencia real en `evidence.md`.

**Estado:** pendiente de la aprobación de Andre. No se toca la DEMO (3000/5173), ni su base, ni su Redis.

## Fase 1 · Servidor y contrato (sin puertos)
- [ ] T001: Repositorio. `farmacia.ubicacion` va con `{latitud, longitud}` solo si las dos coordenadas existen y está activa `exposeVerifiedLocation`; si no, `null`. En la composición, esa opción se enciende solo con `geolocationTest`. Tipo nuevo `PublicOfferPharmacy`. La ficha `/farmacias/{id}` no cambia. Pruebas unitarias. (FR-012, D-01)
- [ ] T002: Validador de la caché con la forma nueva. (FR-012)
- [ ] T003: Prueba de entradas viejas. Una entrada sin `ubicacion` se descarta (métrica `invalid`), se recalcula y se reescribe sin error. Una entrada con la forma nueva da acierto. (Condición de Andre)
- [ ] T004: Contrato. El verificador de rutas y `public-contract.test.ts` leen `specs/022/contracts/public-search.openapi.yaml`. La prueba de contrato comprueba `ubicacion` y la ausencia de campos internos. (FR-012, SC-005)

## Fase 2 · Pantalla (sin puertos; Leaflet falso y sin red)
- [ ] T005: `search-location.js`: redondeo a 3 decimales, y guardar o recuperar solo el nombre de la ciudad, con tolerancia a fallos del almacenamiento. Pruebas. (FR-003, D-05, D-06)
- [ ] T006: `today-hours.js`: estados del horario de hoy en hora de Lima. Pruebas con fechas fijas. (FR-005)
- [ ] T007: `WhereDialog.jsx`: tres opciones, diálogo accesible y casilla de recordar. Pruebas de teclado y de permiso denegado. (FR-002, FR-010)
- [ ] T008: `PublicSearch.jsx` reescrito: buscador grande, línea de ubicación, «Más barato» y «Más cercano» (este último abre el diálogo si falta la ubicación), «Filtros» con los otros órdenes, orden por defecto según D-02 y ningún campo de latitud o longitud. Pruebas. (FR-001 a FR-004, D-02, D-03)
- [ ] T009: `OfferCard.jsx`: tarjeta completa, «Comparar» discreto, «Ubicación no verificada» y «Reservar». Pruebas. (FR-005, D-04, FR-009)
- [ ] T010: `ResultsMap.jsx` e interruptor Lista | Mapa: marcadores propios con texto alternativo, tarjeta emergente, selección conectada, círculo del usuario, encuadre solo a las farmacias, mapa cargado bajo pedido y aviso de privacidad. Diseño de escritorio y celular. Se quita el enlace a `/search/mapa`. Pruebas con Leaflet falso. (FR-006 a FR-011, D-07, D-08)
- [ ] T011: Estilos claro y oscuro, foco visible y 390 px. Se actualizan las pruebas existentes afectadas por el cambio aprobado. (FR-010)

## Fase 3 · Base de datos, navegador y regresión
- [ ] T012: Prueba con PostgreSQL efímero, en el clúster TEST, nunca en `farmafind_f01_test` ni en la DEMO. Una farmacia verificada da coordenadas. Dan `null` una pendiente con coordenadas antiguas, una rechazada y la opción apagada. Una farmacia inactiva no aparece. (FR-012, condición de Andre)
- [ ] T013: Copia temporal 3001/5174 con base efímera y datos ficticios: 3 farmacias verificadas y 1 sin verificar, con ofertas. Sin el Redis compartido.
- [ ] T014: E2E en Chrome con las teselas bloqueadas (sin llamadas externas). Recorrido: búsqueda por precio, elegir Ayacucho, «Más cercano», «Filtros», «Mapa» con 3 marcadores, selección conectada, teclado, 390 px y axe. (SC-001 a SC-004)
- [ ] T015: Regresión: F03 (contrato, caché, orden y RLS), F07, F07.1 y F081; `check`, build, contratos y suites del CI. (FR-014, SC-005)

## Fase 4 · Cierre
- [ ] T016: Mostrar a Andre el resultado en la copia temporal.
- [ ] T017: Revisión de seguridad (sin HTML con datos de farmacias, ni datos nuevos, ni almacenamiento de ubicación). Actualizar `evidence.md`, `convergence.md`, `traceability.md` y `ESTADO.md`. Apagar la copia y borrar su base y sus roles cuando Andre lo indique.
- [ ] T018: **[PUERTA]** Aceptación de Andre en `acceptance.md`. Con su ACEPTO: PR y merge con merge commit, solo si está MERGEABLE y CLEAN, con CI en verde, sin secretos y con la regresión correcta.
