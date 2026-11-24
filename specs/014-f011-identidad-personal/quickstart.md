# Validación local F01.1

**Estado:** procedimiento previsto; los resultados reales irán en `evidence.md` cuando exista implementación. Solo PostgreSQL TEST efímero o fixture marcado y datos ficticios. **No** se opera sobre `farmafind_f01_test` (ni lectura de verificación más allá de lo ya permitido por la instrucción vigente).

## Preparación

1. Confirmar Node 24.17.0, rama `feat/f011-identidad-personal`, spec y plan aprobados en `approval.md`.
2. Encender Docker y los contenedores TEST autorizados (`compose.f01-postgres.yaml`; no se necesita Redis). Ejecutar desde PowerShell (Git Bash falla con vitest por la letra de unidad).
3. Usar un fixture marcado `F02_FIX01_TEST_ONLY` (Alfa, Beta, dueños y trabajador ficticios) o una base efímera creada por la propia prueba.
4. Configurar fuera del repositorio las claves de prueba: `F01_MFA_KEY_HEX` (archivo ignorado en `.cache/`). Ninguna clave real.

## Casos a verificar (derivan de la spec)

| Caso | Cómo | Resultado esperado |
|---|---|---|
| Alta de personal (US1) | Propietario Alfa crea `alfa.caja1` | 201 con clave temporal una sola vez; el listado no la muestra. |
| Primer ingreso | Login con alias + clave temporal | Sesión restringida CAMBIO_CLAVE; cualquier otra ruta 403; tras cambiar la clave, acceso solo a Alfa. |
| Reuso/vencimiento | Repetir la clave temporal; avanzar el reloj 24 h | Rechazo uniforme; reemisión por el propietario funciona. |
| Bloqueo | 5 intentos fallidos | Bloqueo de 15 minutos; sin pista de si la cuenta existe. |
| Invitación (US2) | Propietario invita un correo existente y uno inexistente | Misma respuesta 202; solo el existente ve la invitación; vincula solo al aceptar. |
| Permisos y revocación | Conceder/revocar `inventory.write` y `reservation.accept` | Efecto en la siguiente petición; auditoría con autor y fecha; sesiones cerradas si queda sin membresías. |
| Elevación | Trabajador intenta concederse permisos; propietario intenta crear admin | 403/sin ruta, auditado. |
| Recuperación (US3) | Correo verificado: restablecer vía simulador; trabajador sin correo: nueva clave temporal | Token de un solo uso, otras sesiones cerradas; respuestas indistinguibles para cuentas inexistentes. |
| Admin y TOTP (US4) | Administrador provisionado por BOOT-01 en TEST: enrolar, verificar, operar | `/platform/**` solo con segundo factor; código reutilizado rechazado; reinicio solo con `scripts/f01/reset-mfa.mjs`. |
| Perfil (US5) | Cambiar nombre, tema, correo (reverificar), clave y cerrar otras sesiones | Cambios solo en la cuenta propia; sin edición de roles. |
| Aislamiento | Matriz Alfa/Beta con conexiones reutilizadas | Cero accesos cruzados (RLS). |
| Sin secretos | Buscar clave, token y secreto en auditoría, logs y respuestas posteriores | Cero coincidencias. |
| Regresión | `check`, `build`, F01 (api/rls), F02, F04, F05 | Sin cambios de comportamiento. |

## Simulador local de mensajes (TEST)

Los mensajes de verificación/restablecimiento se escriben en `.cache/f01-mailbox/` (ignorado por Git). Leerlos con `node scripts/f01/mailbox.mjs <destino>`. No existe ruta HTTP para leerlos.

## Procedimiento técnico del administrador (solo TEST)

- **Provisión**: procedimiento offline BOOT-01/GLO-01 existente.
- **Reinicio de segundo factor**: `node scripts/f01/reset-mfa.mjs` con expediente local ignorado por Git, solo contra bases TEST marcadas; deja auditoría `MFA_RESET`. No hay pantalla ni códigos de respaldo.

## Cierre

Detener los contenedores encendidos. La aceptación requiere los nueve F011-SC, los casos negativos, revisión humana y evidencia real; aprobar el plan no cierra tareas.
