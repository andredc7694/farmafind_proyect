# Plan: CI en GitHub Actions
**Spec**: [spec.md](spec.md) · Sin despliegue, sin secretos, sin costos. Archivos nuevos: `.github/workflows/ci.yml`, `scripts/ci/prepare-postgres.mjs`, documentación en esta carpeta.

## Diseño del workflow
```
name: CI
on: { push: {}, pull_request: { branches: [main] } }      # D-02 = A
permissions: { contents: read }                            # CI-FR-005
concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }
jobs:
  static-unit:   # Job 1 (P1), ubuntu-24.04, timeout 20 min
    checkout (SHA, persist-credentials:false) → setup-node 24.17.0 (cache npm) → npm ci
    → npm run check → npm run build → verify:contracts, :f011, :f041, :f081
    → unit: f01 f02 f03 f04 f05 f06 f061 f07 (check.mjs unit) → frontend Vitest
  postgres-rls:  # Job 2 (P2), ubuntu-24.04, timeout 30 min
    checkout → setup-node → npm ci → build backend
    → docker run postgres:18.6-bookworm -c cluster_name=farmafind-f025-test (127.0.0.1:55431)
    → scripts/ci/prepare-postgres.mjs (roles, fixture efímero marcado TEST, .cache temporal con secretos aleatorios del runner)
    → F01 rls (check.mjs rls) → F02 rls → [ampliar solo lo reproducible: F03/F04/F07 RLS]
```
## Decisiones de diseño
- Dos jobs independientes para que el verde del Job 1 no dependa del Job 2 (D-01 = A: Job 2 empieza por F01/F02 RLS).
- `docker run` en vez de *service container* (no admite `-c cluster_name`); se espera `pg_isready` con reintentos.
- Los secretos del fixture se generan **aleatorios por ejecución**, viven solo en `.cache/` del runner y nunca se imprimen (`::add-mask::`).
- Las suites que no sean reproducibles en CI se documentan en `omissions.md` de esta carpeta (no se ocultan).
- Sin protección de rama (D-03 = A); se propone después de varias ejecuciones verdes.

## Verificación
1. Ejecutar localmente cada comando del Job 1 con PostgreSQL/Redis detenidos para confirmar qué es realmente «sin base».
2. Subir el workflow a la rama y verificar ejecución verde (`gh run watch`/`gh run view`); registrar URL y fecha.
3. Rama de prueba efímera con un fallo provocado → debe ponerse en rojo → se descarta (SC-002).
4. Revisión de seguridad del YAML (permisos, ausencia de `secrets`, de `pull_request_target`, SHAs).
## Riesgos
Diferencias Windows/Linux en scripts de prueba (rutas, fin de línea; mitigado por `.gitattributes`), tiempos de Argon2 en runners lentos, y que alguna suite RLS exija artefactos que solo existen en la máquina de Andre.
