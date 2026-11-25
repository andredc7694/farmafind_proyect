# Revisión integrada — Evidencia (resultados reales)
Archivos: `docs/evidencias/integration/review-2026-11/{regression,e2e,load}.txt`; runners `scripts/integration/review-all.ps1`, `review-e2e.ps1`.
- **T001** runner y salida a `review-2026-11/`. · **T002/T003** regresión completa verde (F01 114/128/142, F02 15/15, F03 33/3/9, F04 48/25/37, F05 8/5, F06 24/5, F06.1 85/15, F07 19/11/9 tras refrescar su fixture, f021-rls 3, check, build, contratos 41+26+3+3, frontend 208). Omitidos: `f05:rls`, `f061 integration` aislado.
- **T004** `frontend/e2e/integrated-flow.spec.js`: 4/4 + fase con Redis detenido 1/1.
- **T005** E2E: f01 3/3, f011 6/6, f02 3/3, f021 4/4, f03 2/2, f041 4/4, f061 4/4, f08 8/8, f081 7/7; f04 heredado no reproducible (ver omissions.md #5).
- **T006** axe: 30 escaneos en claro/oscuro; 4/4.
- **T007** hallazgo serio único (`label-content-name-mismatch` en el enlace de marca, todas las pantallas) corregido en `AppShell.jsx` (commit aparte del E2E del hallazgo); reescaneo 0 violaciones. Selectores heredados ajustados en f03, f021, f011 y f04 (cambios exigidos por F04.1/F08.1, no regresiones de producto).
- **T008** k6: F03 p95 68.43 ms (<2000), 0 % fallos; F04 AC05 100 concurrentes → 10 éxitos (sin sobreventa), p95 1021 ms; F06 p95 4.29 ms; F07 p95 12.01 ms. Ver `load.txt` (incluye por qué `f04/load.mjs` no se ejecutó contra la persistente).
- **T009** `matrix-mej.md` (19/19) y `matrix-rubrica.md` (16/16, sin puntajes). **T010** `omissions.md`.
