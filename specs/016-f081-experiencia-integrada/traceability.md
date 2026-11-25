# F08.1 — Trazabilidad (sin puntajes)

| Criterio | Evidencia |
|---|---|
| FR-001 menú por actor | `navigation.test.js`, `panel.test.jsx`, E2E 1/4/5 |
| FR-002 orden del panel del propietario | `navigation.test.js`, E2E propietario |
| FR-003 revalidación en servidor | `f081-direct-routes.rls` (7) |
| FR-004 resumen solo lectura | `f081-summary.{rls,http}`, E2E |
| FR-005 búsqueda comparable | `search-model`, `search-ui`, E2E |
| FR-006 sugerencias públicas | `f081-suggest.{http,rls}` |
| FR-007 filtros colapsables/URL | `search-ui`, E2E |
| FR-008 tema | `theme.test.jsx`, `contrast.test.js`, E2E cliente |
| FR-009 teclado/móvil/contraste | E2E 360 px y teclado |
| FR-010 GPS puntual y punto a mano | `point-picker`, E2E |
| FR-011 cercanas sin mapa | `nearby.test.jsx` |
| FR-012 burbuja de chat | `chat-bubble`, E2E |
| FR-013 solo proponer | `no-mutation`, `f081-chat-safety` (6) |
| FR-014 sin datos nuevos/RLS | sin migraciones; regresión RLS F01–F04 |
| FR-015 US$0 | sin Gemini ni servicios de pago; chat en modo mock |
| FR-016 cobertura de pruebas | `evidence.md` |
| FR-017 fuera de alcance | `convergence.md` H-5 |
SC-001..008 cubiertos por los mismos ítems; SC-008 por la regresión de `evidence.md`.
