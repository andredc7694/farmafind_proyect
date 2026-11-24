# Trazabilidad F01.1

**Estado:** matriz viva; solo se anotan evidencias reales de [evidence.md](evidence.md). Sin puntajes de la rúbrica. Nada aquí equivale a aceptación (T058 es solo de Andre).

| MEJ | HU | RF | FR / SC | Tareas | Pruebas (archivos en `backend/tests/identity/` salvo indicación) | Estado |
|---|---|---|---|---|---|---|
| MEJ-016 | HU24 | RF38–39 | FR-001–008; SC-001–004 | T017–T030 | `f011-staff-create.http`, `f011-us1.rls`, `f011-invitations.http`, `f011-us2.rls`; base: `f011-alias.unit`, `f011-temporary-key.unit`, `f011-staff-policy.unit`, `f011-isolation.rls` | Base lista (lote 1); historias pendientes |
| MEJ-017 | HU25 | RF40–41 | FR-010–012; SC-006–008 | T031–T043 | `f011-recovery.http`, `f011-us3.rls`, `f011-mfa.http`, `f011-us4.rls`; base: `f011-totp.unit`, `f011-secret-box.unit`, `f011-mailbox.unit`, `f011-restricted-session.*` | Base lista (lote 1); historias pendientes |
| MEJ-015 | HU23 | RF37 | FR-009; SC-005 | T037, T041, T043 | `f011-no-elevation.http`, `f011-reset-mfa` | Pendiente |
| MEJ-019 | HU27 | RF44–45 | FR-013–014 | T044–T048 | `f011-profile.http`, `f011-us5.rls` | Pendiente |
| Transversal | — | — | FR-015–016; SC-004, SC-008–009 | T005–T008, T014, T049–T057 | `f011-migration.rls`, `f011-isolation.rls`, `f011-audit.rls`; regresión F01/F02/F03/F04 | Migración, RLS y regresión del lote 1 en verde |

## Criterios de la rúbrica (16)

Se registrarán al cierre (T056) con evidencia real; hoy sin puntajes ni afirmaciones.

## Cobertura de tareas del lote 1

T001 aprobación · T002 esta matriz y `evidence.md` · T003 contrato registrado en `check-openapi-routes.mjs` (`--f011-contract`/`--f011-routes`) · T004 `F01_MFA_KEY_HEX` (`config/mfa.ts`) · T005–T007 migración 011 y RLS · T008 regresión · T009–T013 dominio · T014 auditoría y abuso · T015 simulador de mensajes · T016 sesión restringida.
