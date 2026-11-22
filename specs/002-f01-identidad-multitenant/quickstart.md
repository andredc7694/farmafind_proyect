# F01 — Guía de validación futura

**Estado:** guía de validación parcial. La composición local F01 conecta rutas de identidad y membresías propias con dos pools PostgreSQL separados; React conserva la vista `/identity`. Se probó el recorrido HTTP local con PostgreSQL ficticio, pero la aceptación completa sigue pendiente por las puertas documentales, Playwright y revisión humana. [Plan](plan.md), [modelo](data-model.md), [API](contracts/identity.openapi.yaml), [seguridad](contracts/security.md).

## Prerrequisitos y límites

- Rama de F01 sobre el código F00, plan y tareas aprobados expresamente antes de implementar. Windows 10 con Node.js 24.17.0, npm 11.13.0 y PowerShell 5.1 para desarrollo local; `npm.cmd` evita depender de permisos de `npm.ps1`. [authorization-decisions.md](authorization-decisions.md) registra EXC-01/ROL-01 ratificadas solo para concesión/revocación local de `TRABAJADOR`; GLO-01 prohíbe concesiones globales y BOOT-01 permite únicamente diseñar, no ejecutar, el alta inicial. Las operaciones locales se implementaron y probaron con PostgreSQL ficticio; la aceptación completa permanece pendiente.
- PostgreSQL **real de prueba** disponible localmente o en un entorno autorizado, con rol de aplicación no privilegiado y base vacía dedicada a fixtures ficticios. En el incremento fundacional se usó un cluster local aislado de PostgreSQL 18.6 en loopback. El 2026-11-12 se autorizó además Docker Compose para un único PostgreSQL F01 local; ambas opciones usan el mismo puerto 55431 y **no deben arrancarse simultáneamente**. Esta guía no autoriza conectarse a bases reales o ajenas.
- Navegador Playwright en entorno oficialmente compatible para E2E; Windows 10 actual no se declara oficialmente soportado. La ausencia de ese entorno deja la aceptación de F01 pendiente, sin reducir criterios.
- Ningún dato personal, contraseña o inventario real. Secretos locales fuera de Git; solo archivos `.env.example` ficticios y perfil privado `.env.local` cuando se autorice implementación. Ningún secreto bajo `VITE_*`, en capturas ni en reportes compartidos.
- F00 `GET /health` y Notificaciones permanecen separados. F01 no necesita Redis, AWS, proveedor IA ni servicios de pago.

## Preparación y comandos previstos tras autorización

### PostgreSQL F01 mediante Docker Compose (autorizado el 2026-11-12)

Desde la raíz del repositorio, con el puerto `127.0.0.1:55431` libre, usar `compose.f01-postgres.yaml`. La imagen oficial está fijada en `postgres:18.6-bookworm`, con volumen exclusivo `farmafind-f01-postgres_f01_pgdata`, healthcheck y contraseña privada en `.cache/f01-docker/postgres-password.txt` (ignorada por Git). En una preparación limpia, generar **una vez** ese archivo con 32 bytes aleatorios en hexadecimal; nunca copiarlo a documentación, Git ni variables `VITE_*`. El archivo ya generado se conserva para reinicios del mismo volumen. Si se pierde el archivo, no intentar reutilizar el volumen con una contraseña nueva sin un procedimiento de recuperación autorizado.

```powershell
$privateDir = '.cache/f01-docker'
New-Item -ItemType Directory -Path $privateDir -Force | Out-Null
$privateFile = Join-Path $privateDir 'postgres-password.txt'
if (-not (Test-Path -LiteralPath $privateFile)) {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $password = [System.BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
  Set-Content -LiteralPath $privateFile -Value $password -Encoding Ascii -NoNewline
}
docker compose -f compose.f01-postgres.yaml config --quiet
docker compose -f compose.f01-postgres.yaml up -d --wait postgres
docker compose -f compose.f01-postgres.yaml ps
```

La cuenta `f01_migrator` es administrador **solo de este clúster Docker de pruebas** para permitir migraciones y bases efímeras de Vitest. No es un rol de aplicación. Las migraciones crean `f01_auth` y `f01_runtime` como roles `NOLOGIN NOSUPERUSER NOBYPASSRLS`; las pruebas RLS crean LOGIN ficticios limitados y los eliminan al terminar. Este Compose **no crea** credenciales persistentes para `dev:identity`, ni ejecuta BOOT-01 o concesiones administrativas. Para migrar y probar sin mostrar la contraseña en la línea de comandos:

```powershell
$privatePassword = (Get-Content -LiteralPath '.cache/f01-docker/postgres-password.txt' -Raw).Trim()
$env:F01_TEST_DATABASE_URL = ('postgresql://f01_migrator:{0}@127.0.0.1:55431/farmafind_f01_test' -f $privatePassword)
try {
  npm.cmd run migrate:f01:test
  npm.cmd run test:f01:rls
} finally {
  Remove-Item Env:\F01_TEST_DATABASE_URL -ErrorAction SilentlyContinue
}
```

Detener **solo** este servicio con `docker compose -f compose.f01-postgres.yaml stop postgres`; el contenedor y su volumen se conservan. Para reanudar, repetir `up -d --wait postgres`. No usar `down -v`: elimina el volumen de pruebas.

1. Registrar revisión Git, sistema, Node/npm, PostgreSQL de prueba y hash de lockfile. Revisar dependencias nuevas y avisos de seguridad antes de instalarlas. [T002](argon2-compatibility.md) ya comprobó `argon2@0.45.2` en esta máquina Windows 10/Node.js 24.17.0 con datos ficticios y T003 lo fijó en el lockfile; una preparación limpia deberá repetir la comprobación local y `npm.cmd ci` sin atribuir soporte oficial universal de Windows 10. Si falla en otro entorno, detenerse y solicitar decisión sobre alternativas Argon2id seguras.
2. Crear `backend/.env.f01.local` a partir de `backend/.env.example` (archivo ignorado); fijar `APP_MODE=identity`, `HOST=127.0.0.1`, `PORT=3000`, dos URL de conexión distintas para la **misma** base ficticia aislada `127.0.0.1:55431/farmafind_f01_test` y dos claves hexadecimales diferentes de al menos 32 bytes (`F01_CSRF_KEY_HEX`, `F01_ABUSE_KEY_HEX`). La primera URL `F01_AUTH_DATABASE_URL` debe usar un LOGIN que solo herede `f01_auth`; `F01_DATABASE_URL` debe usar otro LOGIN que solo herede `f01_runtime`. Ninguno puede ser propietario, superusuario ni tener `BYPASSRLS`. El arranque verifica esos roles y rechaza otras bases/orígenes en esta fase local; el rol de migración es separado. Nunca poner las claves o URL en Git, consola compartida ni `VITE_*`.
3. Para un cluster **aislado de prueba** ya preparado, fijar `F01_TEST_DATABASE_URL` localmente sin escribir el secreto en comandos compartidos. `npm.cmd run migrate:f01:test` aplica las migraciones `001`–`009` solo a una base ficticia `farmafind_f01_test` en loopback; `009` limita concesión/revocación local de `TRABAJADOR` y exige pruebas T044. Las pruebas RLS crean y eliminan sus propias bases efímeras derivadas de ella. La aplicación no migra una base de producción.
4. Ejecutar `npm.cmd run check`, `npm.cmd run test:f01:unit`, `npm.cmd run test:f01:api`, `npm.cmd run test:f01:rls` y `npm.cmd run build`. `test:f01:rls` exige `F01_TEST_DATABASE_URL` del cluster aislado; `test:f01:api` verifica los contratos disponibles, sin sustituir los casos todavía pendientes. Registrar resultados reales; `check`/`build` por sí solos no validan F01.
5. Con el cluster ficticio y las dos cuentas limitadas ya preparados, iniciar la API con `npm.cmd run dev:identity` y, en otra terminal, el frontend con `npm.cmd run dev:web`; abrir `http://127.0.0.1:5173/identity`. El proceso API escucha solo en `127.0.0.1:3000`, conserva `/health` y monta exclusivamente identidad y membresías propias. `npm.cmd run dev:api` sigue siendo el arranque F00 sin rutas F01. El recorrido automatizado `identity-composition.rls.test.ts` usa servidor HTTP real de loopback y una base efímera ficticia; no sustituye Playwright. No iniciar Notificaciones para obtener éxito artificial de F01.
6. En entorno compatible, ejecutar la suite E2E futura Playwright para registro, login, selección de A/B, denegación cruzada y cierre/expiración. Registrar versión de navegador y plataforma. No sustituirla por una captura manual ni ejecutar como evidencia de soporte oficial Windows 10.
7. Revisar la matriz de criterios y registrar comandos, hora, revisión, versiones, esperado, obtenido, errores y limpieza. Conservar reportes privados fuera de Git y publicar solo resúmenes redactados. La revisión humana final decide aceptación; ninguna suite sola la concede.

## Escenarios que deben observarse

| Grupo | Positivo | Negativo obligatorio | Evidencia requerida |
|---|---|---|---|
| Identidad | Registro único de cliente y login con correo/contraseña; perfil propio. | Duplicado/entrada inválida, contraseña incorrecta, cuenta inactiva, abuso, enumeración, CSRF/Origin inválidos. | Respuestas genéricas, estado de cuenta, ausencia de secretos, auditoría y límites. |
| Sesión | Sesión vigente y farmacia permitida. | Logout, revocación, expiración, cookie ausente/manipulada, sesión anterior tras cambio de permiso. | Estado servidor y respuesta; token bruto ausente de logs/frontend. |
| Membresía | Usuario A/B cambia de farmacia; dueño/admin con permiso explícito concede/revoca solo `TRABAJADOR` de otra persona en A. | Autoelevación, A gestiona B, rol dueño/admin, capacidad de negocio, personal sin permiso, membresía revocada/suspendida, farmacia inactiva, admin global sin permiso. | Antes/después, evento de auditoría y ausencia de cambios en negativos; las pruebas locales verifican TRABAJADOR; las globales siguen bloqueadas. |
| RLS | Rol app lee/escribe filas F01 de A permitidas con contexto validado. | SELECT/INSERT/UPDATE/DELETE B, cambio de `farmacia_id`, falta de contexto, conexión A reutilizada por B, rollback, rol con bypass. | SQL directo como rol app más prueba API; estado de filas y grants/políticas. |
| Público/privado | Salida pública futura con campos permitidos. | Credenciales, sesión, membresía, auditoría o datos internos en respuesta pública. | Inspección automática de DTO y respuesta. |
| Navegador | Recorrido React de identidad y selector en entorno compatible. | Expiración, denegación B y estados de error/carga. | Resultado Playwright real, entorno, versión y captura sin datos privados. |

Para cada intento no autorizado de la batería AC04, el resultado esperado es denegación sin dato filtrado ni cambio de fila; debe existir un caso positivo equivalente para detectar falsos rechazos. Las pruebas de RLS con mocks, sin PostgreSQL real, no cumplen el criterio. Criterios F01-SC-001–007 y las 16 filas de la rúbrica se revisan sin inventar puntajes ni trasladar evidencia de F00.

## Estados de aceptación

- **Diseño**: plan y contratos aprobados con decisiones de seguridad aún pendientes; no implican funcionalidad completa.
- **Local parcial**: controles de configuración, migraciones, RLS, auditoría, identidad y membresías propias HTTP, más composición ejecutable F01, probados en Windows 10 con PostgreSQL aislado. Siguen pendientes las mutaciones globales US3 bloqueadas, Playwright y la revisión final; este estado no equivale a aceptación completa.
- **Aceptación completa futura**: siete SC verificados con PostgreSQL/RLS reales, E2E en entorno compatible, seguridad positiva/negativa y decisión humana registrada. F00 conserva por separado sus pendientes de Playwright, A/B completas y revisión final.
