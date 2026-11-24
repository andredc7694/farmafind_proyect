# Research — F01.1

Decisiones tomadas para resolver cada incógnita del plan. Cada una indica alternativas descartadas.

## D-01 — Identificador de personal: alias global + correo opcional
- **Decisión**: `alias_canonico` único global (minúsculas, 3–40 caracteres `[a-z0-9._-]`), correo opcional. Login por «Usuario o correo».
- **Razón**: cumple la aclaración Q1-C y MEJ-016 (no simular correo entregable). El correo puede añadirse después desde el perfil (MEJ-019).
- **Alternativas**: alias por farmacia (permite colisiones entre farmacias y complica el login); correo obligatorio (excluye personal sin correo).
- **Riesgo**: enumeración de alias. Se mitiga con respuesta uniforme en login, 409 genérico al crear («no disponible») solo para propietarios autorizados, y límite de intentos.

## D-02 — Clave temporal: tabla propia, un solo uso, 24 h
- **Decisión**: tabla `credencial_temporal` (una fila por usuario), hash Argon2id, `expira_at = emisión + 24 h`, `consumida_at`. Generación con CSPRNG de al menos 128 bits, mostrada una vez en la respuesta de creación/reemisión. Bloqueo de 15 min tras 5 intentos fallidos por cuenta (tabla de abuso).
- **Razón**: aclaración Q4-A; separar la temporal evita que una contraseña definitiva sea reconsultable y permite invalidar sin tocar la clave real.
- **Alternativas**: guardar la temporal en `usuario.password_hash` (mezcla estados y dificulta «un solo uso»); caducidad de 1 h o 72 h (descartadas por el responsable).

## D-03 — Sesión restringida
- **Decisión**: columnas `restringida_motivo` (`CAMBIO_CLAVE`, `MFA_PENDIENTE`) y `mfa_verificada_at` en `sesion`. Una sesión restringida solo accede a cambiar clave o verificar segundo factor; el middleware rechaza el resto.
- **Razón**: obliga el cambio en el primer ingreso sin abrir ventanas de acceso.
- **Alternativa**: token especial fuera de la sesión (duplica el mecanismo de cookies/CSRF ya aprobado).

## D-04 — TOTP con `node:crypto`, sin dependencia nueva
- **Decisión**: RFC 6238 (HMAC-SHA1, 6 dígitos, paso 30 s, ventana ±1), validada con los vectores del RFC. Secreto de 160 bits cifrado con AES-256-GCM; clave de cifrado desde configuración externa (`F01_MFA_KEY_HEX`, archivo ignorado en TEST). Anti-repetición con `ultimo_paso_usado`. Límite de 5 intentos/15 min.
- **Razón**: costo US$0, menor superficie de cadena de suministro, algoritmo pequeño y verificable.
- **Alternativas**: librería `otplib` (dependencia nueva a auditar); SMS/correo (requiere proveedor, costo).
- **Pendiente de confirmar al aprobar el plan**: ninguno bloqueante; si el responsable prefiere librería, se cambia solo la capa de dominio.

## D-05 — Reinicio de segundo factor y provisión de admin: procedimiento técnico offline
- **Decisión**: `scripts/f01/reset-mfa.mjs`, comando administrativo offline como BOOT-01 (expediente local ignorado por Git, solo bases TEST efímeras, auditoría). Sin pantalla, sin ruta HTTP, sin códigos de respaldo (aclaración Q5-B).
- **Razón**: coherente con MEJ-015; evita crear una vía de ascenso o reinicio desde la aplicación.
- **Alternativa**: códigos de respaldo (secretos adicionales que custodiar).

## D-06 — Mensajes de cuenta (verificación/recuperación): simulador local, sin F05 — **requiere confirmación**
- **Decisión propuesta (A)**: puerto `AccountMessageDelivery` con adaptador de simulación que escribe JSON-lines en `.cache/f01-mailbox/` (ignorado), leído con `scripts/f01/mailbox.mjs`. Se invoca después de confirmar la transacción; un fallo no revierte la operación. F05 no se modifica.
- **Razón**: no hay proveedor de correo autorizado (Constitution XX y costo US$0); extender F05 exige un contrato nuevo en un servicio ya aceptado.
- **Alternativa (B)**: nuevo tipo de evento de identidad en Outbox y contrato firmado en F05 con canal simulado. Más fiel al principio X, pero amplía el alcance a F05 y se justifica mejor cuando exista un proveedor real (Puerta 5).
- **Alternativa (C)**: ruta HTTP de bandeja de pruebas. Descartada: superficie de ataque.
- **Recomendación**: A ahora; B cuando se autorice un proveedor de correo.

## D-07 — Invitaciones anti-enumeración
- **Decisión**: el propietario invita por correo; la API responde siempre `202`. Si la cuenta existe se crea la invitación (7 días) visible en «Mis invitaciones»; nunca se vincula sin aceptación.
- **Razón**: spec US2-1 y SC-007; evita sondear qué correos existen.

## D-08 — Revocación efectiva
- **Decisión**: F01 ya revalida membresía y delegación por petición; se añade (a) cierre de sesiones si el usuario queda sin membresías activas y (b) borrado de la farmacia activa seleccionada si era la revocada. Prueba: «revocar y reintentar en el siguiente request» (SC-003).

## D-09 — Permisos de personal sobre `delegacion`
- **Decisión**: reutilizar `delegacion.capacidad` con el catálogo ya existente en F02/F04: `reservation.read`, `reservation.accept`, `reservation.deliver`, `reservation.settings`, `inventory.read`, `inventory.write`, `inventory.import.preview`, `inventory.import.confirm`, `inventory.history`; la capacidad de gestión real es `membership.manage` (no `personal.gestionar`) y no es delegable por esta vía (solo propietario). Los códigos existentes de F02/F04 se conservan tal cual.
- **Razón**: coherencia con ROL-01/EXC-01 y F02/F04; sin tabla paralela.
- **Verificado 2026-11-23** contra el código: F04 usa `reservation.read|accept|deliver|settings` y F02 usa `inventory.read|write|import.preview|import.confirm|history`. Las capacidades de reserva y su delegación a trabajadores no se renombran.

## D-10 — Avatar y perfil
- **Decisión**: avatar = elección entre un conjunto fijo de identificadores predefinidos; teléfono opcional con validación de formato; tema `CLARO|OSCURO|SISTEMA` y preferencias como columnas booleanas. Sin carga de archivos.
- **Razón**: evita almacenamiento y análisis de archivos (alcance F08.1).

## D-11 — Verificación de correo y restablecimiento
- **Decisión**: tokens aleatorios de ≥128 bits, guardados solo como hash SHA-256; propósito (`VERIFICAR_CORREO`, `RESTABLECER_CLAVE`, `CAMBIO_CORREO`), caducidad 30 min (restablecer) y 24 h (verificar), un solo uso; al restablecer se invalidan los demás tokens y se cierran las otras sesiones de la cuenta.

## D-12 — Abuso y límites
- **Decisión**: ampliar el CHECK de `abuse_attempt.scope` con `TEMP_KEY_ACCOUNT`, `RESET_ACCOUNT`, `RESET_IP`, `TOTP_ACCOUNT`, `STAFF_CREATE_IP`; mismas ventanas HMAC sin guardar correo ni IP en claro.
