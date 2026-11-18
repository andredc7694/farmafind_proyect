# Evidencias F06.1 — estado de implementación

**Alcance:** F06.1 TEST/DEMO local, sin proveedor externo ni fuentes farmacéuticas reales. La aprobación de la especificación y el plan consta en esta conversación del 2026-11-17; no equivale a aceptación de la implementación.

**Base de trabajo comprobada:** rama `feat/f06-1-asistente-conversacional`, commit documental de partida `0ca795e`, árbol limpio antes de los cambios de implementación. Constitution v1.2.0 y documentos F06.1 leídos. `backend/src/identity-app.ts` monta el router F06 existente; `backend/src/main.ts` solo arranca la aplicación básica. No se modifica `main` de Git.

## Resultados

**T001–T004 (setup):** comprobado en Windows 10 con Node.js local. `git status --short --branch` confirmó `feat/f06-1-asistente-conversacional` sin cambios iniciales; la composición F06 está en `backend/src/identity-app.ts`. `node --check scripts/f061/check.mjs` y la comprobación de scripts de `package.json` salieron con código 0; `git diff --check` salió con código 0. Se crearon fixtures exclusivamente ficticios. Los scripts F06.1 se han definido pero **aún no se han ejecutado pruebas F06.1**; no se atribuyen resultados a estas tareas.

## Verificación técnica del bloque TEST/DEMO — 2026-11-17

Entorno: Windows 10, Node.js 24.17.0, npm 11.13.0; Vite 7.3.8 y Vitest 4.1.12 ya presentes. No se instalaron dependencias ni se inició PostgreSQL/Redis. Los tests usan únicamente fuentes y ofertas ficticias en memoria.

| Comando | Resultado observado |
| --- | --- |
| `npm run test:f061:unit` | 9 archivos, **74 pruebas aprobadas**, 0 fallas. Incluye 30 diálogos ficticios independientes: **30/30** conservan el referente (umbral 27). |
| `npm run test:f061:api` | 2 archivos, **14 pruebas aprobadas**, 0 fallas; contrato, 4 KiB, errores 400/413/422/429/503, no-store, rechazo clínico previo a proveedor/F03 y composición de rutas F06/F06.1. |
| `npm run check:f06` | 9 archivos, **32 pruebas aprobadas**, 0 fallas; contrato F06 previo conservado. |
| `npm run check` | Código de salida 0; 119 archivos JS revisados, TypeScript estricto y límites modulares correctos. |
| `npm run build` | Código de salida 0; backend/notificaciones compilados y Vite 7.3.8 construyó frontend (50 módulos). |
| `npm run verify:contracts` | Código de salida 0; 36 operaciones históricas F00–F06 con ruta Express. Este comando aún no incluye el nuevo contrato F06.1. |
| `git diff --check` | Código de salida 0 en la revisión previa; repetir antes de cualquier versionado. |

El primer intento de la vista falló por contaminación entre pruebas DOM; se corrigió con `afterEach(cleanup)` y se repitió la suite. Las pruebas públicas detectaron que la palabra «Producto» desviaba búsquedas F03 a fichas; se ajustó el clasificador y se repitieron. La batería clínica detectó un límite de palabra Unicode incorrecto para «mí»; se corrigió y volvió a pasar. Las pruebas de abstención se parametrizaron correctamente y volvieron a pasar. Ninguno de esos fallos queda oculto como resultado satisfactorio inicial.

La composición integrada monta la ruta F06.1 además de la de F06. El catálogo de fuentes en esa composición está **vacío**, de modo que no expone fichas de medicamentos reales. Una prueba de composición con pools falsos (sin conexión PostgreSQL ni Redis) verificó ayuda, abstención, rechazo clínico y compatibilidad de la ruta F06. Los tests aislados del router inyectan un catálogo `TEST_ONLY` ficticio para citas y seguimiento; esto no equivale a verificar el servicio integrado con PostgreSQL real. El contexto retiene ID, referente no clínico, contador y caducidad; no guarda consulta ni IP en claro. La cuota usa clave derivada con HMAC. Respuestas de error HTTP no incluyen texto interno ni detalles de proveedor.

Tras añadir `F03ConversationPublicTools`, se repitieron `npm run test:f061:unit` (68/68), `npm run check` (salida 0) y `npm run build --workspace @farmafind/backend` (salida 0). El adaptador solo expone `search`, `compare` y `pharmacy` del puerto público F03.
La última repetición de `npm run test:f061:unit` alcanzó 74/74 al añadir un caso de capacidad por origen: máximo 20 contextos activos por origen en TEST/DEMO sin desalojar los de otro origen. Después del cambio también pasaron `npm run test:f061:api` (14/14) y `npm run check` (salida 0).

**Amenazas y controles:** intentos de inyección y solicitud clínica se filtran antes de proveedor/herramientas; consultas personales rechazadas no crean contexto. Las ofertas provienen de DTO F03 públicos, con máximo 20 resultados y sin SQL directo nuevo. El mock no tiene red ni SDK externo. No se registran consultas personales en esta evidencia. La protección no sustituye la revisión profesional del corpus real.

**Limitaciones reales:** Docker Desktop no respondió al consultar `docker ps` (pipe `dockerDesktopLinuxEngine` inexistente). Por ello no se ejecutaron en este bloque las pruebas integradas PostgreSQL RLS Alfa/Beta, Redis/fallback ni el smoke de la aplicación compuesta con F03 real; permanecen pendientes T034–T035/T046. Las pruebas de navegador y accesibilidad en entorno oficialmente compatible permanecen pendientes T047. La revisión de fuentes reales, licencia y profesional permanece bloqueada (T030). No se declara F06.1 aceptada.

**Revisión Git y privacidad:** `git diff --check` terminó con código 0. La búsqueda dirigida sobre los nuevos archivos no encontró contraseñas, URLs de base de datos, claves API ni claves privadas; solo aparece el literal ficticio `PRIVATE_TOKEN_TEST` en una prueba que confirma que no se filtra al cliente. `.gitignore` excluye `.env*`, `.cache/`, `node_modules/` y `dist/`. El endpoint F06 histórico mantuvo 32/32 pruebas de regresión. No se hizo commit ni push en este incremento.

No registrar consultas personales, secretos, hashes, claves ni datos de farmacias reales.

## Continuación técnica comprobada — 2026-11-17

En la rama `feat/f06-1-asistente-conversacional` se añadió un adaptador **inactivo** de clasificación Gemini con transporte inyectable. No está importado por la composición de la aplicación, no lee claves del entorno, no existe una clave real y no se hicieron llamadas al proveedor. El mock continúa como único proveedor activo. El adaptador restringe modelo, entrada, cuota de llamadas, timeout y un único reintento transitorio dentro del presupuesto; rechaza consultas clínicas detectadas y patrones de correo/teléfono antes del transporte, valida la respuesta estructurada y oculta errores internos. Los tests usan exclusivamente una clave literal `TEST_ONLY_KEY` y `fetch` simulado. No se afirma que Gemini genere respuestas ni que sea apto para producción; selección de modelo, consentimiento, privacidad, presupuesto y activación siguen requiriendo aprobación separada.

Se corrigió la recuperación de la vista tras HTTP 422: el identificador de conversación vencido se descarta y la siguiente consulta inicia contexto nuevo. La vista F06 `/assistant` conserva su contrato y ofrece acceso a `/assistant/conversation`. El verificador OpenAPI ahora incluye las dos operaciones F06.1 sin cambiar las 36 históricas.

| Comando / comprobación | Resultado real de esta continuación |
| --- | --- |
| `node -v`; `npm -v` | `v24.17.0`; `11.13.0`. |
| `npm run test:f061:unit` | 10 archivos, **79/79** pruebas; incluye adaptador inactivo, recuperación de contexto y batería sintética de 30 diálogos. |
| `npm run test:f061:api` | 2 archivos, **14/14** pruebas HTTP con Supertest; sin PostgreSQL/Redis reales. |
| `npm run check:f06`; `npm run test:f03:unit` | **32/32** F06 y **25/25** F03. |
| `npm run test:f01:unit`; `npm run test:f01:api`; `npm run test:f02:unit`; `npm run test:f04:unit`; `npm run test:f05:unit` | **57/57**, **26/26**, **15/15**, **18/18** y **8/8**, respectivamente. |
| `npm run test:f04:api`; `npm run test:f05:api` | **6/6** y **5/5**, respectivamente. |
| `npm run check`; `npm run build` | TypeScript estricto y límites modulares correctos; backend/notificaciones y frontend Vite compilados. |
| `npm run verify:contracts` | **38/38** rutas documentadas F00–F06/F06.1 localizadas; verificación estructural, no prueba de servicio real. |
| `npm audit`; `npm audit --omit=dev` | **0 vulnerabilidades** en cada consulta al registro npm. |
| Docker / PostgreSQL / Redis | `docker ps` no pudo conectar al pipe `dockerDesktopLinuxEngine`; puertos TEST `127.0.0.1:55431` y `127.0.0.1:56379` cerrados, sin fixture `.cache/f03`. No se ejecutaron T034, T035 ni RLS/Redis reales de T046; no se tocó `farmafind_f01_test`. |
| Navegador | Windows 10 Pro local; Playwright documenta Windows 11+, Windows Server 2019+ o WSL. WSL devolvió acceso denegado. T047 no ejecutada; los tests de vista son jsdom, no navegador real. |

### Investigación de fuentes para T030 y T044

Se consultaron [el portal de productos farmacéuticos de DIGEMID](https://www.digemid.minsa.gob.pe/webDigemid/productos-farmaceuticos/) y [sus fichas técnicas](https://www.digemid.minsa.gob.pe/FichasTecnicas/) como **candidatos**, no como corpus aprobado. El portal identifica fichas aprobadas y contenido dirigido a profesionales de salud. En esas páginas no se acreditó un permiso de reutilización aplicable a incorporar extractos en FarmaFind, ni una revisión profesional del texto y casos límite de F06.1. La disponibilidad pública de una ficha no se interpreta como licencia. Por ello no se copió contenido farmacológico real ni se añadió una fuente al catálogo runtime.

Para desbloquear T030 se necesita, por cada extracto: autoridad, jurisdicción, URL/identificador y versión verificables; vigencia y permiso expreso de reutilización; texto educativo delimitado y advertencias; nombre, profesión y constancia de aprobación del revisor; fecha de revisión y protocolo de retirada por caducidad. Para T044 se necesita además aprobar la batería de 30 diálogos y los casos límite clínicos contra ese corpus, documentando resultados y abstenciones. La batería sintética 30/30 ya ejecutada no sustituye esa aprobación ni F061-SC-008. El contenido real sigue **BLOQUEADO**.

### Puertas que permanecen abiertas

T030 y T044 dependen de licencia y revisión profesional reales. T034/T035/T046 requieren PostgreSQL y Redis TEST accesibles para RLS Alfa/Beta, fallback e integración F03 con datos públicos; las pruebas unitarias no sustituyen esos resultados. T047 requiere un entorno Playwright oficialmente compatible y navegación/accesibilidad real. Ninguna de las seis tareas se marca completada por estos controles parciales. F06.1 permanece TEST/DEMO sin aceptación integral.

## Matriz de aceptación parcial F06.1

`TEST` indica prueba local con fixtures ficticios; `PENDIENTE` indica que el criterio de aceptación integral aún no está demostrado. Ninguna fila equivale a aceptación humana.

| Requisito | Evidencia actual | Estado |
| --- | --- | --- |
| F061-FR-001 | Vista y 30 diálogos ficticios, 30/30 | TEST; navegador pendiente |
| F061-FR-002 | Contexto, seis turnos, caducidad y mensajes | TEST |
| F061-FR-003 | Clasificador mock y pruebas clínicas/urgencia | TEST |
| F061-FR-004 | Ficha `TEST_ONLY` con cita y fecha | TEST; corpus real bloqueado |
| F061-FR-005 | Declaración/advertencia sintética, solo si constan en fixture | TEST; contenido real bloqueado |
| F061-FR-006 | Ausencia, caducidad y contradicción provocan abstención | TEST |
| F061-FR-007 | Pruebas negativas de dosis, diagnóstico, sustitución y tratamiento | TEST; batería profesional pendiente |
| F061-FR-008 | Menores, embarazo y urgencia en suites negativa/HTTP | TEST |
| F061-FR-009 | Categoría ficticia educativa con cita | TEST; revisión profesional real pendiente |
| F061-FR-010 | Adaptador público F03 de solo lectura | TEST; integración PostgreSQL pendiente |
| F061-FR-011 | Oferta, precio, disponibilidad y fecha copiados del DTO | TEST; integración real pendiente |
| F061-FR-012 | Servicio solo consulta, sin puerto de mutación | TEST; regresión integrada pendiente |
| F061-FR-013 | Inyección rechazada antes de proveedor/herramientas | TEST |
| F061-FR-014 | Mock local, sin SDK ni transmisión externa | TEST; políticas de proveedor externo pendientes |
| F061-FR-015 | Contexto efímero sin consulta/IP en claro; no-store | TEST |
| F061-FR-016 | 500 caracteres, 4 KiB, 30/min/origen, 20 ofertas | TEST |
| F061-FR-017 | Vista ofrece enlace a F03 al fallar conversación | TEST |
| F061-FR-018 | Ficha educativa y oferta referencial separadas | TEST |
| F061-FR-019 | Vista de espera, error, cuota, expiración y abstención | TEST; navegador pendiente |
| F061-FR-020 | Contrato nuevo, F06 32/32 y 36 rutas históricas | TEST; smoke compuesto pendiente |
| F061-FR-021 | Mock determinista sin proveedor externo | TEST |
| F061-FR-022 | Puerta profesional registrada, no satisfecha | PENDIENTE |
| F061-FR-023 | 74 unitarias/UI, 14 HTTP; RLS/Redis/browser sin ejecutar | PENDIENTE |
| F061-FR-024 | Solo puerto público; RLS Alfa/Beta no repetido en este bloque | PENDIENTE |
| F061-FR-025 | Descarte y expiración probados | TEST |
| F061-FR-026 | Metadatos completos exigidos a fixture `TEST_ONLY` | TEST; fuentes reales pendientes |
| F061-FR-027 | Catálogo runtime vacío, caducidad y contradicción probadas | TEST; revisión profesional pendiente |
| F061-FR-028 | Sin tercero; aprobación externa no solicitada | TEST para modo mock; activación externa bloqueada |

| Criterio de éxito | Evidencia y límite | Estado |
| --- | --- | --- |
| F061-SC-001 | 30/30 diálogos ficticios; navegador pendiente | TEST |
| F061-SC-002 | Fuente ficticia completa o abstención; corpus real pendiente | TEST parcial |
| F061-SC-003 | Casos clínicos de unidad y HTTP; revisión profesional pendiente | TEST parcial |
| F061-SC-004 | DTO públicos ficticios y cero resultados; integración F03 real pendiente | TEST parcial |
| F061-SC-005 | Sin puerto privado; RLS real Alfa/Beta pendiente | PENDIENTE |
| F061-SC-006 | Inyección y cuota denegadas en HTTP | TEST parcial |
| F061-SC-007 | Fallback de vista probado; Redis real pendiente | TEST parcial |
| F061-SC-008 | Revisión profesional real ausente | PENDIENTE |
| F061-SC-009 | F06 32/32; regresión F03 integrada pendiente | PENDIENTE |
| F061-SC-010 | Categoría ficticia y abstención; aprobación profesional real ausente | TEST parcial |
| F061-SC-011 | Descarte/expiración probados; privacidad integrada pendiente | TEST parcial |

Los diez requisitos IA31-01–IA31-10 se trazan respectivamente en [spec.md](spec.md) a F061-FR-001/002/015/025, 004/005/022/026, 009/027, 007/008, 010/011/012/024, 006/026/027, 013–016/019/023/025/028, 014/021/028, 017/021 y 009/022/023/027. Su estado de aceptación es el de los FR/SC asociados; ninguno se autoaprueba aquí.

Los 16 criterios docentes conservan la numeración y denominación exacta de la [matriz constitucional](../../.specify/memory/constitution.md). Para este incremento: **1** requisitos documentados; **2–3** contratos y arquitectura local comprobados parcialmente; **4** documentos SDD aprobados; **5** suites locales indicadas arriba, integración real pendiente; **6–7** navegador y accesibilidad pendientes; **8–10** sin nueva evidencia de escalabilidad, BD o DNS/CDN; **11** Redis/fallback pendiente de repetición; **12–13** sin nueva evidencia de CI/CD ni k6; **14** código local sin commit en este bloque; **15–16** informe/presentación finales pendientes. Esta trazabilidad no asigna puntajes ni declara cumplimiento académico.

## Puertas independientes

- **Contenido farmacéutico real:** bloqueado hasta comprobar permiso de reutilización, vigencia y revisión profesional documentada. Los fixtures de prueba no satisfacen esta puerta.
- **Proveedor externo (incluido Gemini):** bloqueado hasta aprobación específica de términos, privacidad, consentimiento, cuota y costo.
- **Aceptación F06.1:** pendiente de pruebas de los 11 criterios y revisión humana; ningún resultado se presume por el plan.

## Verificación real de cierre técnico — 2026-11-17

Esta sección sustituye los estados operativos anteriores de T034, T035, T046 y T047. Los resultados se obtuvieron en la rama `feat/f06-1-asistente-conversacional` con Node.js `v24.17.0`, npm `11.13.0`, PostgreSQL oficial `18.6` y Redis `8.10.3`, ambos publicados únicamente en `127.0.0.1`. Se reutilizaron contenedores locales existentes, sin recrear ni borrar volúmenes. Las pruebas de escritura usaron una base TEST efímera con nombre aleatorio derivado de `farmafind_f01_test_*`; el cierre del fixture eliminó únicamente su propia base y rol. La base persistente `farmafind_f01_test` se consultó en modo lectura antes y después: **3 usuarios, 3 sesiones, 0 farmacias, 0 membresías** en ambas consultas. Las otras bases TEST existentes no se tocaron.

| Comando | Resultado observado | Alcance |
| --- | --- | --- |
| `npm run test:f061:unit` | 80/80 | Contexto, privacidad, seguridad, 30 diálogos sintéticos y fallback simulado del proveedor opcional. |
| `npm run test:f061:api` | 14/14 | Contratos HTTP F06.1 y casos negativos. |
| `npm run test:f061:integration` | 5/5 | PostgreSQL RLS real Alfa/Beta con rol runtime, DTO públicos F03, Redis hit/miss/invalidation y fallback PostgreSQL. |
| `npm run test:f01:rls`; `npm run test:f02:rls` | 52/52; 14/14 | Aislamiento y autorización existentes en PostgreSQL real. |
| `npm run test:f03:rls`; `npm run test:f03:integration` | 4/4; 3/3 | RLS F03 y caché Redis real. |
| `npm run test:f061:e2e:linux` | 4/4 | Playwright 1.65.0 en imagen oficial Linux `mcr.microsoft.com/playwright:v1.65.0-noble`; navegación, teclado, móvil, expiración y ausencia de almacenamiento persistente. API y catálogo F03 sintéticos solo para esta prueba de navegador. |
| `npm run check:f06`; `npm run test:f03:unit` | 32/32; 25/25 | Regresión F06 y F03. |
| `npm run check`; `npm run build`; `npm run verify:contracts` | Correctos; 38/38 rutas | TypeScript, arquitectura modular, compilación y contratos estructurales F00–F06.1. |
| `npm audit`; `npm audit --omit=dev` | 0 vulnerabilidades; 0 vulnerabilidades | Consulta al registro npm en esta ejecución. |

**T034 y F061-SC-005:** el rol runtime carece de `SUPERUSER` y `BYPASSRLS`; las tablas privadas probadas tienen RLS forzado. Sin membresía, el contexto Alfa o Beta no permite leer ni modificar inventario privado. F06.1 únicamente consume el puerto público F03; los DTO públicos de ambas farmacias se comprueban por separado. No se añadió SQL ni acceso a repositorios privados en F06.1.

**T035 y F061-SC-004/007:** se comprobó oferta pública desde PostgreSQL, acierto y fallo de caché, invalidación, y respuesta de PostgreSQL cuando Redis no está disponible. La prueba de navegador usa DTO ficticios en memoria y no pretende demostrar esa integración por sí sola.

**T046/T047:** la regresión F01/F02/F03/F06 y las cuatro pruebas de navegador pasaron. El navegador se ejecutó dentro de Linux oficial de Playwright, no en Windows 10 nativo. Los procesos HTTP del harness fueron temporales y propios; el reloj acelerado existe solo en `scripts/f061/browser-api.mjs`, fuera del servidor de producción. La prueba cubrió seis turnos, caducidad y recuperación tras 422, cita sintética de F03, rechazo clínico, fallo genérico, navegación por teclado y pantalla móvil.

**Proveedor externo:** el MockAIProvider sigue siendo el único proveedor conectado a la aplicación. El adaptador Gemini y su wrapper de fallback están inactivos y solo se probaron con transporte simulado; no se usaron claves, red del proveedor ni se aprobó un modelo o presupuesto. Antes de una activación real hacen falta decisiones humanas sobre modelo/API vigente, consentimiento, privacidad, cuota, costos y gestión de secretos. La API actual del adaptador no se declara verificada contra Gemini real.

**Fuentes farmacéuticas:** se revisaron los portales oficiales de [productos DIGEMID](https://www.digemid.minsa.gob.pe/webDigemid/productos-farmaceuticos/) y [fichas técnicas de biológicos](https://www.digemid.minsa.gob.pe/webDigemid/fichas-tecnicas-de-productos-biologicos/) como candidatas. No se comprobó un permiso de reutilización para FarmaFind ni una revisión profesional documentada. No se copió contenido al catálogo runtime. Por ello **T030 y T044 siguen pendientes**; 30/30 diálogos con fixtures no equivalen a aprobación clínica ni a F061-SC-008. F06.1 no se declara aceptada ni apta para orientar con contenido farmacéutico real.

**Estado corregido de la matriz:** F061-FR-001/019 y F061-SC-001/009 tienen ahora evidencia de navegador TEST; F061-FR-010/011/023/024 y F061-SC-004/005/007 tienen evidencia de PostgreSQL/Redis TEST. F061-SC-008 permanece pendiente, y SC-002/003/010 solo cuentan con corpus sintético. La trazabilidad IA31-01–10 y los 16 criterios docentes no cambian: esta evidencia verifica controles locales, sin asignar calificación ni aceptación humana. El total de tareas verificadas es **47/49**.
