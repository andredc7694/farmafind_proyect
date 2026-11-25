# F02.5 — Guía de cierre para Andre (T046, T057, T063)

**No marco ninguna de estas tareas por ti.** Esta guía es solo el paso a paso para hacerlas tú en la DEMO con farmacias ficticias. F025-RF23 (suspensión de farmacias) sigue **aplazada**: solo queda anotada como pendiente.

## Qué verificas tú
| Tarea | Qué haces (lenguaje sencillo) |
|---|---|
| **T046** importación manual completa | Con el propietario de la primera farmacia ficticia (HUAMANFAR): importas el archivo `farmacia-01.csv` desde el navegador, ves la vista previa (1 fila, sin errores) y confirmas. Luego pruebas un archivo con una fila mala para ver el error por fila. |
| **T057** recorrido con cinco farmacias | Registras 4 solicitudes más (Alfa, Beta, Gamma, Delta), el revisor las aprueba, cada dueño importa su archivo (02–05), buscas el medicamento y ves cinco ofertas, haces una reserva y compruebas que una farmacia no ve lo de otra. |
| **T063** aceptación | Decides ACEPTO / ACEPTO CON OBSERVACIONES / RECHAZO para F02.5 (solo alcance TEST). |

El paso a paso completo (10 pasos con resultado esperado) está en `docs/demo-manual-f025.md`; los cinco CSV están en `.cache/f025-docker/imports/` (carpeta local ignorada por Git). Las credenciales las doy en el chat, nunca en el repositorio.

## Estado de la DEMO (2026-11-25)
La base manual de F02.5 estaba atrasada (sin las migraciones de F01.1, F02.1, F04.1 y F01.2); ya se le aplicaron las 10 migraciones pendientes (solo esa base TEST marcada). **Al arrancar la DEMO falla una protección del propio proyecto** que compara el SQL contra los hashes aprobados por revisión humana:
- Los archivos SQL de F02.5 se descargan con saltos de línea de Windows (CRLF) y el hash esperado es de la versión con saltos Unix (LF). Normalizarlo es un cambio pequeño y seguro.
- Además, `012_public_pharmacy_projection.sql` **no coincide ni con LF ni con CRLF** con el hash aprobado (`0094DE9A…`; el archivo actual da `7072F13B…`). La evidencia dice que ese hash se fijó antes de ejecutar el SQL; probablemente el archivo se corrigió después sin actualizar el hash.
No quise «re-fijar» ese hash por mi cuenta porque es una aprobación humana tuya. Necesito que decidas (ver opciones en el mensaje de entrega).
