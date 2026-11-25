# Tasks: F08.1 — Experiencia integrada por actor

**Input**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [contracts/](contracts/), [research.md](research.md). Casilla `[X]` solo con evidencia real en `evidence.md`. La tarea final de aceptación es solo de Andre.

## Lote 1 — Tema y navegación (base)

- [X] T001 Contrato y comprobación: modo `--f081-contract/--f081-routes` (3 operaciones) en `scripts/integration/check-openapi-routes.mjs` y `npm run verify:contracts:f081` (F081-FR-014).
- [X] T002 [P] Tokens oscuros y modo sistema en `frontend/src/design/tokens.css` y función de contraste `frontend/src/design/contrast.js`; prueba `frontend/tests/f081/contrast.test.js` con razones AA por pares de tokens en ambos temas (F081-FR-008–009; SC-004).
- [X] T003 Controlador de tema `frontend/src/app/theme.js` (aplica `data-theme`, almacenamiento local seguro con `try/catch`, sincroniza con `/me/profile` si hay sesión) y `ThemeSwitcher.jsx` en la cabecera de `AppShell.jsx`; pruebas `frontend/tests/f081/theme.test.jsx` (inmediato, persiste, sin almacenamiento, perfil gana al iniciar sesión, sin datos personales) (F081-FR-008; SC-005).
- [X] T004 Modelo de navegación `frontend/src/app/navigation.js` (función pura por actor: visitante, cliente, trabajador, propietario, revisor; orden del propietario; sin duplicados) y su uso en `AppShell.jsx`/`routes.js`; pruebas `frontend/tests/f081/navigation.test.js` (F081-FR-001–002; SC-001).

## Lote 2 — Paneles y resúmenes (US1)

- [X] T005 Lectura `GET /farmacias/{id}/reservas/resumen` (pendientes, confirmadas, por vencer ≤ 60 min) en `reservas` (caso de uso, repositorio, ruta; capacidad `reservation.read`) (F081-FR-004).
- [X] T006 Lectura `GET /farmacias/{id}/inventario/resumen` (productos, sin stock) en `inventario` (capacidad `inventory.read`) (F081-FR-004).
- [X] T007 Pruebas HTTP y RLS de ambos resúmenes: solo la farmacia propia (conexión única Alfa/Beta), sin capacidad → 403, otra farmacia → 403, sin mutaciones, cifras correctas frente a SQL directo, en `backend/tests/reservations/f081-summary.rls.test.ts` y `backend/tests/inventory/f081-summary.rls.test.ts` + `…http.test.ts` (F081-FR-003–004, 016; SC-001–002).
- [X] T008 Panel de farmacia `PharmacyPanel.jsx` + `PharmacySummary.jsx` (secciones por capacidad compuestas desde los componentes existentes; cambio de farmacia recarga y descarta datos previos) y ruta `/farmacias/panel`; pruebas `frontend/tests/f081/panel.test.jsx` (orden, permisos parciales, cambio de farmacia, revocación) (F081-FR-001–002; SC-001–002).
- [X] T009 Matriz de rutas directas contra el servidor en `backend/tests/identity/f081-direct-routes.rls.test.ts`: cada ruta privada (personal, inventario, importar, reservas, historial, ubicación, resumen) con actores sin permiso, de otra farmacia y cliente → denegada, aunque el menú las oculte (F081-FR-003; SC-001).

## Lote 3 — Búsqueda unificada (US2)

- [X] T010 Sugerencias públicas: `suggest-public.ts` + ruta `GET /busquedas/sugerencias` (reutiliza `search_public_offers`, máx. 8, sin duplicados, límite de tasa) y prueba que un medicamento sin oferta pública no aparece, en `backend/tests/search/f081-suggest.http.test.ts` y `f081-suggest.rls.test.ts` (F081-FR-006; SC-003).
- [X] T011 Cliente y utilidades: `search-client.js` (sugerencias), `comparable.js` (agrupar ofertas comparables y farmacias), estado de filtros en la URL; pruebas en `frontend/tests/f081/search-model.test.js` (F081-FR-005–007).
- [X] T012 Interfaz `PublicSearch.jsx` + `SuggestBox.jsx` (combobox accesible con teclado), filtros plegables, lista/mapa, ubicación puntual con consentimiento y orden por cercanía; pruebas `frontend/tests/f081/search-ui.test.jsx` (teclado, vacío honesto, sin ubicación sigue completa, mensajes) (F081-FR-005–007, 010; SC-003–004).
- [X] T013 Regresión de F03 con y sin Redis (`scripts/f03/check.mjs unit|integration|rls`) y prueba de que la búsqueda responde con la caché caída (F081-FR-007; SC-003, SC-008).

## Lote 4 — Ubicación y chat (US4–US5)

- [X] T014 `PointPicker.jsx` (clic/teclado en el mapa de F07, OpenStreetMap solo tras clic informado) y su uso en `LocationAdmin.jsx` (GPS puntual con consentimiento, manual, confirmación de dirección) y en la búsqueda; sin guardar rastro; pruebas `frontend/tests/f081/point-picker.test.jsx` (F081-FR-010–011).
- [X] T015 `NearbyPharmacies.jsx`: lista sin mapa y sin ubicación (ciudad/dirección manual); pruebas jsdom (F081-FR-011).
- [X] T016 `ChatBubble.jsx` flotante y minimizable en `AppShell` (foco, no tapa contenido, contexto en memoria, preguntas sugeridas por reglas, citas con fecha de ofertas comparables, sin mutaciones); pruebas `frontend/tests/f081/chat-bubble.test.jsx` y de backend F06.1 mock (consulta sin resultados, inyección, cero escrituras) (F081-FR-012–013; SC-006).
- [X] T017 Prueba transversal «las sugerencias solo proponen»: ninguna sugerencia ni respuesta de chat llama a rutas de mutación (espía de red) en `frontend/tests/f081/no-mutation.test.jsx` (F081-FR-013; SC-006).

## Lote 5 — Cierre

- [X] T018 Regresión: `npm run check`, `build`, `verify:contracts` (+ `:f081`), F01/F02/F03/F04/F05 y frontend completos, con resultados reales en `evidence.md` (F081-FR-014, 016; SC-008).
- [X] T019 E2E Playwright Linux en fixture propio (`frontend/e2e/f081-experience.spec.js`, `scripts/f081/*`): cinco actores, teclado (foco visible, sin trampas), 360 px sin desplazamiento horizontal, tema persistente, búsqueda con sugerencias y chat flotante (F081-FR-001, 008–009, 016; SC-004–005, SC-007).
- [X] T020 DEMO manual en TEST con Alfa/Beta ficticias y guía `demo-guide.md`.
- [X] T021 Trazabilidad (`traceability.md`, 16 criterios sin puntajes) y *analyze/converge* (`convergence.md`), corrigiendo contradicciones (todas las FR).
- [X] T022 Preparar `acceptance.md` y solicitar la aceptación humana; **nunca autoaprobar**; registrar la decisión solo cuando Andre responda.

## Dependencias

Lote 1 → 2 → 3 → 4 → 5; `[P]` dentro de su lote. T008 depende de T004–T006; T009 de T005–T008; T012 de T010–T011; T016 de T012; T019 de T018.

## Cobertura

| Requisito | Tareas |
|---|---|
| F081-FR-001, 002 | T004, T008 |
| F081-FR-003 | T007, T009 |
| F081-FR-004 | T005–T008 |
| F081-FR-005, 006, 007 | T010–T013 |
| F081-FR-008, 009 | T002, T003, T019 |
| F081-FR-010, 011 | T012, T014, T015 |
| F081-FR-012, 013 | T016, T017 |
| F081-FR-014, 015 | T001, T018 (revisión de alcance y costos) |
| F081-FR-016 | T007, T009, T013, T017, T019 |
| F081-FR-017 | Sin tareas (fuera de alcance, declarado) |
| SC-001…008 | T002–T019 |
