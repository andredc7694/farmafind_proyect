# Matriz de los 16 criterios de la rúbrica (Constitution XIV) — revisión integrada, 2026-11-24

**Sin puntajes, sin ponderaciones y sin declarar cumplimiento académico ni producción** (la columna de puntaje de la rúbrica está vacía). Cada fila enlaza evidencia real o declara lo que falta. Criterios según `specs/001-f00-bootstrap-proyecto/spec.md`.

| N.º | Criterio | Evidencia disponible (localizable) | Límites / pendiente |
|---|---|---|---|
| 1 | Identificación del problema y requerimientos | Documento Maestro v3.2 y `docs/trazabilidad-maestro-v3.2.md`; `spec.md` de cada incremento (001–018); `matrix-mej.md` | Los requisitos de MEJ-011 y sugerencias 3/4/11 siguen sin implementar |
| 2 | Análisis y diseño del sistema | `plan.md`, `research.md`, `data-model.md` y `contracts/` por incremento; contratos OpenAPI verificados (41 + 26 + 3 + 3 operaciones con ruta Express) | — |
| 3 | Arquitectura de bajo y alto nivel | Constitution v2.0.0; Clean Architecture/UoW/Outbox en `backend/src/modules/*`; F05 independiente; ADR en `docs/adr/` | Destino AWS descrito pero **no desplegado** (F09 fuera de alcance) |
| 4 | Desarrollo basado en SDD | Spec Kit por incremento: `spec.md` → `approval.md` → `plan.md` → `tasks.md` → `evidence.md` → `convergence.md` → `acceptance.md` (013–018) | Aprobaciones solo de Andre; F02.5 con 3 tareas humanas pendientes |
| 5 | Pruebas unitarias e integración | `docs/evidencias/integration/review-2026-11/regression.txt`: F01 114/128/142, F02 15/15, F03 33/3/9, F04 48/25/37, F05 8/5, F06 24/5, F06.1 85/15, F07 19/11/9, frontend 208, f021-rls 3, contratos y build | `f05:rls` y `f061 integration` no reejecutados de forma aislada (ver notas del archivo); fixtures F07 actualizadas |
| 6 | Pruebas End to End | `e2e.txt` (resumen consolidado): f01, f011, f02, f021, f03, f041, f061, f08, f081 y flujo cruzado nuevo `integrated-flow` | E2E heredado `f04` no reproducible con su fixture persistente (cubierto por `f041` 4/4); mantenimiento pendiente |
| 7 | Interfaz y experiencia de usuario | F08/F08.1; axe (WCAG 2.0/2.1 A y AA) sobre 30 pantallas/secciones en tema claro y oscuro sin violaciones tras corregir el enlace de marca; E2E teclado y 360 px; `contrast.test.js` | Revisión humana de la DEMO integrada pendiente (aceptación) |
| 8 | Escalabilidad del frontend y backend | Separación frontend/API/F05, configuración por entorno, procesos independientes; k6 local (ver `load.txt`) | Sin evidencia de capacidad productiva |
| 9 | Escalabilidad de base de datos | Índices y restricciones por migración (F02–F04), RLS/FORCE RLS, pool único con aislamiento Alfa/Beta probado | Solo PostgreSQL local de TEST; sin volumen real ni réplicas |
| 10 | Dominio/subdominio DNS y CDN | — | **No realizado** (F09 manual y con autorización expresa de costos) |
| 11 | Implementación de caché | Redis Cache-Aside F03 (TTL, invalidación tras commit); búsqueda pública con Redis detenido en `integrated-flow` y F03 integración 3/3 | Redis local de TEST |
| 12 | CI/CD | Controles locales reutilizables: `npm run check`, `build`, `verify:contracts*`, runner `scripts/integration/review-all.ps1` | **Sin pipeline GitHub Actions** (`.github/workflows` no existe) |
| 13 | Pruebas de carga k6 | `load.txt` (F03, F04, F06 mock, F07) con umbrales originales | Cargas locales de TEST; no predicen producción; ver resultados reales |
| 14 | Código fuente y base de datos en GitHub | Repositorio `andredc7694/farmafind_proyect`, rama `main` con PR #4–#8 fusionados (merge commit); migraciones versionadas en `backend/migrations/` | Ramas de trabajo de la revisión pendientes de fusionar al aceptarse |
| 15 | Informe final | Evidencia consolidada en `docs/evidencias/integration/review-2026-11/` y esta matriz | El informe final del curso no está redactado |
| 16 | Presentación y dominio del tema | Guías de DEMO por incremento (`demo-guide.md`) y la guía integrada de esta revisión | La presentación y su defensa son humanas |
