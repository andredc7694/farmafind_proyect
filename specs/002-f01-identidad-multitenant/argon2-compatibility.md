# F01 / ARG-01 — Compatibilidad local del paquete argon2

**Fecha:** 2026-11-11 (America/Lima). **Tarea:** T002. **Ámbito:** instalación aislada en `.cache/f01-argon2-compat/`, fuera de los workspaces y excluida de Git.

## Referencias previas a la instalación

- [Repositorio oficial node-argon2](https://github.com/ranisalt/node-argon2): declara Node.js 22 o superior y binarios precompilados probados en Windows Server 2022 x64; esa declaración **no acredita soporte oficial de Windows 10**.
- [Paquete argon2 en npm](https://www.npmjs.com/package/argon2): versión estable `0.45.2`, licencia MIT. La consulta local al registro devolvió `engines.node: >=16.17.0`; una restricción de versión satisfecha no reemplaza la prueba práctica del sistema operativo.

## Reproducción y resultados observados

| Paso | Comando | Esperado | Obtenido |
|---|---|---|---|
| Entorno | `[System.Runtime.InteropServices.RuntimeInformation]::OSDescription`; `node --version`; `npm.cmd --version` | Windows 10; Node.js 24.17.0; npm 11.13.0 | `Microsoft Windows 10.0.19045`; `v24.17.0`; `11.13.0`. |
| Metadatos | `npm.cmd view argon2@0.45.2 version engines license --json --offline=false --cache .cache/npm --fetch-retries=0` | Versión fijada y licencia identificadas | `0.45.2`, `>=16.17.0`, `MIT`; salida 0. |
| Instalación aislada | `npm.cmd install --prefix .cache/f01-argon2-compat argon2@0.45.2 --save-exact --offline=false --cache .cache/npm --fund=false --fetch-retries=0` | Instalación sin tocar manifiestos/lockfile de workspaces | 12 paquetes añadidos; salida 0. |
| Hash/verificación | `node .cache/f01-argon2-compat/check.mjs` | Argon2id, dos sales distintas, verificación correcta y contraseña errónea rechazada | `argon2id=true`, `distinctSalt=true`, `valid=true`, `invalidRejected=true`; `win32/x64`, Node `v24.17.0`; salida 0. Se usó únicamente una contraseña ficticia. |
| Auditoría aislada | `npm.cmd audit --prefix .cache/f01-argon2-compat --json --offline=false --cache .cache/npm --fetch-retries=0` | Sin avisos conocidos en ese árbol | 0 vulnerabilidades en todos los niveles; salida 0. |

La primera consulta npm con la configuración de caché predeterminada falló `ENOTCACHED`; una segunda consulta en sandbox con `--offline=false` falló `ECONNREFUSED 127.0.0.1:9`. Las consultas e instalación autorizadas con acceso al registro y caché aislada resolvieron ese impedimento. `Get-CimInstance Win32_OperatingSystem` devolvió acceso denegado; la descripción del sistema y build se obtuvieron mediante `.NET RuntimeInformation`. Ninguno de esos fallos se presenta como prueba de incompatibilidad de `argon2`.

**Conclusión limitada:** la instalación y operaciones básicas Argon2id de `argon2@0.45.2` funcionan en este Windows 10 x64 y Node.js 24.17.0. No se afirma soporte oficial del paquete para Windows 10 ni se extrapola el resultado a otras máquinas. Los parámetros finales y su rendimiento siguen sujetos a pruebas de F01; esta evidencia satisface solo la puerta técnica ARG-01 de T002.
