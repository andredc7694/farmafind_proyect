# F01.1 — Convergencia contra la spec (Spec Kit: analyze + converge)

Fecha: 2026-11-23 · Método: se contrastó cada FR/SC con la evidencia real de [evidence.md](evidence.md). Sin puntajes. No equivale a aceptación.

## Cobertura
| Requisito | Evidencia (pruebas reales) |
|---|---|
| FR-001–003, SC-001–002 (alta, clave temporal, primer ingreso) | `f011-us1.rls`, `f011-staff-create.http`, `f011-temporary-key.unit`, E2E recorridos 1–2 |
| FR-004–007, SC-003–004 (invitaciones, permisos, revocación, no elevación) | `f011-us2.rls`, `f011-invitations.http`, `f011-attack-matrix.rls`, E2E recorrido 3 |
| FR-008, SC-008 (auditoría sin secretos) | `f011-audit.rls`, `f011-no-secrets.rls` |
| FR-009, SC-005 (sin vía para crear administradores) | `f011-us4.rls`, `f011-attack-matrix.rls`, `f011-reset-mfa.unit` (sin ruta ni pantalla) |
| FR-010–011, SC-007 (recuperación indistinguible) | `f011-us3.rls`, `f011-recovery.http`, `f011-attack-matrix.rls`, E2E recorrido 4 |
| FR-012, SC-006 (TOTP del administrador) | `f011-us4.rls`, `f011-mfa.http`, `f011-totp.unit`, E2E recorrido 5 |
| FR-013–014 (perfil, sin roles) | `f011-us5.rls`, `f011-profile.http`, `f011-profile.test.jsx`, E2E recorrido 6 |
| FR-015–016, SC-009 (aislamiento y regresión) | matriz Alfa/Beta con conexión única; regresión F01–F05/F02.1 (ver evidence.md, lote 7) |

## Diferencias respecto a la spec/plan/contrato (todas registradas, ninguna oculta)
1. **Contrato:** 26 operaciones (no 25): se añadió `POST /me/email/verification`; `POST …/mfa/enroll` añade 409; se retiró el 429 de `POST …/staff` (no se implementó límite por IP en la creación; el propietario ya está autenticado y autorizado).
2. **Segundo factor en la base:** `/platform/**` exige factor verificado dentro de `has_platform_permission` (más fuerte que solo el router). Un administrador sin factor activo entra con sesión normal para poder enrolarse (decisión menor reversible).
3. **Auditoría de denegaciones:** se añadió `ELEVATION_DENIED` en intentos de personal sin permiso (la matriz de seguridad lo pedía y no estaba implementado hasta el lote 7).
4. **Capacidad de gestión:** `membership.manage` (el texto original decía `personal.gestionar`); corregido en research/data-model.
5. **Migraciones 011–016** (el plan nombraba solo 011); corregido en data-model/plan.
6. **Ámbitos de abuso** `TEMP_KEY_ACCOUNT` y `STAFF_CREATE_IP` reservados sin uso; el bloqueo de clave temporal reutiliza el del inicio de sesión.
7. **Arquitectura de pruebas:** nombres con sufijos exigidos por `check.mjs` (p. ej. `f011-no-secrets.rls.test.ts`, no `f011-no-secrets.test.ts`).
8. **Cambio de correo no cierra otras sesiones** (la clave sí) — decisión menor registrada en ESTADO.md.

## Límites y riesgos abiertos (no ocultar)
- Las funciones SQL `SECURITY DEFINER` asumen que su propietario puede escribir tablas con FORCE RLS (superusuario/migrador en TEST). **Antes de cualquier base persistente hay que revisarlo (Puerta 6).**
- Mensajería real (correo/SMS) no existe: solo simulador local; un proveedor real requiere autorización (Puerta 5).
- El presupuesto de intentos por IP se comparte tras una misma IP (NAT).
- `f04:rls` y `f05:rls` no se pudieron reejecutar con la base marcada (sus pruebas exigen otra base); últimas ejecuciones verdes en lotes anteriores; este incremento no toca esas rutas.
- La aceptación humana (T058) es solo de Andre.
