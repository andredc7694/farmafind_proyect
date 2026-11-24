# Trazabilidad F01.1

**Estado:** matriz viva; solo se anotan evidencias reales de [evidence.md](evidence.md). Sin puntajes de la rúbrica. Nada aquí equivale a aceptación (T058 es solo de Andre).

| MEJ | HU | RF | FR / SC | Tareas | Pruebas (archivos en `backend/tests/identity/` salvo indicación) | Estado |
|---|---|---|---|---|---|---|
| MEJ-016 | HU24 | RF38–39 | FR-001–008; SC-001–004 | T017–T030 | `f011-staff-create.http`, `f011-us1.rls`, `f011-invitations.http`, `f011-us2.rls`; base: `f011-alias.unit`, `f011-temporary-key.unit`, `f011-staff-policy.unit`, `f011-isolation.rls` | Base lista (lote 1); historias pendientes |
| MEJ-017 | HU25 | RF40–41 | FR-010–012; SC-006–008 | T031–T043 | `f011-recovery.http`, `f011-us3.rls`, `f011-mfa.http`, `f011-us4.rls`; base: `f011-totp.unit`, `f011-secret-box.unit`, `f011-mailbox.unit`, `f011-restricted-session.*` | Base lista (lote 1); historias pendientes |
| MEJ-015 | HU23 | RF37 | FR-009; SC-005 | T037, T041, T043 | `f011-attack-matrix.rls`, `f011-reset-mfa.unit`, `f011-us4.rls` | Verificado técnicamente (aceptación pendiente) |
| MEJ-019 | HU27 | RF44–45 | FR-013–014 | T044–T048 | `f011-profile.http`, `f011-us5.rls` | Verificado técnicamente (aceptación pendiente) |
| Transversal | — | — | FR-015–016; SC-004, SC-008–009 | T005–T008, T014, T049–T057 | `f011-migration.rls`, `f011-isolation.rls`, `f011-audit.rls`; regresión F01/F02/F03/F04 | Migración, RLS y regresión del lote 1 en verde |

## Criterios de la rúbrica (16)

Contribución técnica de F01.1, sin puntajes; no equivale a cumplimiento global del criterio.

| N.º | Criterio | Contribución o límite F01.1 |
|---|---|---|
| 1 | Identificación del problema y requerimientos | spec.md con 16 FR y 9 SC; MEJ-015–017/019. |
| 2 | Análisis y diseño del sistema | plan, data-model, contrato de 26 operaciones, security.md. |
| 3 | Arquitectura de bajo y alto nivel | Clean Architecture verificada por `npm run check`; funciones definer y puertos. |
| 4 | Desarrollo basado en SDD | Spec, clarify, plan y tasks aprobados; 57/58 tareas verificadas; T058 pendiente. |
| 5 | Pruebas unitarias e integración | F01 114/128/135 (unit/api/rls), frontend 134, matriz de ataques y sin secretos. |
| 6 | Pruebas End to End | 6 recorridos Playwright Linux. |
| 7 | Interfaz y experiencia de usuario | Pantallas de personal, invitaciones, recuperación, segundo factor y perfil; revisión humana pendiente. |
| 8 | Escalabilidad del Frontend y backend | Medición Argon2id registrada; sin prueba de escala. |
| 9 | Escalabilidad de Base de datos | Índices/RLS aditivos en TEST; sin prueba de escala. |
| 10 | Dominio/subdominio DNS y CDN | Fuera de F01.1. |
| 11 | Implementación Cache | Sin cambios; regresión F03 sin diferencias. |
| 12 | CI/CD | Comprobaciones locales; sin pipeline. |
| 13 | Pruebas de carga k6 | Fuera del incremento. |
| 14 | Código fuente y base de datos en GitHub | Rama publicada tras cada lote; migraciones 011–016 solo para TEST. |
| 15 | Informe final | evidence.md y convergence.md; aceptación pendiente. |
| 16 | Presentación y dominio del tema | DEMO técnica y guía; revisión humana pendiente. |

## Cobertura de tareas del lote 1

T001 aprobación · T002 esta matriz y `evidence.md` · T003 contrato registrado en `check-openapi-routes.mjs` (`--f011-contract`/`--f011-routes`) · T004 `F01_MFA_KEY_HEX` (`config/mfa.ts`) · T005–T007 migración 011 y RLS · T008 regresión · T009–T013 dominio · T014 auditoría y abuso · T015 simulador de mensajes · T016 sesión restringida.
