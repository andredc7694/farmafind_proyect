# Feature Specification: F03.1 — Búsqueda simplificada y mapa interactivo

**Feature Branch**: `feat/f031-busqueda-mapa` (creada desde `main` `264469c`)
**Created**: 2026-11-26
**Status**: Draft. **Pendiente de la aprobación de Andre**; no se programa antes.
**Input**: pedido de Andre del 2026-11-26: simplificar «Buscar medicamentos» y agregar un mapa interactivo de farmacias.
**Trazabilidad**:
- Maestro v3.2: **MEJ-007** (buscar medicamento + precio + cercanía integrados; F03) y **MEJ-008** (buscador grande, filtros colapsables, lista/mapa y tarjetas con CTA; F08/F03). Ambas corresponden a HU16 y RF29.
- Continúa F081-FR-005 a 007 y F081-FR-021, que dejaron «MEJ-007 apenas iniciada».

## Revisión previa (lo aprobado que toca este pedido)

| Fuente | Qué dice | Efecto sobre el pedido |
|---|---|---|
| F03 (spec 004), contrato `public-search.openapi.yaml` | `PublicPharmacy` = `id`, `nombre`, `direccion` (con `additionalProperties: false`). Sin coordenadas. | **Choque:** el mapa necesita el punto de cada farmacia. Ver **D-01**. |
| F07 `003_public_projection.sql` | `f03.search_public_offers` ya devuelve `latitud`/`longitud` **solo si la ubicación está verificada** (si no, NULL). Las rutas públicas de F07 ya publican esas coordenadas. | La base y la regla de publicación no cambian. Solo falta exponer las coordenadas en la API (D-01 A). |
| F03 caché (`validCached`) | Solo acepta las claves exactas del contrato actual. Una entrada con otra forma se descarta y se consulta la base. | Con D-01 A se actualiza el validador. Las entradas viejas se descartan solas; sin cambio de TTL ni de claves. |
| Constitution, «Restricciones y continuidad» | La búsqueda debe permitir ordenar por precio, **disponibilidad** o cercanía. Si fallan los mapas, queda la dirección textual. | Los botones rápidos («Más barato» y «Más cercano») no bastan. Ver **D-03**. La lista siempre muestra la dirección. |
| F081 (spec 016) | Comparación de hasta 3 ofertas y enlace a `/search/mapa` (FR-021). | Quitar la comparación exige una enmienda de F081. Ver **D-04**. El enlace se reemplaza por el interruptor (D-08). |
| F07.1 (spec 021) | Lista interna `peru-cities.js` (ciudades y distritos, sin servicio externo), horario público y `PointPicker` (Leaflet). | Se reutilizan sin cambios de reglas. |
| ADR-ROADMAP-V3-002 y DEC-001 | US$0. Sin mapas pagados. El uso de teselas OSM para producción se revisa en F09. | Leaflet + OSM ya aprobados para TEST/DEMO. **Sin librerías nuevas:** con 20 resultados por página no hace falta agrupar marcadores. |

## User Scenarios & Testing

### User Story 1 — Buscar con un solo campo y ubicación opcional (P1)
Un visitante escribe un medicamento en un buscador grande y pulsa Buscar. Sin ubicación ve los resultados ordenados por precio. Con «Elegir» indica dónde busca y ve la distancia.

**Acceptance Scenarios**
1. **Given** no hay ubicación, **When** busca «paracetamol», **Then** ve «Sin ubicación · Elegir» y resultados de menor a mayor precio.
2. **Given** pulsa «Elegir», **When** escribe «Ayacucho» y lo elige de la lista interna, **Then** la línea dice «Cerca de: Ayacucho (aproximado) · Cambiar» y cada resultado muestra la distancia.
3. **Given** pulsa «Más cercano» sin ubicación, **When** se abre «¿Dónde buscas?», **Then** al elegir un lugar los resultados se ordenan por cercanía.
4. **Given** «Usar mi ubicación», **When** el navegador niega el permiso, **Then** aparece un mensaje claro y puede elegir ciudad o mapa.
5. No se ven campos de latitud ni de longitud.

### User Story 2 — Filtros y recordar (P1)
1. **Given** el botón «Filtros», **When** lo abre, **Then** ve el precio mínimo y el máximo, «Recordar filtros» y otros órdenes (D-03).
2. **Given** marca «Recordar la ciudad en este navegador», **When** vuelve otro día, **Then** la ciudad elegida aparece ya puesta. Sin marcarla, no se guarda nada de ubicación.

### User Story 3 — Mapa conectado con la lista (P1)
1. **Given** resultados, **When** elige «Mapa», **Then** se carga el mapa con el aviso de privacidad. Cada farmacia con ubicación verificada tiene un marcador FarmaFind con su precio.
2. **Given** toca un marcador (o lo activa con el teclado), **Then** ve una tarjeta con el nombre, el precio, la distancia, el horario y «Reservar», y la farmacia se resalta en la lista. Al elegir en la lista, se resalta y centra en el mapa.
3. **Given** una farmacia sin ubicación verificada, **Then** sale solo en la lista, con «Ubicación no verificada».
4. **Given** hay ubicación, **Then** el punto del usuario se ve como un círculo y no se guarda.
5. **Given** un celular, **Then** se ve la lista o el mapa, nunca los dos a la vez.

### User Story 4 — Tarjeta de resultado clara (P2)
Cada resultado muestra la farmacia, el producto, el precio, la distancia (si hay ubicación), el horario de hoy («Abierto hasta 20:00», «Abre a las 08:00», «Cerrado ahora», «Cerrado hoy» u «Horario no publicado»), la dirección y «Reservar».

### Edge Cases
- Sin resultados: estado vacío con sugerencia, en la lista y en el mapa.
- Ningún resultado con ubicación verificada: el mapa muestra un aviso y la lista sigue visible.
- Fallo al cargar el mapa o las teselas: aviso; la lista y las direcciones siguen (Constitution y F03-FR-013).
- `localStorage` bloqueado: se busca igual, solo no se recuerda.
- Ciudad que no está en la lista interna: se sugiere elegir en el mapa.

## Requirements

### Functional Requirements
- **F031-FR-001**: Un solo buscador grande («Nombre comercial o principio activo»), con sugerencias (SuggestBox) y el botón Buscar.
- **F031-FR-002**: La ubicación ocupa una línea pequeña: «Sin ubicación · Elegir» o «Cerca de: {lugar} (aproximado) · Cambiar».
  - La ventanita «¿Dónde buscas?» es un diálogo accesible con tres opciones:
    - «Usar mi ubicación»: una sola lectura, con permiso del navegador.
    - Distrito o ciudad de la lista interna de F07.1: sin servicio externo y usando su centro aproximado.
    - «Elegir en el mapa»: PointPicker, con el aviso de privacidad.
  - Ningún campo de latitud ni de longitud queda visible.
- **F031-FR-003**: Una casilla opcional, «Recordar la ciudad en este navegador», guarda solo la ciudad de la lista en `localStorage`, con el mismo patrón que los filtros. La ubicación del dispositivo y el punto del mapa no se guardan nunca (D-05). Sin la casilla no se guarda nada.
- **F031-FR-004**: Precio mínimo, precio máximo, «Recordar filtros» y los otros órdenes (D-03) van dentro de «Filtros».
  - El orden se elige con dos botones rápidos: «Más barato» (`precio_asc`) y «Más cercano» (`cercania`).
  - «Más cercano» sin ubicación abre «¿Dónde buscas?».
  - Orden por defecto: sin ubicación, por precio; con ubicación, según D-02.
- **F031-FR-005**: La tarjeta muestra la farmacia, el producto (nombre, principio activo, concentración y presentación) y el precio, junto con lo siguiente:
  - la distancia, si hay ubicación;
  - el horario de hoy, en hora de Lima, a partir de la proyección pública de F07.1;
  - la dirección textual;
  - la fecha de revisión y el aviso de que los datos son referenciales;
  - el botón «Reservar», con el mismo destino actual.
- **F031-FR-006**: El interruptor «Lista | Mapa» reemplaza el enlace «Ver farmacias en el mapa».
  - En celular (≤ 700 px) se muestra una sola vista; en escritorio, según D-07.
  - El mapa se carga solo al elegir «Mapa».
- **F031-FR-007**: El mapa reutiliza el Leaflet y las teselas OSM ya aprobados en F07, sin librerías nuevas.
  - Cada farmacia lleva un marcador original de FarmaFind (cruz verde con el precio encima, dibujado en CSS o SVG propio, sin logos de terceros).
  - Si una farmacia tiene varias ofertas en la página, su marcador muestra el precio más bajo.
- **F031-FR-008**: La lista y el mapa están conectados: al elegir una farmacia en uno, se resalta en el otro (y en el mapa se centra).
  - Al tocar un marcador se abre una tarjeta con el nombre, el precio, la distancia, el horario y «Reservar».
- **F031-FR-009**: En el mapa solo aparecen las farmacias con ubicación verificada. Las demás salen solo en la lista, con «Ubicación no verificada».
  - El punto del usuario se dibuja como un círculo, sin guardarse ni enviarse a terceros.
- **F031-FR-010**: Accesibilidad (F08):
  - Todo se puede usar con el teclado: diálogo con foco atrapado y Escape, marcadores enfocables y botones con estado `aria-pressed`.
  - Cada marcador tiene texto alternativo: «{farmacia}, S/ {precio}».
  - Contraste correcto en tema claro y oscuro.
- **F031-FR-011**: Privacidad.
  - Se mantiene el aviso del mapa: la lista se ve siempre y el mapa solo bajo pedido.
  - La ubicación del usuario no se guarda en el servidor ni en el navegador (salvo la ciudad, con D-05).
  - La precisión que se envía a la búsqueda se rige por D-06.
- **F031-FR-012**: Datos de la farmacia en el contrato público (D-01 A): la API agrega `farmacia.ubicacion`, que es `{latitud, longitud}` o `null`.
  - Solo trae valor si la ubicación está verificada (dato que ya es público por F07).
  - Sin cambios de RLS, SQL, publicación (solo farmacias activas, sin datos internos), TTL ni claves de caché.
  - El validador de la caché acepta la forma nueva.
- **F031-FR-013**: US$0, sin claves ni servicios nuevos. Las pruebas automáticas no llaman a servicios externos (OSM, Nominatim ni ninguno).
- **F031-FR-014**: Regresión de F03 (contrato, caché, RLS y orden estable), F07, F07.1 y F081 sin cambios de comportamiento fuera de lo descrito.

### Key Entities
- **Ubicación de búsqueda** (solo en memoria): origen (dispositivo, ciudad o mapa), etiqueta visible y punto aproximado.
- **Preferencia recordada** (en el navegador, opcional): ciudad de la lista y filtros. Nunca coordenadas del dispositivo.
- **Farmacia en el mapa**: id, nombre, punto verificado, precio mínimo en la página, distancia y horario de hoy.

## Success Criteria
- **F031-SC-001**: Un visitante encuentra el precio más bajo de un medicamento en menos de 30 segundos sin abrir «Filtros».
- **F031-SC-002**: Con al menos tres farmacias verificadas, el mapa muestra exactamente esas tres. Elegir una en la lista la resalta en el mapa y viceversa (prueba de componentes y E2E en la copia).
- **F031-SC-003**: 0 llamadas reales a servicios externos en las pruebas automáticas. 0 campos de latitud o longitud visibles.
- **F031-SC-004**: Navegación completa con teclado y lectura de los marcadores por lector de pantalla (axe sin violaciones graves), en escritorio y a 390 px.
- **F031-SC-005**: Regresión de F03, F07, F07.1 y F081 en verde, más el contrato OpenAPI actualizado y verificado.

## Decisiones para Andre (opción recomendada en **negrita**)
- **D-01 · Coordenadas para el mapa:**
  - **A)** Enmienda aditiva del contrato F03: `farmacia.ubicacion` (solo farmacias verificadas). Mantiene una sola fuente para la lista y el mapa, y el validador de la caché se ajusta.
  - B) Sin tocar el contrato: el mapa consulta las rutas de F07 aparte. Exige ubicación para ver el mapa y combina dos fuentes que pueden no coincidir.
- **D-02 · Orden por defecto con ubicación:** **A)** «Más cercano» · B) siempre «Más barato».
- **D-03 · Otros órdenes** (relevancia, mayor precio y disponibilidad):
  - **A)** Pasan a «Filtros → Otros órdenes». Cumple la Constitution.
  - B) Se quitan. Requiere enmendar la Constitution.
- **D-04 · Comparación de hasta 3 ofertas (F081):**
  - **A)** Se mantiene, discreta: «Comparar» en la tarjeta.
  - B) Se quita. Requiere enmendar F081.
- **D-05 · Qué se recuerda:**
  - **A)** Solo la ciudad elegida de la lista.
  - B) También el punto del mapa, redondeado.
- **D-06 · Precisión enviada a la búsqueda:**
  - **A)** Redondear la ubicación del dispositivo y el punto del mapa a 3 decimales (unos 100 m) antes de enviarlos.
  - B) Enviarla tal cual, como hoy.
- **D-07 · Escritorio con «Mapa»:**
  - **A)** Mapa y lista lado a lado y conectados.
  - B) Una sola vista, como en celular.
- **D-08 · Página `/search/mapa` (F07):**
  - **A)** Sigue accesible por URL, sin el enlace principal (MEJ-007: «F07 sigue activo»).
  - B) Se retira.

## Fuera de alcance
- Geocodificador externo en la búsqueda.
- Cambios en qué se publica, en RLS o en SQL.
- TTL de la caché.
- Reservas.
- Proveedor de teselas para producción (F09).
- Agrupar marcadores.
- Pendientes registrados: márgenes de «Revisar solicitudes» y «Mi perfil»; ayuda de dirección en el registro de farmacia (después de T063); la corrida de pruebas por investigar.

## Assumptions
- 20 resultados por página como máximo (contrato F03), así que hay pocos marcadores y no hace falta agrupar.
- La copia temporal (3001 y 5174) usa una base efímera con al menos 3 farmacias ficticias verificadas, más una sin verificar.
- F02.5 sigue sin aceptar (T057 y T063 sin marcar) y la spec 020 sigue en opción A. No se toca la DEMO.
