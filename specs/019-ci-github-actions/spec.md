# Feature Specification: CI en GitHub Actions (criterio 12 de la rúbrica)

**Feature Branch**: `feat/ci-github-actions`
**Created**: 2026-11-25
**Status**: Borrador, **espera aprobación de Andre**.
**Origen**: `specs/018-revision-integrada-test-demo/matrix-rubrica.md` fila 12 («sin pipeline GitHub Actions»); instrucción de Andre del 2026-11-25 (punto B).

## Qué se construye (lenguaje sencillo)
Un «semáforo automático» en GitHub: cada vez que alguien hace push o abre un PR, GitHub ejecuta solo las comprobaciones del proyecto y muestra verde o rojo. **No despliega nada, no usa secretos, no cuesta nada** (el repositorio es público; los minutos de Actions son gratuitos).

## User Story 1 — Controles estáticos y unitarios en cada push/PR (P1)
En cada `push` (cualquier rama) y `pull_request` hacia `main`, un workflow ejecuta: `npm run check`, `npm run build`, `npm run verify:contracts` (+ `:f011`, `:f041`, `:f081`) y las pruebas unitarias sin base de datos real (F01–F07 unit/API con dobles, frontend con Vitest).
## User Story 2 — Pruebas con PostgreSQL de servicio, si es posible sin costo (P2)
Un segundo job levanta PostgreSQL 18 como contenedor de servicio del propio runner (con `cluster_name` y base marcada TEST como exigen las guardas del proyecto) y ejecuta las suites RLS que se puedan correr de forma reproducible. Si el plan demuestra que alguna no es viable en CI, queda **documentada como omisión**, no oculta.
## User Story 3 — Seguridad mínima del propio pipeline (P1)
Permisos `contents: read` y nada más, sin secretos, sin AWS, sin despliegue, sin servicios de pago, acciones fijadas a una versión exacta, tiempo máximo por job y cancelación de ejecuciones repetidas.

## Requisitos
- **CI-FR-001**: Workflow en `.github/workflows/ci.yml` con disparadores `push` y `pull_request` (a `main`).
- **CI-FR-002**: Node `24.17.0` (el de `engines`) y `npm ci`; caché de npm.
- **CI-FR-003**: Job `static-unit`: check, build, contratos, pruebas unitarias/API sin base real y frontend.
- **CI-FR-004**: Job `postgres-rls` con servicio PostgreSQL 18.6 (imagen oficial ya usada por `compose.*.yaml`), bases efímeras marcadas TEST, **nunca** datos reales ni una base persistente.
- **CI-FR-005**: `permissions: contents: read`; sin `secrets.*`; sin `pull_request_target`; sin pasos de despliegue, publicación ni escritura.
- **CI-FR-006**: Acciones de terceros fijadas por versión exacta (o SHA); `timeout-minutes` por job; `concurrency` con cancelación.
- **CI-FR-007**: El resultado se registra en la evidencia: URL de la ejecución verde y fecha; si algo falla en CI y no en local, se documenta la causa.
- **CI-FR-008**: Sin cambios a código de producto; los ajustes necesarios a scripts de prueba para correr en Linux/CI se listan en el plan.
- **CI-FR-009**: Ni el workflow ni los scripts imprimen contraseñas ni rutas personales en los registros.

## Criterios de éxito
SC-001 el workflow queda verde en una ejecución real sobre la rama del incremento. SC-002 un fallo provocado a propósito (rama de prueba) lo pone en rojo y se descarta. SC-003 el job con PostgreSQL ejecuta al menos las suites RLS de F01 y F02, o se documenta por qué no. SC-004 cero secretos, cero permisos de escritura. SC-005 el criterio 12 de la rúbrica pasa de «sin pipeline» a evidencia localizable.

## Decisiones abiertas (recomendación primero)
- **D-01 · Alcance del job con base de datos**: (A, recomendada) incluirlo como segundo job, empezando por F01 y F02 RLS y ampliando solo lo reproducible; (B) solo estático y unitario por ahora; (C) todas las suites RLS (puede exigir reescribir fixtures).
- **D-02 · Disparadores**: (A, recomendada) `push` en cualquier rama + PR a `main`; (B) solo PR a `main`.
- **D-03 · Protección de rama**: (A, recomendada) **no** activar ahora la regla «exigir CI verde» en `main` (cambia la configuración de GitHub); te la propongo cuando el CI lleve varias ejecuciones verdes; (B) activarla ya.
- **D-04 · Fijación de acciones**: (A, recomendada) por SHA de commit con comentario de versión; (B) por tag mayor (`@v4`).

## Fuera de alcance
Despliegue/CD, AWS, DNS/CDN, secretos, Dependabot, escaneo de código de pago, E2E con Playwright en CI (posible mejora posterior), cambios de producto.
## Riesgos
Las guardas de los scripts de RLS exigen un clúster con `cluster_name` y base marcada: el plan debe reproducirlas en el servicio de Actions sin debilitarlas.
