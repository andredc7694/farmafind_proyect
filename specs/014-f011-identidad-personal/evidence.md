# Evidencia de implementación F01.1

Resultados **realmente ejecutados** (PowerShell, Windows 10, Node 24.17.0, PostgreSQL TEST local). Ninguna casilla de `tasks.md` se marca sin una fila aquí. La aceptación humana (T058) es solo de Andre.

## Lote 1 — T001–T016 (2026-11-23)

**Entorno:** PostgreSQL 18 TEST en `127.0.0.1:55431` con **fixture marcado** `F02_FIX01_TEST_ONLY` como conexión administrativa; cada suite crea y elimina su propia base efímera `farmafind_f01_test_<hex>` y su rol. **Sin ninguna operación sobre `farmafind_f01_test`**: sus suites exigen el fixture marcado y rechazan la base persistente (`scripts/f01/fixture-admin-url.mjs`). Contenedores encendidos por Claude y detenidos al terminar; sin borrar volúmenes. Docker sin Redis (no se usa en F01.1).

### Pruebas nuevas del lote (94 satisfactorias)

| Archivo | Tipo | Pruebas | Cubre |
|---|---|---|---|
| `f011-migration.rls.test.ts` | PostgreSQL | 7 | T005/T006: migración 011 aditiva e idempotente; «correo o alias»; alias válido/único; ámbitos de abuso; RLS forzada en 6 tablas; roles sin BYPASSRLS; vigencias (24 h, 7 días) |
| `f011-isolation.rls.test.ts` | PostgreSQL | 7 | T007: invitaciones, credencial temporal, auditoría, perfil, segundo factor y tokens aislados Alfa/Beta; conexión reutilizada sin contexto residual |
| `f011-audit.rls.test.ts` | PostgreSQL | 5 | T014: auditoría de catálogo cerrado (19 acciones), rechazo de campos libres/secretos, actor verificado por la base, presupuesto de abuso por ámbito, solo HMAC en la base |
| `f011-restricted-session.rls.test.ts` | PostgreSQL | 5 | T016: sesión `CAMBIO_CLAVE`/`MFA_PENDIENTE` no ejecuta operaciones de negocio en la transacción de identidad; pool reutilizable |
| `f011-restricted-session.http.test.ts` | HTTP | 16 | T016: lista permitida, 403 uniforme, `no-store`, consulta no evade la lista, falla cerrado (503), cookie inválida |
| `f011-totp.unit.test.ts` | unitaria | 13 | T011: vectores oficiales RFC 6238 (6), ventana ±1, anti-repetición, formato, URI |
| `f011-alias.unit.test.ts` | unitaria | 19 | T009: normalización, límites 3–40, alias inválidos, correo vs alias |
| `f011-temporary-key.unit.test.ts` | unitaria | 6 | T010: 160 bits, 24 h, un solo uso, bloqueo 15 min tras 5 fallos |
| `f011-staff-policy.unit.test.ts` | unitaria | 6 | T013: catálogo delegable = códigos reales de F02/F04, sin auto-concesión, solo TRABAJADOR |
| `f011-secret-box.unit.test.ts` | unitaria | 5 | T012 y T004: AES-256-GCM (contexto, nonce, manipulación) y validación de `F01_MFA_KEY_HEX` sin revelar valores |
| `f011-mailbox.unit.test.ts` | unitaria | 5 | T015: simulador local, solo bajo `.cache`, entrega posterior al commit sin propagar fallos |

### Regresión (T008) — resultados reales tras los cambios del lote

| Comprobación | Resultado |
|---|---|
| `node scripts/f01/check.mjs unit` | 17 archivos, **111/111** (antes del lote: 57) |
| `node scripts/f01/check.mjs api` | 6 archivos, **42/42** (antes: 26) |
| `node scripts/f01/check.mjs rls` (fixture marcado) | 14 archivos, **76/76** (antes: 66) |
| `test:f02:unit` / `test:f02:rls` | 15/15 · 15/15 |
| `test:f03:unit` / `test:f03:rls` | 25/25 · 4/4 |
| `test:f04:unit` / `test:f04:api` | 18/18 · 6/6 |
| `scripts/f025/check-f04-rls.mjs` (clúster F02.5; detenido al terminar) | 18/18 |
| `f021-rls.test.ts` (fixture) | 3/3 |
| `npm run check` | correcto (238 archivos JS, TypeScript estricto, límites modulares) |
| `npm run build` | correcto |
| `npm run verify:contracts` | 41 operaciones con ruta Express (sin cambios) |
| `check-openapi-routes.mjs --f011-contract` | 25 operaciones del contrato F01.1; sin duplicados ni referencias sin definir. `--f011-routes` falla a propósito («rutas pendientes») hasta T049 |

No se ejecutaron en este lote: Playwright/E2E (T053), F05 (`test:f05:*`), DEMO (T055).

## Cambios fuera de las tareas originales (autorizados por Andre: «ejecútalas con el fixture marcado como TEST, sin escrituras sobre farmafind_f01_test»)

1. **Protección de las suites PostgreSQL invertida**: 13 archivos (`backend/tests/identity/*.rls.test.ts` y afines, `inventory/rls-foundation`, `inventory/f021-rls`, `search/public-projection.rls`) ahora exigen un fixture marcado y rechazan `farmafind_f01_test`; `scripts/f01/check.mjs`, `scripts/f02/check.mjs` y `scripts/f03/check.mjs` obtienen la URL del fixture. La parte de F02/F03 está en la rama de F02.1 (commit `3f2f0ac`).
2. `backend/tests/identity/migrations.test.ts`: la lista esperada de migraciones incluye `011_staff_identity.sql`.

## Hallazgos del lote (para *analyze* y *converge*)

- **Permisos de columna de `sesion`**: el rol `f01_runtime` solo lee columnas concretas de `sesion` (migración 004). La primera ejecución de T016 falló con «permission denied for table sesion» al leer la columna nueva; se corrigió añadiendo el `GRANT SELECT` de las dos columnas nuevas en `011`. La prueba `f011-restricted-session.rls` lo cubre.
- **Código de permiso de gestión de personal**: el plan (D-09) lo nombró `personal.gestionar`; el código real usa **`membership.manage`** (delegado al propietario/administrador, EXC-01). La política F01.1 lo reutiliza y lo excluye del catálogo delegable. Corregir el nombre en `research.md` al ejecutar *analyze*.
- **Vinculación directa existente (F01/EXC-01)**: la ruta histórica `POST /pharmacies/{id}/memberships` concede la membresía a un `userId` conocido **sin aceptación del destinatario**. F011-FR-004 exige invitación aceptada. Decidir en US2 (T026/T028) si la ruta histórica se restringe o se deja solo para el flujo de invitación; no se modifica sin aprobación (afecta comportamiento F01 aceptado).
- **Dependencia de migración**: la transacción de identidad ahora lee `sesion.restringida_motivo`; toda base TEST usada con este código requiere la migración 011 (la DEMO de F02.1 sobre el fixture necesitará aplicarla; ver T055). La base persistente `farmafind_f01_test` no se toca ni se migra.
- **Nombres de archivos de prueba**: `scripts/f01/check.mjs` clasifica por sufijo (`.unit.test.ts`, `.http.test.ts`, `.rls.test.ts`); los archivos de T005, T007, T008, T014, T015 y T016 se nombraron en consecuencia (ver notas en `tasks.md`).

## Pendiente (siguientes lotes)

US1 (T017–T024) en adelante. Nada de lo anterior constituye aceptación de F01.1.
