# F02 — Inicio y validación local

**Estado:** incremento F02 TEST/DEMO aprobado tras verificaciones y revisión humana global el 2026-11-12. Los controles ejecutados constan en [implementation-evidence.md](implementation-evidence.md). Solo usar el fixture aislado; la aprobación no habilita operación productiva ni GLO-01/BOOT-01.

## Prerrequisitos

1. Rama `feat/f02-catalogo-inventario`, Node.js 24.17.0, npm 11.13.0 y Windows 10 para controles locales. Mantener la Constitution y F00/F01 intactos.
2. Docker Desktop local para PostgreSQL de `compose.f01-postgres.yaml`, con puerto `127.0.0.1:55431`, y para el contenedor oficial Linux de Playwright al ejecutar la aceptación de navegador. Conservar el volumen PostgreSQL; nunca usar `down -v`.
3. Archivo secreto local `.cache/f01-docker/postgres-password.txt` creado previamente para F01. No imprimir ni versionar contraseñas, URLs, hashes, sesiones o `.cache`.
4. FIX-01 crea una base nueva `farmafind_f01_test_<hex>` con datos ficticios; no escribe en `farmafind_f01_test` ni en la DEMO F01. Roles auth/runtime separados y runtime sin `SUPERUSER`/`BYPASSRLS`. El fixture no ejecuta BOOT-01 ni GLO-01 operativos.

## Preparación y arranque

Desde la raíz del repositorio, con Docker Desktop disponible:

```powershell
docker compose -f compose.f01-postgres.yaml up -d postgres
npm.cmd ci --ignore-scripts
npm.cmd run build
node scripts/f02/fixture.mjs prepare
node scripts/f02/fixture.mjs verify
```

`prepare` solo se ejecuta una vez por fixture; si el archivo `.cache/f02-fixture/state.local.json` ya existe y se incorporaron migraciones F02, usar `node scripts/f02/fixture.mjs upgrade` y luego `verify`. Para iniciar la demostración, abrir dos terminales y ejecutar `npm.cmd run dev:f02` y `npm.cmd run dev:web`. Abrir `http://127.0.0.1:5173/inventory`. Las credenciales ficticias están exclusivamente en `.cache/f02-fixture/state.local.json`; no copiarlas al chat ni a Git. El navegador muestra inicio de sesión, selección de Farmacia Alfa/Beta, catálogo e inventario según permisos. El rol `TRABAJADOR` debe recibir denegación en F02.

## Comprobaciones ejecutables en Windows 10

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run test:base
npm.cmd run test:f02:unit
npm.cmd run test:f02:rls
npm.cmd run verify:f02:demo
npm.cmd audit --audit-level=high
git diff --check
```

`test:base` no recibe URL privada y omite deliberadamente pruebas PostgreSQL. `test:f02:rls` lee el secreto local ignorado por Git, crea y elimina sus propias bases temporales y deja intacta la base persistente. `verify:f02:demo` usa FIX-01 sin iniciar servidores permanentes. La comprobación F01 RLS requiere `F01_TEST_DATABASE_URL` de la base local autorizada; nunca escribir su valor en documentación o salida pública. Los resultados observados se registran en la evidencia, no se infieren de esta guía.

1. **Catálogo:** dos referencias con distinta concentración o presentación siguen separadas; un cliente F02 sin permiso global no puede alterarlas. Una referencia inexistente o ambigua bloquea la asociación.
2. **Cambio manual:** un responsable autorizado de Alfa modifica precio/cantidad con motivo y obtiene exactamente un movimiento antes/después; una lectura no cambia `ultima_revision`. Cantidad negativa o menor que comprometido se rechaza sin cambios.
3. **Archivo:** .csv y .xlsx ficticios con columnas mapeadas producen vista previa sin stock escrito. Una fila inválida, duplicada, no conciliada o de Beta rechaza la confirmación entera de Alfa; un archivo válido aplica todas sus filas una vez. Repetir confirmación no duplica movimientos.
4. **Aislamiento:** actor Alfa no lee ni escribe Beta por API o SQL directo, incluso manipulando URL/cuerpo. Sin sesión/contexto, con membresía revocada o con rol `TRABAJADOR` sin permiso, la operación se deniega. Un actor Alfa/Beta cambia contexto secuencialmente y en paralelo sin fuga en una conexión reutilizada.
5. **Integridad:** un cambio concurrente entre vista previa y confirmación produce conflicto y rollback. Al terminar, recuentos y digest de base persistente F01 deben conservarse; los datos de prueba solo residen en la base aislada F02.
6. **Interfaz:** recorrer en español consulta de catálogo, inventario propio, cambio manual, vista previa, errores y confirmación. La suite Playwright obligatoria se ejecutó en la imagen oficial Linux; observaciones manuales en Chrome se registran aparte y no sustituyen la revisión humana.

Para reproducir la prueba de navegador F02 desde Windows 10, iniciar la API y el frontend en terminales independientes con los comandos anteriores, generar el archivo privado de variables ficticias y ejecutar la imagen Linux versionada:

```powershell
node scripts/f02/prepare-browser-env.mjs
docker pull mcr.microsoft.com/playwright:v1.65.0-noble
$repoPath = (Get-Location).Path
docker run --rm --init --network host --ipc host --env-file .cache/f02-e2e/vars.local.env --mount "type=bind,source=$repoPath,target=/work,readonly" -w /work mcr.microsoft.com/playwright:v1.65.0-noble node scripts/f02/run-browser-container.mjs
```

El ejecutor solo crea un puente TCP de loopback desde el navegador Linux a los servicios Windows ya iniciados; conserva los encabezados HTTP `Host` y `Origin`, no cambia la autenticación ni publica la API. La suite usa el fixture FIX-01, incluida una fila sintética con compromiso para probar rollback; no modifica `farmafind_f01_test`. El archivo `.cache/f02-e2e/vars.local.env` queda ignorado por Git y no debe mostrarse ni copiarse al informe.

La compatibilidad del entorno Linux y la imagen versionada se fundamentan en la [documentación oficial de instalación](https://playwright.dev/docs/intro#system-requirements) y [Docker de Playwright](https://playwright.dev/docs/docker). El paquete del proyecto y la imagen usan ambos la versión 1.65.0.

## Evidencia y aceptación

Registrar por control resultado esperado/obtenido, versión, comando, entorno, datos ficticios y limitaciones. No guardar contraseñas, hashes, tokens, archivos originales, capturas privadas ni URLs con credenciales en Git. `local` distingue controles ejecutables en Windows 10; `overall` reúne todos los controles técnicos obligatorios del incremento, incluido navegador en Linux; `acceptance` requiere siete F02-SC verificados y revisión humana. El estado técnico `overall` puede pasar sin convertir `acceptance` en aprobada.

Conservar F01 y F00 con sus propios estados. La habilitación real de responsables sigue dependiendo del procedimiento de alta/permiso aprobado posteriormente; el fixture no lo sustituye. Para detener solo PostgreSQL de FarmaFind sin borrar volumen: `docker compose -f compose.f01-postgres.yaml stop postgres`. Detener los procesos de API/frontend iniciados en sus terminales. La suite `frontend/tests/inventory/f02.spec.js` pasó en Linux oficial con credenciales ficticias privadas; Windows 10 no se declara oficialmente soportado para esa prueba. La revisión humana global F02 quedó registrada el 2026-11-12.
