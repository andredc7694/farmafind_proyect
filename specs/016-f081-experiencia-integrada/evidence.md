# F08.1 — Evidencia (resultados reales, 2026-11-24)

Todo sobre bases TEST efímeras o fixtures marcados (nunca `farmafind_f01_test`). Sin migraciones nuevas.

## Por lote
| Lote | Tareas | Qué se verificó | Resultado |
|---|---|---|---|
| 1 | T001–T004 | Tokens claro/oscuro/sistema con prueba de contraste AA, controlador de tema, modelo de navegación por actor, contrato `--f081-contract/--f081-routes` | pruebas `frontend/tests/f081/{contrast,theme,navigation}` verdes |
| 2 | T005–T009 | Resúmenes de reservas e inventario (solo farmacia propia), panel por capacidades, matriz de rutas directas | `f081-summary.rls` 5, `f081-direct-routes.rls` 7, `f081-summary.http`, `panel.test.jsx` verdes |
| 3 | T010–T013 | Sugerencias públicas (máx. 8, solo campos públicos, con y sin Redis), combobox accesible, filtros en URL, comparables | `f081-suggest.http` 8, `f081-suggest.rls` 5, `search-model`/`search-ui` verdes; F03 verde |
| 4 | T014–T017 | PointPicker (GPS puntual/mapa/teclado), farmacias cercanas sin mapa, burbuja de chat, no mutación | `f081-chat-safety` 6, `point-picker`, `chat-bubble`, `no-mutation`, `nearby` verdes |
| 5 | T018–T020 | Regresión, E2E y DEMO | ver abajo |

## Regresión final (lote 5)
F01 unit 114/114 · F01 api 128/128 · F01 rls 142/142 · F02 unit 15/15 · F02 rls 15/15 · F03 unit 33/33, integración 3/3, rls 9/9 · F04 unit 48/48, api 25/25, rls 31/31 (contenedor f025) · F05 unit 8/8, api 5/5 · F06.1 unit 85/85, api 15/15 · f021-rls 3/3 · frontend 208/208 (48 archivos) · `npm run check` · `build` · contratos: 41 operaciones + F04.1 3 + F08.1 3 documentadas con ruta Express.
No reejecutado: `f05:rls` (la base marcada no admite la reejecución; mismo caso que en F04.1).

## E2E Playwright (Linux, contenedor, fixture propio)
`frontend/e2e/f081-experience.spec.js`: **7/7** — visitante (menú, tema, búsqueda, sugerencias, chat), teclado y 360 px sin desplazamiento horizontal, cliente (tema por perfil), trabajador (panel y denegación del servidor), propietario (8 secciones, resumen, aislamiento Beta), revisor, PointPicker con GPS puntual.

## Pendiente humano
T022 / aceptación de Andre. No se marca por mí.

## Falso positivo de la matriz de rutas en CI (2026-11-28)
- Qué pasó: en el PR #22 (solo documentación), corrida `46132081446`, intento 1, falló «trabajador de Alfa sin permisos». La respuesta era `NOT_VISIBLE` / «Recurso no visible», con `correlationId` `1000d71e-ed99-489e-8690-5f328f91d73b`.
- Causa: la prueba buscaba el texto «1000» (el precio sembrado) en toda la respuesta y el UUID al azar lo contenía. **No hubo fuga de datos.** La otra corrida del mismo commit pasó, y el intento 2 también (repetido con permiso de Andre; PR #22 fusionado en `0f6e252`).
- Arreglo (`backend/tests/identity/f081-direct-routes.rls.test.ts`): se omite solo el campo `correlationId`, y solo si tiene forma de UUID. El resto de la respuesta se revisa igual.
- De paso se corrigió un hueco: el patrón `ficticio` no detectaba «Farmacia ficticia Alfa»; ahora es `fictici[oa]`.
- Autochequeo en el mismo archivo (sin base de datos): 6/6; el identificador del fallo se ignora y las fugas en otros campos, anidadas o metidas en `correlationId` se siguen detectando. La matriz con PostgreSQL se verifica en el trabajo RLS del CI.
