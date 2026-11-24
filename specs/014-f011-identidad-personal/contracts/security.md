# Seguridad del contrato F01.1

Complementa [identity-staff.openapi.yaml](identity-staff.openapi.yaml) y `specs/002-f01-identidad-multitenant/contracts/security.md`.

## Reglas obligatorias

1. **No hay vía de ascenso**: ninguna ruta crea, asciende ni concede rol de administrador general o propietario. Prueba: el enrutador no expone esas rutas y los intentos directos reciben 404/403 y se auditan (`ELEVATION_DENIED`).
2. **Secretos de un solo despliegue**: `temporaryPassword`, `secret` de TOTP y tokens de restablecimiento/verificación aparecen únicamente en la respuesta o mensaje que los entrega; no se guardan en claro, no se registran, no se auditan.
3. **Respuestas uniformes** (anti-enumeración): login, restablecimiento, invitación y verificación responden igual para cuentas existentes e inexistentes; el tiempo de respuesta no debe distinguirlas de forma práctica (se compara una vez contra un hash ficticio cuando la cuenta no existe).
4. **CSRF y cookie**: toda operación que cambia estado exige `X-CSRF-Token` y origen confiable, como F01. Respuestas con `Cache-Control: no-store`.
5. **Contexto de farmacia**: se valida membresía y capacidad en el servidor por petición; el `pharmacyId` del cliente no autoriza. La base fija el contexto tenant en la misma transacción (RLS).
6. **Sesión restringida**: `CAMBIO_CLAVE` solo permite `/auth/password/change-temporary`, logout y consulta de sesión; `MFA_PENDIENTE` solo `/auth/mfa/verify`, logout y consulta de sesión.
7. **Segundo factor**: las rutas `/platform/**` exigen sesión con `mfa_verificada_at`; un administrador sin factor activo debe enrolarse antes de operar. Código válido una sola vez (`ultimo_paso_usado`).
8. **Límites de intentos**: clave temporal (5 fallos → 15 min), restablecimiento, TOTP y creación de personal por IP/cuenta con ventanas HMAC (sin correo ni IP en claro).
9. **Revocación**: al revocar membresía o capacidad rige en la siguiente petición; si el trabajador queda sin membresías activas se cierran sus sesiones.
10. **Auditoría**: catálogo cerrado en `auditoria_identidad`; sin valores secretos; solo inserción.
11. **Mensajes de cuenta**: solo por el puerto de entrega; en TEST, simulador local sin ruta HTTP. Ningún proveedor real sin autorización expresa (Puerta 5).
12. **Datos ficticios**: alias, correos y teléfonos de prueba usan `example.test` y valores inventados.

## Matriz de pruebas negativas mínimas

| Actor | Intento | Resultado esperado |
|---|---|---|
| Trabajador Alfa | Crear personal, invitar o emitir clave | 403 + auditoría |
| Trabajador Alfa | Concederse capacidades | 403 + auditoría |
| Propietario Alfa | Operar sobre Beta (cualquier ruta) | 404 sin revelar |
| Propietario | Crear/ascender administrador o propietario | sin ruta / 403 + auditoría |
| Cliente | Aceptar invitación ajena | 404 |
| Anónimo | Reutilizar clave temporal consumida/vencida | rechazo uniforme |
| Anónimo | Sondear alias/correos (login, reset, invitación) | respuestas indistinguibles + límite |
| Sesión restringida | Llamar a cualquier otra ruta | 403 |
| Administrador sin MFA | Llamar a `/platform/**` | 403 |
| Cualquiera | Reusar código TOTP o token usado | rechazo |
