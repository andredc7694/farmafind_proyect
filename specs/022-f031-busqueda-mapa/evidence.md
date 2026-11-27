# Evidencia F03.1

## T001–T004 · 2026-11-26 (servidor y contrato, sin puertos)
- **T001:** `PgPublicOfferRepository` devuelve `farmacia.ubicacion` con `{latitud, longitud}` solo si:
  - la función de búsqueda trae ambas coordenadas (la versión F07 las devuelve únicamente con `PUBLICADA_VERIFICADA`);
  - la opción `exposeVerifiedLocation` está activa.
  - En cualquier otro caso devuelve `null`. La composición activa esa opción solo con `config.geolocationTest === true`.
  - Se creó el tipo `PublicOfferPharmacy`. La ficha `/farmacias/{id}` no cambia.
- **T002:** `validCached` exige la forma nueva (`ubicacion`: `null` o `{latitud, longitud}` numéricos, sin claves extra).
- **T003:** una entrada vieja de la caché, sin `ubicacion`, se registra como `invalid`, se recalcula una vez y se reescribe con la forma nueva, sin error. Las entradas nuevas (`null` o con coordenadas) cuentan como acierto, y las formas inválidas se descartan.
- **T004:** `check-openapi-routes` y `public-contract.test.ts` leen `specs/022-f031-busqueda-mapa/contracts/public-search.openapi.yaml`, versión 0.2.0. La prueba comprueba `PublicOfferPharmacy`, la `ubicacion` nullable y que la ficha sigue con `PublicPharmacy`. También prohíbe campos internos (estado de ubicación, autores, teléfono, RUC).
- **Pruebas:**
  - `backend/tests/search`: 36 correctas y 12 omitidas por necesitar base de datos. Incluye 5 nuevas en `f031-location.test.ts`.
  - Backend completo: 620 correctas antes de las pruebas nuevas; los dos únicos fallos son los de F06.1 por entorno, ya conocidos.
  - `verify:contracts`: 41 operaciones. `check` correcto.
- **Configuración necesaria en la DEMO (pregunta de Andre):**
  - La API no detecta F07: lo decide la **configuración** `geolocationTest: true` en la composición.
  - `scripts/f025/demo-serve.mjs` ya la pone en `true` siempre que la búsqueda esté configurada, es decir, cuando existe `.cache/f03-docker/redis-password.txt`, como en la DEMO actual.
  - Además, la DEMO ya tiene aplicada la migración `f07/003`, la versión de la función que filtra por verificación.
  - No hace falta ningún valor nuevo.

## T005–T011 · 2026-11-26 (pantalla, sin puertos; Leaflet falso y sin red)
- **T005** `search-location.js`:
  - Redondea a 3 decimales.
  - Etiquetas: «tu ubicación», «el punto elegido» o el nombre de la ciudad.
  - Solo recuerda `{nombre}` de una ciudad de `PERU_PLACES` (clave `farmafind.search.city`) y tolera un almacenamiento bloqueado.
- **T006** `today-hours.js`: «Abierto hasta», «Abre a las», «Cerrado ahora», «Cerrado hoy» u «Horario no publicado», en hora de Lima.
- **T007** `WhereDialog.jsx`: `<dialog>` modal con:
  - una lectura del dispositivo;
  - distrito o ciudad de la lista interna, con mensaje si el lugar no existe;
  - «Elegir en el mapa» con `PointPicker` en modo `compact`, una prop nueva y opcional que no muestra coordenadas ni repite el botón de ubicación. Sin la prop, F07.1 no cambia.
  - Se cierra con Escape (evento cancel) y con Cancelar, y devuelve el foco al botón que lo abrió.
- **T008** `PublicSearch.jsx` reescrito:
  - Buscador grande y la línea «Sin ubicación · Elegir» o «Cerca de: X (aproximado) · Cambiar · Quitar».
  - «Más barato» y «Más cercano»; este último abre el diálogo si no hay ubicación.
  - «Filtros» con precio mínimo y máximo, «Otros órdenes» (relevancia, mayor precio y disponibilidad; D-03) y «Recordar filtros».
  - Orden por defecto: por precio; con ciudad recordada o ubicación elegida, por cercanía (D-02).
  - Sin campos de latitud ni de longitud.
- **T009** `OfferCard.jsx`: farmacia, producto, precio, distancia, horario de hoy, dirección, revisión, «Ubicación no verificada», «Reservar», «Ver en el mapa» y «Comparar» discreto (D-04).
- **T010** `ResultsMap.jsx` e interruptor Lista | Mapa (D-07 y D-08):
  - Leaflet se carga solo al elegir «Mapa».
  - Marcador propio en CSS (cruz verde con el precio), con `aria-label`, `title`, `keyboard: true` y `role=button`.
  - La tarjeta emergente se construye con nodos de texto; se probó con un nombre hostil que contenía `<img onerror>`.
  - Lista y mapa están conectados en los dos sentidos.
  - Hay un círculo del visitante, pero el encuadre usa solo las farmacias.
  - Se quitó el enlace «Ver farmacias en el mapa» de la búsqueda; `/search/mapa` sigue disponible.
  - El texto del asistente para «farmacias cercanas» indica el camino nuevo y conserva el atajo.
- **T011** Estilos claro y oscuro con los tokens existentes: foco visible, 44 px y diseño de una sola vista a ≤ 700 px.
  - Se adaptaron 8 pruebas existentes al cambio aprobado: «Comparar», «Otros órdenes», un solo panel «Filtros», el interruptor en lugar del enlace, el orden por defecto `precio_asc` y el diálogo en lugar de las coordenadas.
- **Pruebas:**
  - Frontend: **266/266** (55 archivos), con 10 nuevas en `frontend/tests/f031`.
  - Asistente: 146 correctas; siguen los dos fallos de entorno de F06.1, sin relación con este cambio.
  - `check` correcto (324 archivos) y build correcto.

## T012–T015 · 2026-11-26 (base de datos, copia temporal, E2E y regresión)
- **T012 · `scripts/f03/verify-f031-location.mjs`** con PostgreSQL real, en el fixture F07 efímero `farmafind_f01_test_c8f90caa7c42` del clúster de pruebas. No se usó `farmafind_f01_test` ni la DEMO, y la transacción se revirtió. **8/8**:
  - Una farmacia verificada trae coordenadas.
  - Una PENDIENTE con coordenadas guardadas da `null`, y una RECHAZADA también.
  - Una farmacia INACTIVA no aparece.
  - Solo se devuelven las claves `latitud` y `longitud`.
  - Con la opción apagada, todo da `null`.
- **T013 · Copia temporal en 3001/5174:**
  - Base efímera `farmafind_f01_test_6b49fe963285`, sin el Redis compartido.
  - Datos ficticios: 4 farmacias de Ayacucho, 3 verificadas y 1 sin verificar, con paracetamol y horario.
  - La API devuelve `ubicacion: null` para la farmacia sin verificar.
- **T014 · E2E en Chrome:** todas las peticiones externas se bloquearon; la única intentada fue `tile.openstreetmap.org`, así que hubo 0 llamadas reales. **20/20 comprobaciones**:
  - Orden por precio sin ubicación y sin campos de coordenadas.
  - «Más cercano» abre el diálogo con sus tres opciones; con Ayacucho aparece «Cerca de: Ayacucho (aproximado)», con distancias y la farmacia sin verificar marcada.
  - Horario visible y «Filtros» completo.
  - Exactamente 3 marcadores con texto alternativo, aviso de privacidad y tarjeta con Reservar.
  - Lista y mapa conectados en los dos sentidos; el teclado abre la tarjeta (Enter sobre un marcador).
  - axe: sin violaciones graves.
  - A 390 px se ve una sola vista, sin desplazamiento lateral. Escape cierra el diálogo.
- **Fallos encontrados por el E2E y corregidos (con prueba nueva cada uno):**
  1. Con Leaflet real, el `aria-label` de los marcadores no se aplicaba porque se agregaban antes de encuadrar el mapa. Ahora se encuadra primero. El Leaflet falso imita ese comportamiento y falla con el código anterior.
  2. axe detectó dos fallos de contraste: la tarjeta del mapa y el botón «Ver en el mapa» en hover o pulsado. Se pusieron colores explícitos con los tokens; se verificó también en modo oscuro.
  3. La lista de sugerencias se abría con el texto que trae la URL o con respuestas tardías, y tapaba «Elegir» en el celular. Ahora solo sugiere después de escribir y con el campo activo.
- **T015 · Regresión:**
  - Contratos OpenAPI (general, f011, f041 y f081) correctos.
  - Suites del CI con dobles (unitarias / API):

    | Módulo | Unitarias | API |
    |---|---|---|
    | f01 | 114 | 128 |
    | f02 | 15 | — |
    | f03 | 34 | — |
    | f04 | 48 | 25 |
    | f05 | 8 | 5 |
    | f06 | 24 | 5 |
    | f061 | 108 | 15 |
    | f07 | 19 | — |

  - Backend completo: 626 correctas y 237 omitidas. Siguen los dos fallos de entorno de F06.1.
  - Frontend: **268/268**.
  - F07 con PostgreSQL: 23 correctas. Sigue fallando, por entorno, la prueba de migración que necesita el clúster F01.
  - `check` correcto (325 archivos) y build correcto.

## Revisión de Andre y enmienda E-01 · 2026-11-26
- **Antes de E-01** (sin contradecir la spec):
  - El filtro de lugares funciona al escribir y sin tildes.
  - El mapa «Elegir el punto» abre centrado en Huamanga (`SEARCH_MAP_CENTER` -13.1603, -74.2253).
  - La casilla «Recordar la ciudad» se alineó: antes medía 306×44 px y ahora 18×18 px.
- **E-01 aprobada (opción A).** Nuevo `frontend/src/search/search-places.js`:
  - Por defecto, 16 distritos con ubigeo INEI 050101–050116 y la capital de cada uno. La verificación y las fuentes están en `enmienda-lugares-huamanga.md`.
  - Configuración `VITE_SEARCH_PLACES_SCOPE`: `huamanga` por defecto o ante un valor desconocido; `peru` suma la lista F07.1 sin duplicados.
  - Sinónimos: «huamanga» lleva a Ayacucho y «cuzco» a Cusco.
  - Una ciudad recordada fuera del alcance se ignora.
  - `peru-cities.js` y «Mi farmacia» no cambian (prueba incluida).
- **Campo «Distrito o ciudad»:**
  - Al enfocar o tocar, muestra los 16.
  - Filtra por cualquier parte, sin tildes ni mayúsculas: primero los que empiezan así, luego los que tienen una palabra que empieza así y después los que lo contienen.
  - Sin coincidencias, muestra «No encontramos ese distrito» y vuelve a mostrar la lista completa.
  - Teclado: ↑, ↓ y Enter; Escape cierra solo la lista.
- **Pruebas:**
  - Frontend **277/277**: 6 nuevas en `lugares-huamanga.test.jsx`, entre ellas «con el alcance Huamanga no aparece ningún lugar de Lima ni de otra ciudad», que recorre los más de 40 lugares de fuera.
  - `check` correcto (327 archivos).
  - En Chrome sobre la copia: al enfocar se ven 16 opciones y ninguna de Lima o de otra ciudad.
    - «jes» → Jesús Nazareno.
    - «san» → San José de Ticllas, San Juan Bautista y Santiago de Pischa.
    - «juan» → San Juan Bautista.
    - «caceres» → Andrés Avelino Cáceres Dorregaray.
    - «nazareno» → Jesús Nazareno.
    - «xyz» → aviso y lista completa.
  - E2E completo: 20/20, axe sin violaciones graves, sin llamadas externas reales.
- **Consulta de Andre** («paracetamol 500 mg tabletas x 10» da 0 resultados), solo informativa:
  - La búsqueda F03 busca el texto completo dentro del **nombre** o del **principio activo**: `position(término in nombre)` en `f03.search_public_offers`.
  - Los datos ficticios son correctos: nombre «paracetamol», concentración «500 mg» y presentación «tabletas x 10».
  - El texto largo une nombre, concentración y presentación, y no aparece completo en ninguno de los dos campos; por eso da 0 resultados.
  - Ese texto lo propone la sugerencia de tipo «presentación» de F08.1 (`suggest-public.ts`), así que la sugerencia lleva a una búsqueda vacía.
  - Es un comportamiento anterior a F03.1 y no se cambió.
