# Implementation Plan: F01.1 — Identidad y personal de farmacia

**Branch**: `feat/f011-identidad-personal` (rama temporal local; el ruleset de `main` exige PR) | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)
**Status**: Borrador de plan — **pendiente de aprobación del responsable (Puerta 3)**. Spec Kit: *plan* completado; siguiente, *tasks* tras la aprobación. No autoriza código.

## Summary

Extender F01 sin reescribirlo: cuentas operativas de personal con alias y clave temporal de un solo uso (24 h), invitaciones para vincular cuentas existentes, permisos por farmacia con revocación inmediata, recuperación de acceso, segundo factor TOTP solo para administradores generales, y perfil con seguridad personal. Se reutiliza lo ya aprobado: sesiones y cookies de F01, membresías y delegaciones (EXC-01/ROL-01), GLO-01/BOOT-01, RLS con roles `f01_auth` y `f01_runtime`, tabla de abuso y Argon2id. Todo se prueba en PostgreSQL TEST efímero con Alfa y Beta.

## Technical Context

**Language/Version**: Node.js 24.17.0, npm 11.13.0, TypeScript 5.9.3; React 19.2.7/JSX y Vite 7.3.8 (manifests F00).
**Primary Dependencies**: reutilizar Express 5.2.1, `pg@8.23.1`, Argon2id existente (`argon2-password.ts`) y `node:crypto`. **Ninguna dependencia nueva**: TOTP (RFC 6238) y cifrado AES-256-GCM del secreto se implementan con `node:crypto` y se prueban con los vectores oficiales (ver research D-04).
**Storage**: PostgreSQL; migración aditiva `backend/migrations/f01/011_staff_identity.sql` (ver [data-model.md](data-model.md)). Las tablas nuevas usan RLS y `FORCE ROW LEVEL SECURITY` como las de F01. Sin Redis nuevo.
**Testing**: Vitest (unitarias de política y TOTP), HTTP con supertest, PostgreSQL TEST efímero con RLS Alfa/Beta, concurrencia (doble uso de clave, doble aceptación), matriz de ataques, E2E en navegador compatible (Playwright Linux en contenedor) y regresión F01/F02/F04/F05.
**Target Platform**: Windows 10 para desarrollo; E2E Playwright en Linux de contenedor. Sin AWS ni Gemini.
**Project Type**: monolito modular: módulo `usuarios` (backend) y `frontend/src/identity` (React).
**Performance Goals**: no se define umbral nuevo; se mide el costo de verificar Argon2id con los parámetros ya aprobados en F01 y se registra. Sin carga masiva en este incremento.
**Constraints**: cero acceso cruzado Alfa/Beta; contexto de farmacia solo en el servidor; claves y secretos nunca en registros, auditoría ni respuestas posteriores; mensajes de cuenta solo por simulador local en TEST; no tocar `farmafind_f01_test` (Constitution + instrucción vigente).
**Scale/Scope**: 5 historias, 16 FR, 9 SC; ~25 operaciones HTTP nuevas; 7 tablas nuevas y 2 alteradas.

## Constitution Check

| Principio | Comprobación de diseño | Estado |
|---|---|---|
| I, XVII–XVIII: SDD, una funcionalidad, aprobación previa | Spec aprobada y clarificada (2026-11-23); F02.1 aceptada. Código solo tras aprobar plan y tareas. | Pasa |
| II, IV–VI: módulos, stack, Clean Architecture | Capas `domain → application → infrastructure/presentation` en `usuarios`; React/Vite/JSX; Express+TS. | Pasa |
| VII–VIII, XX: PostgreSQL, RLS, aislamiento, datos ficticios | RLS en tablas nuevas; sin `BYPASSRLS`; roles `f01_auth` (global limitado) y `f01_runtime` (tenant). Datos ficticios; sin PII real. | Pasa en diseño; falta prueba real |
| IX: Redis Cache-Aside | No se usa Redis ni se cachean datos de identidad. | N/A |
| X: Unit of Work, Outbox, Notificaciones independientes | Altas, permisos y revocaciones atómicas en Unit of Work. Mensajes de cuenta: puerto de entrega con adaptador **simulador local**; **no se extiende F05 en este incremento** (decisión D-06, a confirmar). Falla del simulador no bloquea la operación. | **Decisión abierta D-06** |
| XII: AWS | No se crea ni toca ningún recurso AWS. | Pasa |
| XIII: pruebas según riesgo | Matriz de abuso/elevación, concurrencia, RLS, TOTP con vectores oficiales, E2E. | Pasa en diseño |
| XVI: Git | Rama temporal; integración por PR cuando el responsable lo confirme (Puerta 2). | Pasa |

**Re-evaluación posdiseño**: el diseño de [data-model.md](data-model.md) y [contracts/](contracts/) mantiene las puertas anteriores. Cualquier cambio a RLS, roles de base de datos, el contrato de login existente o F05 requiere nueva revisión humana (Puerta 6).

## Decisiones de diseño clave (detalle en [research.md](research.md))

1. **Alias + correo opcional**: `usuario` admite `alias_canonico` y `email_canonico` opcional (al menos uno). El login acepta `identifier` y conserva el campo `email` histórico (compatibilidad).
2. **Clave temporal en tabla propia** (una por usuario, hash Argon2id, `expira_at` = +24 h, `consumida_at`). El primer ingreso la consume y abre una **sesión restringida** que solo permite cambiar la clave.
3. **Invitación de vinculación**: el propietario escribe un correo; la respuesta es siempre la misma exista o no la cuenta (anti-enumeración); la persona acepta desde «Mis invitaciones».
4. **Revocación inmediata**: cada petición ya revalida membresía y delegación (F01); al revocar se cierran las sesiones del trabajador si deja de tener cualquier membresía y se limpia su farmacia activa si era esta.
5. **TOTP solo administradores generales**: sesión con `mfa_verificada_at`; las rutas de plataforma exigen sesión con segundo factor verificado. Reinicio solo por procedimiento técnico offline (extiende BOOT-01), sin pantalla ni códigos de respaldo.
6. **Mensajes por simulador local**: archivo JSON-lines ignorado por Git en `.cache/`, leído con un script (`scripts/f01/mailbox.mjs`); sin ruta HTTP de lectura.
7. **Avatar**: elección entre un conjunto fijo de avatares predefinidos (sin subir archivos), para no introducir almacenamiento de archivos.

## Project Structure

### Documentation (this feature)

```text
specs/014-f011-identidad-personal/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/ (identity-staff.openapi.yaml, security.md)
├── checklists/requirements.md
├── approval.md                      # aprobaciones con fecha y alcance
└── tasks.md · evidence.md · acceptance.md   # pasos posteriores de Spec Kit
```

### Source Code (repository root)

```text
backend/migrations/f01/011_staff_identity.sql
backend/src/modules/usuarios/
├── domain/        # alias, política de clave temporal, TOTP (RFC 6238), política de invitaciones y permisos
├── application/   # CreateStaffAccount, IssueTemporaryKey, InviteStaff, RespondInvitation, ChangePassword,
│                  # RequestPasswordReset, ConfirmPasswordReset, EnrollMfa, VerifyMfa, UpdateProfile, ManageOwnSessions
├── infrastructure/# repositorios SQL, cifrado del secreto (AES-256-GCM), simulador de mensajes
└── presentation/  # staff-router, profile-router, mfa-router; extensión del auth-router
backend/tests/identity/f011-*.test.ts
scripts/f01/       # mailbox.mjs (simulador), reset-mfa.mjs (procedimiento técnico offline, solo TEST)
frontend/src/identity/  # StaffAdmin, MyInvitations, ForcedPasswordChange, Profile, MfaEnroll; login con «Usuario o correo»
frontend/tests/f011-*.test.jsx · frontend/e2e/f011-*.spec.js
```

**Structure Decision**: sin módulo nuevo; se extiende `usuarios` respetando Clean Architecture y sin dependencias hacia otros módulos.

## Fases de implementación (para derivar tareas)

1. **Base de datos y políticas**: migración 011, RLS, pruebas RLS Alfa/Beta; dominio (alias, clave temporal, TOTP, permisos) con pruebas unitarias.
2. **Cuentas de personal**: crear cuenta, clave temporal, primer ingreso con cambio obligatorio, reemisión (recuperación sin correo).
3. **Invitaciones y permisos**: invitar, aceptar/rechazar, conceder/revocar capacidades, revocación inmediata y cierre de sesiones.
4. **Recuperación y verificación de correo**: tokens de un solo uso, simulador local, respuestas indistinguibles, límite de intentos.
5. **Segundo factor administrador**: alta de secreto, verificación, exigencia en rutas de plataforma, reinicio técnico offline, negativos de creación de admin.
6. **Perfil y sesiones propias**: datos, cambio de correo con reverificación, cambio de clave, gestión de sesiones.
7. **Interfaz React** de cada flujo (mínimo funcional, sin rediseño visual de F08.1).
8. **Verificación**: matriz de ataques, concurrencia, regresión F01/F02/F04/F05, E2E, evidencia y aceptación humana.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Cambiar `email_canonico` a opcional rompe el login o el registro de F01 | Migración aditiva con CHECK «email o alias»; pruebas de regresión de registro/login existentes antes y después. |
| Enumeración de cuentas por alias, correo o invitación | Respuestas uniformes, límite de intentos por cuenta e IP (tabla de abuso ampliada), pruebas de indistinguibilidad. |
| Secreto TOTP o clave temporal filtrados en logs | Cifrado en reposo, nunca en auditoría ni respuestas posteriores; prueba que busca esos valores en bitácoras. |
| Elevación de privilegios (propietario se crea admin, trabajador se concede permisos) | Política de dominio con pruebas negativas; rutas inexistentes verificadas; auditoría de denegaciones. |
| Revocación no efectiva con sesión abierta | Revalidación por petición + prueba «revocar y reintentar en el siguiente request». |
| Pérdida de acceso del administrador | Procedimiento técnico offline documentado en [quickstart.md](quickstart.md) y probado en TEST. |

## Complexity Tracking

Sin violaciones constitucionales que justificar. La única decisión que podría tocar un límite es D-06 (mensajes de cuenta sin F05 en TEST); se somete a aprobación explícita.
