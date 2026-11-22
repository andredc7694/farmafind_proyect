# Tareas F08 — Frontend profesional completo

**Fuentes:** [spec.md](spec.md), [plan.md](plan.md), [contracts/ui-routes.md](contracts/ui-routes.md), Constitution v1.2.0 y contratos F01–F07. **Estado:** especificación y plan aprobados el 2026-11-18; tareas sin verificar al generarse.

Cada casilla requiere comprobación real. Las pruebas con escrituras usarán bases TEST aisladas; F07 permanece TEST/DEMO. F05 no tiene bandeja pública y Gemini real sigue desactivado.

## Fase 1 — Preparación

- [x] T001 Revisar los contratos y los componentes actuales F01–F07 y registrar los puntos de integración en `specs/011-f08-frontend-profesional/research.md` (FR-006–016).
- [x] T002 Crear pruebas de navegación y estados públicos iniciales en `frontend/tests/f08/navigation.test.jsx` (FR-001/002/017; SC-001).

## Fase 2 — Fundamentos compartidos

- [x] T003 Crear tokens de color, tipografía, espaciado, foco y diseño adaptable en `frontend/src/design/tokens.css` (FR-003/004/018).
- [x] T004 Crear componentes reutilizables de botón, tarjeta, estado y campo en `frontend/src/design/Primitives.jsx` (FR-003/005/017/018).
- [x] T005 Crear tabla de rutas y navegación pública/protegida en `frontend/src/app/routes.js` y `frontend/src/app/AppShell.jsx`, conservando la autorización del servidor (FR-001/002/015/016).
- [x] T006 Integrar AppShell con las rutas existentes en `frontend/src/main.jsx` y `frontend/src/style.css`, preservando la comprobación técnica F00 (FR-001–004/020; SC-001).

## Fase 3 — H1 Orientación y acceso público (P1)

**Prueba independiente:** Inicio lleva a búsqueda, mapa TEST y asistente; búsqueda vacía y con ofertas refleja solo F03.

- [x] T007 [US1] Crear Inicio sin estadísticas u ofertas inventadas en `frontend/src/app/Home.jsx` (FR-001/006; SC-006).
- [x] T008 [US1] Mejorar formulario, resultados, comparación, filtros y estados vacíos/error de F03 en `frontend/src/search/PublicSearch.jsx` (FR-005–007/017; SC-001/006).
- [x] T009 [US1] Verificar API/contratos y estados vacíos y con datos de F03 en `frontend/tests/f08/public-search.test.jsx` (FR-006/007/019).

## Fase 4 — H2 Cuenta y contexto autorizado (P1)

**Prueba independiente:** cuenta TEST, perfil y selector funcionan; expiración retira datos privados y Beta se deniega.

- [x] T010 [US2] Mejorar registro, acceso, perfil, salida y mensajes de sesión en `frontend/src/identity/AuthView.jsx` y `frontend/src/identity/IdentityApp.jsx` (FR-005/009/017).
- [x] T011 [US2] Mejorar selector con membresías y estado de farmacia activa confirmada por F01 en `frontend/src/identity/PharmacySelector.jsx` (FR-009/015/016).
- [x] T012 [US2] Verificar 401/403, sesión revocada y cambio Alfa/Beta en `frontend/tests/f08/identity.test.jsx` (FR-009/015–017/019; SC-003).

## Fase 5 — H3 Trabajo en farmacia (P1)

**Prueba independiente:** trabajador TEST autorizado consulta e importa; otro tenant no ve ni modifica sus datos.

- [x] T013 [US3] Mejorar listas, formularios y estados de catálogo, inventario y movimientos en `frontend/src/inventory/InventoryView.jsx` (FR-005/010/015/017).
- [x] T014 [US3] Mejorar previsualización y seguimiento de importación en `frontend/src/inventory/ImportPreview.jsx` y `frontend/src/inventory/ImportHistory.jsx` (FR-010/017).
- [x] T015 [US3] Verificar acciones autorizadas, error y aislamiento con cuentas TEST en `frontend/tests/f08/inventory.test.jsx` (FR-010/015/016/019; SC-003).

## Fase 6 — H4 Reservas personales (P1)

**Prueba independiente:** cliente TEST crea/cancela y farmacia autorizada transiciona; API define estados y vencimiento.

- [x] T016 [US4] Mejorar creación y consulta propias mostrando solo estado/vencimiento de F04 en `frontend/src/reservations/CreateReservation.jsx` y `frontend/src/reservations/OwnReservations.jsx` (FR-011/012/017).
- [x] T017 [US4] Mejorar transiciones y configuración de farmacia con confirmación y errores en `frontend/src/reservations/PharmacyReservations.jsx` (FR-011/012/015).
- [x] T018 [US4] Mostrar exclusivamente estados F04 autorizados, sin crear bandeja F05, en `frontend/src/reservations/ReservationsView.jsx` (FR-013).
- [x] T019 [US4] Verificar estado/vencimiento de API, 401/403/409 y acciones TEST en `frontend/tests/f08/reservations.test.jsx` (FR-011–013/019; SC-003/006).

## Fase 7 — H5 Asistente informativo (P2)

**Prueba independiente:** mock fundamenta respuesta; contenido clínico pendiente se rechaza; búsqueda sigue disponible tras error.

- [x] T020 [US5] Mejorar conversación, fuentes, límites clínicos y fallback en `frontend/src/assistant/ConversationView.jsx` y `frontend/src/assistant/AssistantView.jsx` (FR-014/017).
- [x] T021 [US5] Verificar respuestas fundamentadas, rechazo clínico y error de red sin Gemini en `frontend/tests/f08/assistant.test.jsx` (FR-014/019; SC-006).

## Fase 8 — H6 Ubicación TEST (P2)

**Prueba independiente:** lista funciona sin mapa/permiso; propuesta y revisión TEST requieren actores y capacidades distintos.

- [x] T022 [US6] Mejorar consentimiento, lista, mapa opcional y alternativa por ciudad en `frontend/src/geolocation/NearbyPharmacies.jsx` y `frontend/src/geolocation/PharmacyMap.jsx` (FR-008/017).
- [x] T023 [US6] Mejorar propuesta/revisión por capacidad sin habilitación persistente en `frontend/src/geolocation/LocationAdmin.jsx` (FR-008/015/016).
- [x] T024 [US6] Verificar denegaciones, consentimiento y ausencia de teselas con fixtures TEST en `frontend/tests/f08/geolocation.test.jsx` (FR-008/015/016/019; SC-003).

## Fase 9 — H7 Experiencia transversal (P1)

**Prueba independiente:** recorridos principales en 360/768/1280 px, teclado y zoom 200 %, sin errores graves de accesibilidad.

- [x] T025 [US7] Aplicar estilos de formularios, tablas, estados y adaptación a vistas F01–F07 en `frontend/src/style.css` (FR-003–005/017/018).
- [x] T026 [US7] Añadir pruebas de componentes, foco, etiquetas y mensajes anunciables en `frontend/tests/f08/accessibility.test.jsx` (FR-005/018/019; SC-005).
- [x] T027 [US7] Añadir recorridos Playwright de navegación y responsive en `frontend/tests/f08/journeys.spec.js` (FR-001/004/019; SC-001/002/004).
- [x] T028 [US7] Añadir comprobaciones automáticas de accesibilidad Playwright en `frontend/tests/f08/a11y.spec.js`, tras verificar licencia y versión de la herramienta (FR-018/019; SC-005).

## Fase 10 — Integración y cierre técnico

- [x] T029 Verificar regresión F00–F07, compilación, TypeScript, contratos OpenAPI y auditoría npm; registrar comandos/resultados en `specs/011-f08-frontend-profesional/evidence.md` (FR-019/020; SC-007).
- [x] T030 Verificar RLS real Alfa/Beta, privacidad, ausencia de secretos y límites TEST/DEMO; registrar evidencia en `specs/011-f08-frontend-profesional/evidence.md` (FR-015/016/020; SC-003/006/008).
- [x] T031 Ejecutar E2E F08 en entorno compatible, 360/768/1280 px, teclado, zoom y revisión de accesibilidad; registrar omisiones justificadas en `specs/011-f08-frontend-profesional/evidence.md` (FR-018/019; SC-001/002/004/005).
- [x] T032 Construir matriz requisito/criterio/evidencia y estado de aceptación humana en `specs/011-f08-frontend-profesional/acceptance.md` (FR-001–020; SC-001–008).

## Dependencias y paralelismo

T001–T002 preceden T003–T006. T003–T006 forman la base común. H1–H6 pueden desarrollarse por separado una vez lista la base; H7 integra las vistas y precede a T029–T032. Las tareas de pruebas por historia siguen la implementación afectada cuando verifican el resultado; archivos distintos pueden prepararse en paralelo, pero no se marcan completos sin ejecución. T030 requiere PostgreSQL TEST real; T031 requiere navegador en entorno oficialmente compatible. T032 requiere resultados de T029–T031 y revisión humana posterior para aceptación.

**Incremento mínimo:** T001–T009 entrega navegación, Inicio y búsqueda pública. Ninguna tarea autoriza F09, F10, AWS, Gemini real, privilegios persistentes o cambios de dominio.
