# F07 — Evidencia de implementación

## Integración inicial (2026-11-18)

- F01: `f01.farmacia_referencia`, `f01.usuario_farmacia` y `f01.delegacion` son la fuente de farmacia, membresía y capacidades. El identificador de farmacia por sí solo no autoriza cambios. Las tablas privadas F01 usan RLS; F07 debe mantener contexto por transacción y roles sin `BYPASSRLS`.
- F02: `f02.inventario` y `f02.medicamento` son la fuente de oferta y producto. F07 no crea un segundo inventario.
- F03: `f03.farmacia_publica` contiene dirección y coordenadas opcionales sin estado de verificación; `f03.search_public_offers` expone estas coordenadas actualmente. F07 necesita una migración aditiva que deje filas antiguas pendientes y una nueva proyección que oculte sus coordenadas, sin eliminar dirección ni oferta textual. La caché F03 no almacena posiciones personales en consultas con coordenadas.
- La migración F03 y el fixture F03 ya exigen una base efímera `farmafind_f01_test_<12 hex>` en `127.0.0.1:55431`; F07 debe reutilizar esa barrera y nunca escribir en `farmafind_f01_test`.

## Comprobaciones realizadas (2026-11-18, Windows 10)

| Comando | Resultado |
| --- | --- |
| `node scripts/f07/fixtures.mjs validate` | PASS tras ajuste: 5 farmacias, 4 identidades y ofertas ficticias; sin conexión a PostgreSQL. |
| Comprobación de `assertF07EphemeralDatabase` con URL persistente, remota y TEST aislada | PASS: rechazó las dos primeras y aceptó solo `127.0.0.1:55431/farmafind_f01_test_<12 hex>`. Sin conexión. |
| `npm run build --workspace @farmafind/backend` | PASS: TypeScript 5.9.3 compiló el migrador F07. |
| `node scripts/f07/check.mjs static` | PASS: 2 archivos, 6 pruebas Vitest. El primer intento en sandbox falló al iniciar esbuild con `EPERM`; la repetición autorizada fuera del sandbox pasó. |
| `node scripts/f07/check.mjs migration` sin URL | Rechazo esperado de la guarda: exige `F07_TEST_DATABASE_URL`. No se conectó. |
| `docker compose -f compose.f01-postgres.yaml ps --format json` y prueba TCP `127.0.0.1:55431` | Al inicio, PostgreSQL no estaba disponible. Posteriormente se inició Docker Desktop y se ejecutaron las pruebas reales descritas abajo. |

## Fundación PostgreSQL TEST (2026-11-18)

Docker Desktop se inició solo para estas verificaciones; `compose.f01-postgres.yaml` levantó el contenedor PostgreSQL `postgres:18.6-bookworm` con puerto publicado exclusivamente en `127.0.0.1:55431` y estado `healthy`. Se creó `farmafind_f01_test_8f336b38531c`, separada de la base persistente y marcada `FarmaFind F07 TEST efimera`. El fixture contiene cinco farmacias y cuatro identidades ficticias. La siembra de posiciones `PUBLICADA_VERIFICADA` es **solo un estado de prueba cargado por el migrador**: no acredita el flujo real de propuesta/revisión ni autoriza capacidades persistentes.

| Comando/control | Resultado real |
| --- | --- |
| `node scripts/f07/prepare.mjs prepare` | PASS: 10 migraciones F01, 4 F02, 2 F03 y 3 F07 en la base TEST nueva. Antes de F07, las cinco filas F03 tenían ciudad nula; tras migrar seguían `PENDIENTE` y sin ciudad inferida. |
| `node scripts/f07/check.mjs migration` | PASS: 5 pruebas; nueva base TEST temporal con fila F03 heredada, dirección/oferta conservadas, coordenadas ocultas a runtime y ciudad no inferida. La prueba eliminó solo su propia base temporal. |
| `node scripts/f07/check.mjs rls` | PASS: 7 pruebas; runtime sin SUPERUSER/BYPASSRLS, FORCE RLS en propuestas/auditoría, lectura Alfa/Beta separada, contexto local sin filtración tras reutilizar conexión, proyección pública limitada y acceso directo a tabla F03 denegado. |
| `node scripts/f07/prepare.mjs verify` | PASS: cinco farmacias TEST, marca de base correcta y conteos de la base persistente iguales a los registrados antes del fixture. |
| Consulta de `f07.schema_migrations` y `pg_roles` | `001_location.sql`, `002_location_rls.sql`, `003_public_projection.sql` registradas; rol runtime TEST con `rolsuper=false`, `rolbypassrls=false`. |

La migración aditiva `004_public_proximity.sql` se aplicó después, únicamente en la misma base F07 TEST, para permitir lectura acotada de candidatas verificadas sin ciudad. La prueba de migración se repitió con las cuatro migraciones y pasó 5/5. SHA-256 de las migraciones aplicadas: `001_location.sql` `22814C361279009630EB1E48F772624E50AADF0ACAFC62B4D59D12866199CE17`; `002_location_rls.sql` `3753DA101D8C6A72E30914678AE2DB16258E3639D92207136A8E96EDEB41B716`; `003_public_projection.sql` `AA7792F67838E2625B420514A2411ACE06698778918DA8B2C94DAD4DB4B8D959`; `004_public_proximity.sql` `9B97C0264626C5EB873CF34C98A6343768DE800F782394FAC1540874AFB70332`.

En el primer intento de preparación, un nombre de producto ficticio no cumplió la normalización F02. Se corrigió el fixture, se comprobó que aquella base TEST contenía solo cinco farmacias ficticias y ningún usuario/propuesta, y se eliminó **únicamente** esa base efímera. La base persistente no se modificó.

## Historia 1 — consulta pública local (2026-11-18)

- `node scripts/f07/check.mjs unit`: 11 pruebas pasaron y una prueba de PostgreSQL real se omitió correctamente en modo unitario sin URL TEST. Validación de ciudad, coordenadas, radio 1–50 km, precio, paginación, cinco distancias ficticias y orden estable.
- `node scripts/f07/check.mjs api`: 6 pruebas pasaron, incluida API HTTP con PostgreSQL TEST y oferta F03. Códigos 200/400/429/503, cuerpo POST para coordenadas y `Cache-Control: no-store` se verificaron.
- `node scripts/f07/check.mjs ui`: 4 pruebas React/JSDOM pasaron; consentimiento puntual, denegación/revocación, entrada manual y cliente GET/POST.
- `npm run build --workspace @farmafind/backend` y `npm run build --workspace @farmafind/frontend`: pasaron. El primer intento Vite dentro del sandbox falló por `spawn EPERM`; la repetición autorizada fuera del sandbox compiló.
- API local temporal sobre la base TEST: `/health` respondió `ok`; GET ciudad Lima devolvió cuatro farmacias, POST radio 2 km desde Alfa Centro devolvió tres y la ruta F03 `/busquedas?q=producto` devolvió tres ofertas. `npm run test:f03:unit` pasó 25/25.
- Playwright 1.65.0 en imagen Linux oficial, montada en solo lectura y con llamadas restringidas a loopback: 3/3 pruebas pasaron para ciudad/resultado vacío, proximidad manual y permiso denegado en móvil/teclado. Las solicitudes de posición fueron POST sin coordenadas en URL; la URL del navegador, cookies y `localStorage` permanecieron sin posición. En la salida de la API y del proxy Vite no aparecieron cuerpos ni coordenadas; F07 no usa Redis para consultas con posición y la respuesta POST lleva `no-store`. Este control se repetirá en revisión final de privacidad.

Esto acredita la historia de listado/proximidad en TEST local. El mapa y la revisión privada se evalúan por separado; carga, regresión total y aceptación humana F07 permanecen pendientes.

## Historia 2 — mapa opcional y oferta pública (2026-11-18)

- Se comprobó nuevamente la [política OSMF de teselas](map-provider-review.md) y se fijó Leaflet 1.9.4 estable; `npm audit --omit=dev` registró 0 vulnerabilidades. `npm audit` completo registró cinco altas en dependencias de desarrollo (`fdir`, `picomatch`, `tinyglobby`, `vite`, `vitest`), fuera del paquete Leaflet y bajo el seguimiento de seguridad histórico.
- `node scripts/f07/check.mjs api`: 8/8; proyección PostgreSQL TEST oculta farmacias inactivas y posiciones pendientes, mantiene dirección textual, fecha pública y oferta F03 con precio/disponibilidad referencial. El filtro combinado producto/precio devolvió solo la oferta existente pertinente.
- `node scripts/f07/check.mjs ui`: 7/7; el mapa no carga antes del clic informado; fallo simulado mantiene lista y dirección; marcadores solo de ubicaciones verificadas, atribución y enlace de destino sin origen personal.
- Playwright Linux 1.65.0 sobre imagen oficial: 4/4; ciudad, proximidad manual, permiso denegado y mapa con teselas bloqueadas. El primer intento tras instalar Leaflet sufrió recarga de optimización de Vite y un selector ambiguo de atribución; se corrigió el selector y la repetición pasó. Ninguna prueba descargó teselas externas: cobertura y disponibilidad real del proveedor siguen sin acreditar.
- `npm run test:f03:integration`: 3/3 con Redis 8.10.3 local TEST (TTL, invalidación por generación y reconexión). La lista F07 consulta PostgreSQL directamente y sigue disponible sin Redis. La prueba específica T027 de invalidación tras aprobación de ubicación queda pendiente hasta implementar ese flujo; por ello T034 no se marca aún.

El mapa es un recurso TEST/DEMO condicionado a clic informado, sin SLA ni aceptación productiva. La publicación real de ubicación se evaluó después mediante la historia 3 en TEST; la disponibilidad efectiva de teselas sigue sin acreditarse.

## Continuación de historias 2 y 3 (2026-11-18, base TEST aislada)

Las migraciones aditivas `005_review_publication.sql` y `006_review_audit.sql` se aplicaron **solo** a `farmafind_f01_test_8f336b38531c`. No se aplicaron a `farmafind_f01_test`. La primera añade versión pública y política de publicación RLS vinculada a una propuesta revisada; la segunda exige evidencia de revisión en auditoría. `node scripts/f07/check.mjs migration` pasó 5/5 con seis migraciones. Al iniciar esta sesión, Docker estaba detenido; se levantaron únicamente PostgreSQL y Redis locales. Las sesiones ficticias habían caducado y dos pruebas RLS fallaron por ello; `node scripts/f07/prepare.mjs refresh-test-sessions` renovó exclusivamente sus vencimientos en TEST y `node scripts/f07/check.mjs rls` volvió a pasar 8/8. La base persistente se verificó sin cambios.

| Control real | Resultado |
| --- | --- |
| `node scripts/f07/check.mjs unit` | 19 pasaron, 1 caso PostgreSQL omitido en modo unitario; incluye 201/200/400/401/403/404/409, CSRF y autorización local. |
| `node scripts/f07/check.mjs api` | 11/11; propuesta y revisión con actores Alfa distintos, autoaprobación y tenant Beta denegados, publicación transaccional, auditoría, idempotencia y conflicto de versión. El primer intento tuvo un fallo **solo de limpieza del fixture** por FK de auditoría; se corrigió el orden y la repetición pasó. |
| `node scripts/f07/check.mjs rls` | 8/8; rol runtime sin SUPERUSER/BYPASSRLS, FORCE RLS, autoaprobación y tenant cruzado denegados, contexto local sin fuga al reutilizar conexión. |
| `node scripts/f07/check.mjs cache` | 2/2; invalidación real de generación F03 en Redis local y fallback sin bloquear publicación cuando Redis falla. No se crearon claves `farmafind:f07:*` con ubicación personal. |
| `npm run test:f03:integration` | 3/3; Redis disponible, invalidación y fallback F03. |
| `node scripts/f07/check.mjs ui` | 10/10; acciones privadas visibles solo con capacidades explícitas F01 y cliente con sesión/CSRF. |
| Playwright Linux 1.65.0 oficial, fuente montada solo lectura | 5/5; escritorio, móvil/teclado, permiso concedido/denegado, borrado puntual, mapa caído y alternativa textual. Un intento previo falló por pasar un argumento adicional al comando de Vite, que sirvió `/mapa` como 404; se corrigió el arranque local y la repetición pasó. No se descargaron teselas externas. |
| `node scripts/f07/load.mjs` | 200 candidatas ficticias exactas, 30 muestras tras 5 calentamientos: p95 **8,41 ms** frente a umbral 2000 ms en Windows 10 10.0.19045, Node 24.17.0, 8 CPU. Las 195 filas añadidas se retiraron de TEST al finalizar. |
| `npm run build` | PASS en los tres workspaces; Vite 7.3.8 y TypeScript 5.9.3. |
| `npm run verify:contracts` | PASS: 38 operaciones OpenAPI históricas F00–F06.1; el contrato F07 se revisa por separado. |
| `npm run check` | PASS tras sustituir dos imports privados entre módulos por contratos públicos F01/F03. |

Después se añadió un caso negativo de revocación temporal en el fixture TEST: `node scripts/f07/check.mjs rls` pasó **9/9**. Verificó que una sesión revocada y una membresía revocada deniegan `GEO_LOCATION_PROPOSE` aun con el contexto de farmacia presente, y restauró ambos estados ficticios al finalizar. El valor 8/8 de la tabla corresponde a la ejecución inmediatamente anterior.

El procedimiento de concesión de capacidades en una base persistente continúa como **propuesta pendiente de autorización específica**. La interfaz de `/ubicacion` solo expone controles a membresías que ya tengan capacidades explícitas y el backend vuelve a verificar sesión, farmacia, capacidad y RLS. Los datos de fixture TEST no son evidencia de revisión profesional de ubicaciones reales. Disponibilidad real, licencia y cobertura efectiva de teselas OSM para uso productivo, así como aceptación humana de F07, siguen pendientes.

### Regresión y contrato (ejecución secuencial)

`node scripts/f07/http-private-smoke.mjs` pasó sobre la API HTTP real y PostgreSQL TEST: 201 propuesta, 403 autoaprobación, 403 tenant cruzado, 200 revisión y publicación; restauró la proyección pública ficticia y eliminó sus filas de auditoría/propuesta de TEST. `node scripts/f07/check-contract.mjs` comprobó las cuatro operaciones F07 con rutas Express; `npm run verify:contracts` verificó por separado las 38 operaciones históricas. Las suites unitarias de F01/F02/F03/F04/F05/F06/F06.1 pasaron respectivamente **57/15/25/18/8/24/85** pruebas; las API pertinentes F01/F06/F06.1 pasaron **26/4/14**. La regresión F03 Redis/PostgreSQL pasó 3/3. La prueba histórica aislada `tests/bootstrap/configuration-security.test.mjs` pasó 5/5.

Se intentó `npm run test:base` en paralelo con compilaciones y luego con `--maxWorkers=2`. El primer intento informó un fallo de la prueba histórica del bundle mientras se compilaba; al repetirla aislada pasó. El intento con dos trabajadores se interrumpió tras una advertencia de terminación de worker. Una ejecución serial posterior produjo **420 pruebas satisfactorias, 107 omitidas y dos suites F06.1 fallidas por falta de `F01_TEST_DATABASE_URL`** en el comando genérico. No se declara aprobada esa ejecución global. `npm run test:f061:integration`, que proporciona el entorno oficial de bases efímeras y Redis TEST, pasó 5/5 en las dos suites afectadas, sin escribir en la base persistente. La regresión pertinente se acredita mediante los lanzadores específicos anteriores; una ejecución global sin configuración de integración no sustituye esos lanzadores.

### Privacidad y estado del árbol de trabajo

La revisión de los archivos F07 confirmó que el cliente transmite coordenadas **personales** solo en el cuerpo del POST `/geolocalizacion/consultas`, con `cache: no-store` y sin credenciales; el router responde `Cache-Control: no-store`. No hay código F07 de historial, almacenamiento local, analítica ni logging del cuerpo/URL de esa petición. El mapa y el enlace externo reciben únicamente coordenadas **públicas verificadas de farmacias** tras acción informada. Playwright comprobó URL, cookies y `localStorage` sin posición personal en los recorridos manual, concedido y denegado. No se observó almacenamiento de coordenadas personales en Redis: F07 no usa Redis para proximidad y la prueba de invalidación solo modifica la generación F03. Esta revisión no prueba logs de un proxy de producción, que F07 aún no tiene.

`git check-ignore -v` confirmó que `.cache/f07-fixture/state.local.json`, claves locales PostgreSQL/Redis y `dist/` están ignorados. La búsqueda de patrones de claves API y llaves privadas en archivos F07 no encontró coincidencias. `git diff --check` pasó para archivos seguidos; las únicas coincidencias de espacios finales en nuevos documentos son saltos de línea Markdown de dos espacios en `spec.md` y `checklists/requirements.md`. No hay commit ni staging F07. `node scripts/f07/prepare.mjs verify` confirmó cinco farmacias en el fixture, conteos sin cambios y ausencia del esquema `f07` en la base persistente.

## Cierre técnico repetido (2026-11-18)

Se corrigió el lanzador raíz `test:base`: ejecuta las suites generales sin heredar URL PostgreSQL/Redis del proceso llamador y ejecuta explícitamente las dos integraciones F06.1 mediante su lanzador de bases efímeras. Comprueba credenciales locales ignoradas por Git y puertos TEST antes de iniciar. No cambia las pruebas ni elimina las suites de integración. `npm run test:base` pasó **420 pruebas generales**, **103 omitidas por condiciones propias de los tests** y después **5/5 F06.1** en dos bases efímeras. Las pruebas RLS no activadas por el comando genérico se ejecutaron con lanzadores específicos; este resultado no las declara aprobadas por omisión. Sin servicios TEST, el lanzador termina con error claro antes de ejecutar pruebas.

| Comprobación actual | Resultado real |
| --- | --- |
| `npm run check`, `npm run build` | PASS: límites modulares, TypeScript estricto y tres workspaces. Vite/esbuild requirió ejecución fuera del sandbox por `spawn EPERM`. |
| `npm run verify:contracts`, `node scripts/f07/check-contract.mjs` | PASS: 38 operaciones históricas y 4 F07 con ruta Express. |
| `node scripts/f07/check.mjs unit`, `ui` | PASS: 19 y 10; una prueba PostgreSQL omitida en modo unitario y cubierta por el lanzador API/RLS. |
| `node scripts/f07/check.mjs api`, `rls`, `cache`, `migration` | PASS tras renovar exclusivamente cuatro sesiones ficticias caducadas: 11, 9, 2 y 5. El primer intento API registró 2 denegaciones por caducidad; no se alteró la base persistente. |
| `node scripts/f07/http-private-smoke.mjs`, `npm run test:f03:integration` | PASS: HTTP real 201/403/403/200, aislamiento Alfa/Beta y regresión Redis/fallback 3/3. El primer intento HTTP encontró la API detenida; se arrancó solo la API TEST. |
| Playwright Linux 1.65.0 | PASS 5/5 tras iniciar Vite con `npm run dev:web`. Un intento con argumento adicional sirvió `/mapa` incorrectamente; se descartó y repitió correctamente. Las teselas externas se bloquearon. |
| `node scripts/f07/load.mjs` | PASS: 200 candidatas ficticias, 30 muestras y p95 **9,77 ms** frente a 2000 ms; filas temporales retiradas. |
| `npm audit`, `npm audit --omit=dev` | PASS: **0 vulnerabilidades** reportadas en ambos comandos en esta fecha; no se modificaron dependencias para obtener ese resultado. |
| `node scripts/f07/prepare.mjs verify`, `git diff --check` | PASS: cinco farmacias TEST, conteos persistentes sin cambios, esquema F07 ausente en base persistente y diff sin errores. |

La política oficial OSMF de teselas, atribución y privacidad fue revisada de nuevo; su servicio no garantiza disponibilidad ni uso ilimitado. El mapa permanece voluntario y TEST/DEMO; cobertura y condiciones de operación productiva siguen sin demostrarse. La revisión de seguridad del árbol solo halló URLs con `secret` literal en casos negativos de prueba, no credenciales reales. La aceptación humana F07 sigue pendiente.

## Ratificación humana del alcance TEST/DEMO (2026-11-18)

El responsable del proyecto aprobó expresamente F07 en el mensaje «FARMAFIND — APROBACIÓN HUMANA FINAL DE F07» de esta conversación, después del cierre técnico registrado arriba. La decisión cubre los 12 requisitos, 8 criterios de éxito y 56 tareas verificadas exclusivamente en TEST/DEMO. Esta anotación actualiza el estado de aceptación de las secciones anteriores, que preservan los resultados observados en cada momento. Las capacidades GEO sobre base persistente, el proveedor de mapas para uso público/productivo, facturación, despliegue y aptitud para producción continúan sin autorización.
