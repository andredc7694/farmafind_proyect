# Tasks: F07 — Geolocalización de farmacias

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contrato](contracts/geolocation.openapi.yaml).

**Estado**: 0/56 verificadas. La aprobación humana del plan del 2026-11-18 permite generar esta lista; ninguna casilla representa ejecución.
**Pruebas**: Obligatorias por F07-FR-011, F07-SC-001–008 y Constitution XIII. Todo dato de prueba es ficticio y la base persistente queda intacta.

## Phase 1: Setup

**Purpose**: fijar límites y reutilizar código existente sin cambiar el alcance.

- [x] T001 Revisar F03 (coordenadas, función pública y caché), F01 (delegaciones/RLS) y F02 (oferta) y registrar puntos de integración en specs/010-f07-geolocalizacion/implementation-evidence.md; resultado: no duplicar tablas ni permisos.
- [x] T002 [P] Verificar política vigente de teselas, licencia, atribución, privacidad y volumen del proveedor candidato en specs/010-f07-geolocalizacion/map-provider-review.md; bloquear carga de mapas si algún requisito falla.
- [x] T003 [P] Preparar cinco farmacias con ciudad explícita, dos identidades independientes de Alfa y una de Beta, ubicaciones y ofertas ficticias con distancias esperadas en scripts/f07/fixtures.mjs; el script debe rechazar bases no efímeras.
- [x] T004 Definir comandos de verificación F07 y guardas contra conexión a base persistente en scripts/f07/check.mjs; no iniciar PostgreSQL ni alterar datos durante la configuración.

## Phase 2: Foundational (bloquea historias)

**Purpose**: proyección pública segura y base de pruebas real.

- [x] T005 [P] Escribir pruebas de migración aditiva: filas F03 heredadas conservan ciudad nula, dirección y estado PENDIENTE sin inferencia automática en backend/tests/geolocation/migrations.test.ts.
- [x] T006 [P] Escribir pruebas RLS para runtime sin BYPASSRLS, contexto por transacción y aislamiento Alfa/Beta en backend/tests/geolocation/rls.test.ts.
- [x] T007 Crear migración F07 aditiva de ciudad normalizada nullable solo para filas heredadas, ubicación, fuente, precisión_m positiva, estado y auditoría en backend/migrations/f07/001_location.sql; nuevas propuestas exigen ciudad de 2–120 caracteres; latitud −90..90, longitud −180..180 y ambas presentes o ausentes; no inferir ciudad ni verificar filas existentes automáticamente.
- [x] T008 Añadir políticas RLS/GRANT mínimos y FORCE ROW LEVEL SECURITY sobre datos privados F07 en backend/migrations/f07/002_location_rls.sql; actor de A no puede leer ni escribir B.
- [x] T009 Modificar y probar la función y proyección públicas F03 para ocultar coordenadas no verificadas conservando dirección y oferta en backend/migrations/f07/003_public_projection.sql; las filas heredadas sin ciudad siguen consultables por búsqueda textual F03.
- [x] T010 Adaptar migrador de backend/src/modules/busqueda/infrastructure/migrate.ts para aplicar migraciones F07 solo sobre base TEST efímera autorizada por scripts/f07/check.mjs; rechazar destino persistente.
- [x] T011 Ejecutar migraciones en TEST efímera y registrar comandos, hash de migraciones, roles y resultados de T005/T006 en specs/010-f07-geolocalizacion/implementation-evidence.md; detener si hay operación destructiva o RLS fallida.

**Checkpoint**: T005–T011 completos antes de historias; ninguna escritura a base persistente.

## Phase 3: User Story 1 — Encontrar farmacias cercanas (P1) 🎯 MVP

**Goal**: lista pública por ciudad/ubicación/radio sin exigir permiso del dispositivo.

**Independent Test**: cinco farmacias ficticias se ordenan por distancia lineal; denegación de ubicación conserva búsqueda manual; cero resultados informa vacío.

- [x] T012 [P] Escribir pruebas de radios 1–50 km, coordenadas −90..90/−180..180, ciudad normalizada 2–120 caracteres, entradas incompletas, empates y cero resultados en backend/tests/geolocation/distance.test.ts.
- [x] T013 [P] Escribir pruebas de GET /api/v1/geolocalizacion/farmacias solo por ciudad y POST /api/v1/geolocalizacion/consultas con coordenadas solo en el cuerpo, `Cache-Control: no-store`, rechazo de coordenadas en URL, rate limit, campos públicos y ausencia de coordenadas en logs de aplicación/proxy local en backend/tests/geolocation/public-api.test.ts.
- [x] T014 [P] Escribir pruebas UI de consentimiento puntual, denegación, revocación y búsqueda manual/ciudad en frontend/tests/geolocation/nearby.test.jsx.
- [x] T015 Implementar validación diferenciada de GET ciudad obligatoria 2–120 caracteres sin coordenadas y POST con par latitud/longitud −90..90/−180..180, radio 1–50 km y filtros públicos en backend/src/modules/busqueda/domain/geolocation-query.ts; rechazar coordenadas parciales/no finitas y parámetros desconocidos.
- [x] T016 Implementar cálculo lineal y orden estable sobre máximo 200 candidatas en backend/src/modules/busqueda/domain/geolocation-distance.ts; no etiquetar como ruta real.
- [x] T017 Extender lectura pública F03 con farmacias activas verificadas, ciudad explícita y dirección textual de las demás en backend/src/modules/busqueda/infrastructure/public-offer-repository.ts; no inferir ciudad de direcciones heredadas ni exponer fuente/evidencia privadas.
- [x] T018 Implementar caso de uso de proximidad y composición opcional de ofertas F03 en backend/src/modules/busqueda/application/list-nearby-pharmacies.ts; no inventar precio ni stock.
- [x] T019 Implementar GET /api/v1/geolocalizacion/farmacias solo por ciudad y POST /api/v1/geolocalizacion/consultas con coordenadas en cuerpo, validación, paginación, abuso, errores y `no-store` en backend/src/modules/busqueda/presentation/geolocation-router.ts; no registrar cuerpo ni reenviar coordenadas a GET F03.
- [x] T020 Registrar ambas rutas F07 sin alterar rutas existentes en backend/src/app.ts y comprobar códigos 200/400/429/503 y ausencia de coordenadas en URL/logs en backend/tests/geolocation/public-api.test.ts.
- [x] T021 Crear cliente con estado de posición efímero y POST para coordenadas en frontend/src/geolocation/geolocation-client.js; no colocarlas en URL, historial, almacenamiento, logs ni enlaces a terceros; GET solo para ciudad.
- [x] T022 Crear lista accesible con búsqueda ciudad/manual, radio, distancia lineal y estados vacío/error en frontend/src/geolocation/NearbyPharmacies.jsx.
- [x] T023 Integrar ruta /mapa en frontend/src/main.jsx y comprobar uso por teclado y fallback sin permiso en frontend/tests/geolocation/nearby.test.jsx.
- [x] T024 Ejecutar T012–T023, pruebas públicas F03 y RLS afectadas; inspeccionar URL, historial, logs de aplicación/proxy y caché para comprobar privacidad, y registrar resultados reales de F07-FR-002/004/007/008 en specs/010-f07-geolocalizacion/implementation-evidence.md.

## Phase 4: User Story 2 — Mapa y oferta pública (P2)

**Goal**: mapa opcional coherente con lista y ofertas referenciales.

**Independent Test**: mapa/lista coinciden; ofertas proceden de F03; ante fallo de teselas o permiso, la lista sigue operativa.

- [x] T025 [P] Escribir pruebas de proyección pública: solo farmacia activa y PUBLICADA_VERIFICADA tiene marcador; oferta conserva precio, disponibilidad y fecha en backend/tests/geolocation/public-projection.test.ts.
- [x] T026 [P] Escribir pruebas UI de carga informada de mapa, atribución, fallo de teselas y alternativa textual en frontend/tests/geolocation/map.test.jsx.
- [x] T027 [P] Escribir prueba de integración Redis disponible/caído e invalidación de ubicación sin cachear coordenadas personales en backend/tests/geolocation/cache.test.ts.
- [x] T028 Ajustar composición de ofertas F03 en backend/src/modules/busqueda/application/list-nearby-pharmacies.ts para filtro de producto y precio sin duplicar la fuente oficial.
- [x] T029 Ajustar lectura del perfil público F03 y fechas de actualización en backend/src/modules/busqueda/infrastructure/public-offer-repository.ts; no publicar fila pendiente.
- [x] T030 Seleccionar fuente de teselas TEST/DEMO solo si T002 confirma términos y consentimiento informado, y registrar configuración no secreta en frontend/src/geolocation/map-source.js; si falla, detener tareas de mapa sin bloquear lista.
- [x] T031 Incorporar visor Leaflet solo después de T030, con carga por acción informada, atribución y sin precarga en frontend/src/geolocation/PharmacyMap.jsx.
- [x] T032 Integrar lista/mapa y ofertas públicas referenciales en frontend/src/geolocation/NearbyPharmacies.jsx; no enviar ubicación personal al proveedor por enlace de ruta.
- [x] T033 Ofrecer indicación textual o enlace externo abierto voluntariamente hacia la farmacia, sin origen personal ni ruta/tiempo ficticios en frontend/src/geolocation/PharmacyDirections.jsx.
- [x] T034 Ejecutar pruebas T025–T033, F03 y fallback Redis/PostgreSQL; registrar resultados y condiciones del proveedor en specs/010-f07-geolocalizacion/implementation-evidence.md.

## Phase 5: User Story 3 — Corrección autorizada de ubicación (P3)

**Goal**: propuesta y revisión separadas dentro de la farmacia, sin permisos implícitos.

**Independent Test**: dos usuarios autorizados distintos de Alfa proponen y aprueban; Beta, actor sin capacidad, sesión revocada y autoaprobación fallan sin mutación.

- [x] T035 [P] Escribir pruebas de autorización positiva/negativa para GEO_LOCATION_PROPOSE y GEO_LOCATION_REVIEW, membresía activa y revisor distinto en backend/tests/geolocation/authorization.test.ts.
- [x] T036 [P] Escribir pruebas HTTP de propuesta/revisión con ciudad obligatoria de 2–120 caracteres, concurrencia, evidencia y auditoría en backend/tests/geolocation/location-api.test.ts.
- [x] T037 [P] Escribir pruebas PostgreSQL de autoaprobación, tenant cruzado y conexiones reutilizadas en backend/tests/geolocation/rls.test.ts.
- [x] T038 Modelar propuesta y estados PENDIENTE/PUBLICADA_VERIFICADA/RECHAZADA en backend/src/modules/farmacias/domain/pharmacy-location.ts; validar fuente 2–120, dirección 1–240, ciudad explícita normalizada 2–120, precisión_m > 0 si existe y coordenadas completas.
- [x] T039 Implementar puertos de repositorio/auditoría en backend/src/modules/farmacias/application/location-ports.ts sin acoplar dominio a PostgreSQL.
- [x] T040 Implementar autorización local de propuesta/revisión con F01, capacidades explícitas y prohibición de autoaprobación en backend/src/modules/farmacias/application/location-authorization.ts; no agregar permiso global ni ruta de concesión.
- [x] T041 Implementar transacción tenant con contexto validado y limpieza segura en backend/src/modules/farmacias/infrastructure/location-unit-of-work.ts.
- [x] T042 Implementar repositorio de propuesta/revisión y auditoría con control de versión en backend/src/modules/farmacias/infrastructure/location-repository.ts; rechazo y aprobación idempotentes sin publicar filas ajenas.
- [x] T043 Implementar casos de uso de propuesta y revisión por actores distintos en backend/src/modules/farmacias/application/manage-pharmacy-location.ts.
- [x] T044 Implementar rutas POST de propuesta y revisión según contrato en backend/src/modules/farmacias/presentation/location-router.ts; comprobar 201/200/400/401/403/404/409.
- [x] T045 Registrar router privado F07 en backend/src/app.ts y asegurar que session/contexto se verifican antes de acceder a farmaciaId en backend/tests/geolocation/location-api.test.ts.
- [x] T046 Implementar interfaz mínima de propuesta/revisión únicamente para actores autorizados en frontend/src/geolocation/LocationAdmin.jsx; sin conceder capacidades ni privilegios.
- [x] T047 Integrar vista de ubicación administrativa en frontend/src/identity/IdentityApp.jsx sin modificar reglas F01.
- [x] T048 Ejecutar T035–T047 en TEST efímera con dos identidades Alfa/Beta; registrar evidencia RLS, auditoría, ausencia de autoaprobación e invalidación F03 en specs/010-f07-geolocalizacion/implementation-evidence.md.

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T049 [P] Ejecutar regresión F01/F02/F03/F06.1 pertinente y contratos OpenAPI existentes/F07; registrar comandos/resultados en specs/010-f07-geolocalizacion/implementation-evidence.md.
- [x] T050 [P] Ejecutar compilación frontend/backend, TypeScript, pruebas unitarias, API y seguridad F07; corregir fallos sin debilitar criterios y registrar resultados en specs/010-f07-geolocalizacion/implementation-evidence.md.
- [x] T051 [P] Ejecutar prueba E2E móvil/escritorio y teclado en entorno de navegador oficialmente compatible, con permiso concedido/denegado y mapa caído; registrar evidencias en specs/010-f07-geolocalizacion/implementation-evidence.md.
- [x] T052 Medir p95 de consulta con 200 candidatas ficticias y comparar con propuesta ≤ 2 s en TEST/DEMO en scripts/f07/load.mjs; registrar hardware, muestras y resultados reales.
- [x] T053 Revisar que ninguna coordenada personal figure en URL/historial, logs HTTP o de proxy, caché, analítica ni Git; excluir contraseña, evidencia sensible, .env.local, .cache, node_modules, dist y datos PostgreSQL y registrar resultado en specs/010-f07-geolocalizacion/implementation-evidence.md.
- [x] T054 Ejecutar git diff --check y verificar los 12 requisitos, 8 criterios de éxito, licencia/privacidad de mapas y límites de F01/F03 en specs/010-f07-geolocalizacion/implementation-evidence.md.
- [x] T055 Documentar procedimiento **propuesto** de concesión persistente de capacidades GEO_LOCATION_PROPOSE/GEO_LOCATION_REVIEW en specs/010-f07-geolocalizacion/permission-provisioning.md; no ejecutar ni aprobar concesiones fuera de TEST sin decisión humana específica.
- [x] T056 Preparar matriz de aceptación F07 con pruebas reales, pendientes de licencia/capacidades y revisión humana en specs/010-f07-geolocalizacion/acceptance.md; no autoaprobar F07 ni publicar si faltan controles obligatorios.

## Dependencies & Execution Order

- Setup T001–T004 → Foundation T005/T006 → T007–T010 → T011 → US1 T012–T024.
- US2 exige US1 completo para reutilizar lista; T030 exige T002 aprobada y bloquea T031–T033 si el proveedor falla. T025–T027 pueden escribirse tras Foundation.
- US3 exige Foundation; T035–T037 preceden T038–T047. T041/RLS es barrera antes de ejecutar mutaciones reales. Solo fixtures TEST para capacidades; T055 no autoriza concesiones persistentes.
- Polish T049–T056 depende de historias afectadas. T056 no equivale a aceptación humana.

### Parallel Opportunities

- T002/T003 en archivos distintos después de T001; T005/T006; T012/T013/T014; T025/T026/T027; T035/T036/T037; T049/T050/T051 si sus servicios y entornos ya están preparados.
- Ninguna tarea [P] autoriza ejecutar bases o proveedores en paralelo con su revisión de seguridad.

## Implementation Strategy

MVP: Setup + Foundation + US1 (lista y búsqueda sin mapa ni escritura). Después US2 (mapa condicionado) y US3 (revisión autorizada en TEST), con pruebas independientes. Detener una tarea bloqueada y continuar solo con trabajo independiente. No tocar main, AWS ni la base persistente.
