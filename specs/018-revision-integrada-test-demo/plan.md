# Plan: Revisión integrada TEST/DEMO
**Spec**: [spec.md](spec.md). Sin funciones nuevas; solo pruebas, evidencia, documentación y correcciones críticas/serias (D-01=A). US$0.

## Enfoque por capas (modo económico)
1. **Inventario de suites**: listar todos los scripts `scripts/*/check.mjs`, E2E (`f01, f011, f02, f021, f03, f04, f041, f06/f061, f08, f081`) y k6 (`f03`, `f04`, `f06`) existentes; ninguna suite nueva salvo las dos de abajo.
2. **Regresión** por capas, con un runner único `scripts/integration/review-all.ps1`/`.mjs` que arranca/para contenedores TEST autorizados y escribe `docs/evidencias/integration/review-2026-11/*.txt`: unit → API → RLS (cada clúster por separado: F01, F025) → contratos/check/build → frontend → E2E Linux → k6.
3. **Flujo cruzado nuevo** `frontend/e2e/integrated-flow.spec.js` + fixture `scripts/integration/review-harness.mjs` (reutiliza el harness F08.1): Alfa/Beta con oferta publicada, cliente reserva, trabajador delegado acepta, Outbox F05 emite el aviso local, historial y exportación CSV de la farmacia propia, Redis detenido a mitad de flujo (búsqueda sigue), revocar delegación corta acceso, Beta no ve nada de Alfa.
4. **Accesibilidad**: `frontend/e2e/a11y.spec.js` con `@axe-core/playwright` sobre pantallas clave (inicio, búsqueda, mapa/cercanas, login, panel por actor, reservas, importación, chat) en tema claro y oscuro; violaciones críticas/serias se corrigen (D-01=A), el resto se lista.
5. **Carga**: ejecutar k6 F03 y F04 (y F06 mock) con sus umbrales originales; registrar p95, tasa de error y entorno tal cual.
6. **Matrices**: `matrix-mej.md` (19 MEJ → HU → RF → AC → prueba → evidencia o «pendiente») y `matrix-rubrica.md` (16 criterios, sin puntajes) en la carpeta de la spec, enlazando evidencia real.
7. **Informe de omisiones y riesgos** (`omissions.md`) y **DEMO integrada** con `demo-guide.md` por actor; luego `acceptance.md` PENDIENTE de Andre.

## Riesgos
Duración (suite completa larga): se ejecuta por capas y en segundo plano; dos clústeres comparten puerto 55431 (uno a la vez); si un hallazgo exige cambio grande de seguridad/arquitectura → me detengo y presento opciones.
