# Matriz MEJ-001–019 → incremento → evidencia (revisión integrada, 2026-11-24)

Estados: **Hecha-TEST/DEMO** = implementada, probada y aceptada por Andre en alcance TEST/DEMO · **Parcial** = una parte entregada, el resto diferido con motivo · **Pendiente** = no entregada. Sin puntajes ni declaración de producción. Evidencia: carpetas `specs/…/evidence.md`, `docs/evidencias/integration/review-2026-11/`.

| MEJ | Qué pide (resumen) | Incremento | Pruebas / evidencia | Estado |
|---|---|---|---|---|
| 001 | Importación XLSX/CSV heterogénea con conciliación | F02.1 (013) | `specs/013-…/evidence.md`; E2E f021 4/4; RLS f021 3/3 | Hecha-TEST/DEMO |
| 002 | Errores claros, sin trazas ni datos privados | F02.1 + F08.1 | pruebas de errores f021; `no-mutation`/UI F08.1; axe sin violaciones | Hecha-TEST/DEMO (alcance importación y UI actual; MEJ-002 fuera de importación sigue pendiente según ESTADO.md) |
| 003 | Menú por actor; ruta directa denegada en servidor | F08.1 (016) | `navigation.test.js`; `f081-direct-routes.rls` 7; E2E f081 7/7 | Hecha-TEST/DEMO |
| 004 | Panel del propietario (8 secciones) | F08.1 | `panel.test.jsx`; E2E propietario; axe en 7 secciones | Hecha-TEST/DEMO |
| 005 | Panel por actor (cliente, trabajador, revisor) | F08.1 + F01.2 (017) | E2E f081; matriz RLS trabajador `f012-worker-delegation.rls` (6); flujo cruzado | Hecha-TEST/DEMO |
| 006 | GPS puntual/pin con confirmación y alternativa manual | F08.1 sobre F07 | `point-picker`, `nearby` tests; E2E PointPicker; F07 rls 9/api 11 | Hecha-TEST/DEMO |
| 007 | Búsqueda comparativa pública | F08.1 sobre F03 | `search-model`, `f081-suggest.*`; flujo cruzado (solo campos públicos); F03 33/3/9; búsqueda con Redis detenido | Hecha-TEST/DEMO |
| 008 | Buscador con sugerencias, filtros, lista/mapa accesibles | F08.1 | `search-ui`; E2E teclado/360 px; axe claro/oscuro | Hecha-TEST/DEMO |
| 009 | Chat flotante minimizable | F08.1 sobre F06.1 mock | `chat-bubble` tests; E2E chat; axe con chat abierto | Hecha-TEST/DEMO (solo `MockAIProvider`) |
| 010 | Herramientas públicas de solo lectura, sin ofertas inventadas | F06.1 (009) + F08.1 | F06 24/5, F061 85/15; `f081-chat-safety` 6; E2E f061 4/4 | Parcial: F06.1 T030/T044 pendientes (sin fuente clínica con revisor); sin contenido farmacológico real |
| 011 | Asistente de solicitud de farmacia (wizard) | F02.5 (012) / F08.1 | F02.5 61/64 | **Pendiente**: depende de aceptar F02.5 (T046, T057, T063) — decidido D-01/D-03 |
| 012 | 12 tipos de sugerencias sin mutar datos | F08.1 | `no-mutation`, `f081-suggest`; 7 de 12 entregadas (1, 2, 5, 8, 9, 10, 12) | Parcial: 3, 4 y 11 diferidas (datos externos / F02.5) |
| 013 | Centro de atención con sondeo, historial y CSV | F04.1 (015) | `f041-http`, `f041-ops.rls`; E2E f041 4/4; flujo cruzado (CSV sin datos del cliente) | Hecha-TEST/DEMO |
| 014 | Preferencia de recogida sin cambiar el vencimiento | F04.1 | `f041-pickup-preference`; E2E f041 | Hecha-TEST/DEMO |
| 015 | Provisión global solo offline TEST (BOOT/GLO) | F01 / F01.1 | F01 rls 142; reset-mfa offline; sin ruta pública | Hecha-TEST/DEMO (persistente/productivo sigue bloqueado) |
| 016 | Cuenta operativa individual por alias/invitación | F01.1 (014) | F01 api 128; E2E f011 6/6 | Hecha-TEST/DEMO |
| 017 | Recuperación, cambio de clave y TOTP del admin | F01.1 | F01 unit 114; E2E f011; Argon2id medido | Hecha-TEST/DEMO (correo simulado en archivo; sin proveedor) |
| 018 | Tema claro/oscuro/sistema, responsive, foco y contraste | F08.1 | `contrast.test.js` (AA); axe 30 escaneos claro/oscuro: 0 violaciones; E2E 360 px | Hecha-TEST/DEMO |
| 019 | Perfil propio, correo revalidado, sesiones | F01.1 | `f081`/F01 rls perfil; E2E f011 perfil | Hecha-TEST/DEMO |

Resumen: 16 hechas en TEST/DEMO (002 con la salvedad indicada), 2 parciales (010, 012), 1 pendiente (011) = 19/19 filas. Ninguna se declara de producción.
