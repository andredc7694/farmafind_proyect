# Feature Specification: F08.1 — Experiencia integrada por actor

**Feature Branch**: `feat/f081-experiencia-integrada`
**Created**: 2026-11-24
**Status**: Especificación aprobada el 2026-11-24 (ver [approval.md](approval.md)); decisiones D-01..D-04 = A aplicadas (revisables). Plan y tasks creados, pendientes de aprobación.
**Input**: Documento Maestro v3.2 MEJ-003–MEJ-012 y MEJ-018 (HU13–HU20, HU26; RF26–RF33, RF42–RF43; AC12, AC16); roadmap v3.2, orden 5. Se apoya en F01.1, F02.1, F04.1 (ya integradas), F02.5 (**no aceptada**), F03, F06.1 (mock), F07 y F08. React + Vite + JSX; el backend autoriza cada acción; US$0.

## Decisiones resueltas (A/A/A/A aplicadas por Claude el 2026-11-24; Andre puede cambiarlas)

- **D-01 · Alcance y orden**: (A) un solo incremento entregado por lotes en orden de prioridad (navegación por actor → búsqueda comparativa → tema/accesibilidad → mapa y ubicación → chat flotante y sugerencias), **dejando fuera el asistente de solicitud de farmacia (MEJ-011) y la sugerencia 11** hasta que F02.5 esté aceptada; (B) dividir en dos incrementos; (C) incluirlo todo ahora.
- **D-02 · Sugerencias que dependen de datos externos**: (A) entregar las sugerencias 1, 2, 5, 8, 9, 10 y 12 con datos propios (catálogo F02, búsqueda pública F03, reglas F06.1) y **diferir** la 3 (dirección con proveedor de geocodificación) y la 4 (departamento/provincia/distrito, requiere un catálogo oficial con licencia); las 6 y 7 ya existen en F02.1; (B) incluir un catálogo geográfico mínimo cargado a mano; (C) incluir un proveedor de geocodificación (puede costar y requiere privacidad/licencia).
- **D-03 · Dónde se guarda el tema (claro/oscuro/sistema)**: (A) usuarios con sesión → su perfil (campo `tema` de F01.1); visitantes → almacenamiento local del navegador, sin datos personales; (B) solo almacenamiento local; (C) solo perfil.
- **D-04 · Mapa**: (A) conservar el mapa actual de F07 (OpenStreetMap solo tras un clic informado del visitante) y añadir la elección del punto con GPS puntual o a mano, sin proveedor de geocodificación obligatorio; (B) mapa sin proveedor externo (solo coordenadas); (C) otro proveedor.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navegación y paneles por actor (Priority: P1)

Como visitante, cliente, trabajador, propietario o revisor quiero un menú y un panel que muestren solo lo que me corresponde, para encontrar mis tareas sin duplicar permisos ni ver lo de otros.

**Why this priority**: Es el hilo que une todo lo ya construido (MEJ-003/004/005) y reduce el riesgo de mostrar acciones sin permiso.
**Independent Test**: Con Alfa y Beta ficticias, cada actor ve su menú y su panel; al revocar permisos o cambiar de farmacia el menú cambia; abrir una ruta directa sin permiso se deniega en el servidor.

**Acceptance Scenarios**:

1. **Given** un visitante, **When** abre la aplicación, **Then** ve solo el menú público mínimo (inicio, buscar, farmacias cercanas, asistente, acceso).
2. **Given** un propietario con una farmacia activa, **When** abre su panel, **Then** ve, en este orden, Resumen, Farmacia y ubicación, Inventario, Importar, Reservas, Historial, Personal y Configuración, cada uno solo si su permiso lo permite.
3. **Given** un trabajador con permisos parciales, **When** abre su panel, **Then** ve únicamente las tareas de sus permisos (sin duplicados) y nada de Personal ni Configuración.
4. **Given** una persona con varias farmacias, **When** cambia de farmacia o le revocan el permiso, **Then** el menú y las vistas se actualizan y las acciones privadas se revalidan en el servidor.
5. **Given** una ruta privada escrita a mano sin permiso, **When** se abre, **Then** el servidor la deniega (la interfaz no decide).
6. **Given** el panel «Resumen» de una farmacia, **When** se consulta, **Then** muestra solo cifras de **esa** farmacia autorizada (reservas pendientes, confirmadas por vencer, productos sin stock) y nunca de otra.

---

### User Story 2 - Búsqueda comparativa unificada (Priority: P1)

Como cliente o visitante quiero buscar un medicamento y ver ofertas comparables con precio y, si quiero, distancia, en una sola búsqueda, con sugerencias mientras escribo y filtros fáciles.

**Why this priority**: Es la vista de más valor para el usuario final (MEJ-007/008).
**Independent Test**: Buscar «medicamento primero» muestra ofertas de varias farmacias con precio, disponibilidad referencial y fecha; con ubicación voluntaria se ordena por distancia; sin ella funciona igual; sin resultados el vacío es honesto.

**Acceptance Scenarios**:

1. **Given** ofertas públicas de varias farmacias, **When** el visitante busca un medicamento, **Then** ve las ofertas comparables (precio, disponibilidad referencial, fecha, farmacia) sin stock interno ni datos privados.
2. **Given** que escribe, **When** pasan unas letras, **Then** recibe sugerencias de nombre o principio activo y de concentración/presentación (solo propone; no cambia nada).
3. **Given** que concede su ubicación o la escribe a mano, **When** busca, **Then** puede ver y ordenar por distancia; si la niega, la lista sigue completa.
4. **Given** filtros de precio, disponibilidad y distancia, **When** los aplica o los pliega, **Then** el estado se conserva, es accesible con teclado y se puede alternar lista/mapa.
5. **Given** un fallo de Redis, **When** se busca, **Then** el servicio responde desde PostgreSQL (como F03).

---

### User Story 3 - Tema claro/oscuro/sistema y accesibilidad (Priority: P1)

Como cualquier persona quiero elegir tema claro, oscuro o el del sistema y usar la aplicación con teclado y en móvil con buen contraste.

**Why this priority**: Cierre transversal de calidad (MEJ-018) y criterio docente de interfaz.
**Independent Test**: Cambiar el tema lo aplica de inmediato y se recuerda (perfil o navegador); los flujos principales se recorren solo con teclado y en pantalla de móvil con contraste suficiente.

**Acceptance Scenarios**:

1. **Given** cualquier pantalla, **When** se elige claro/oscuro/sistema, **Then** se aplica al instante y se conserva en la siguiente visita.
2. **Given** una persona con sesión, **When** cambia el tema, **Then** se guarda en su perfil sin datos personales adicionales; un visitante lo guarda solo en su navegador.
3. **Given** los flujos principales, **When** se recorren con teclado, **Then** el foco es visible y ordenado y no hay trampas de foco.
4. **Given** un móvil, **When** se abre cualquier pantalla, **Then** no hay desplazamiento horizontal y los objetivos táctiles son utilizables.

---

### User Story 4 - Ubicación de la farmacia y farmacias cercanas (Priority: P2)

Como propietario quiero fijar la ubicación de mi farmacia con GPS puntual o a mano y confirmar la dirección; como visitante quiero ver farmacias cercanas sin que el mapa sea obligatorio.

**Why this priority**: Completa MEJ-006 sobre F07 sin tocar su seguridad.
**Independent Test**: El propietario propone un punto (GPS puntual con su consentimiento o manual); un revisor lo verifica (F07); el visitante ve farmacias cercanas con o sin mapa; sin permiso de ubicación hay respaldo manual.

**Acceptance Scenarios**:

1. **Given** el propietario, **When** usa GPS puntual, **Then** se le pide consentimiento, se usa una sola vez y no se guarda su posición como rastro.
2. **Given** el propietario, **When** no puede usar GPS, **Then** escribe la dirección y coloca el punto a mano; la dirección queda confirmada por él.
3. **Given** un visitante sin ubicación o sin mapa, **When** busca farmacias cercanas, **Then** puede continuar por ciudad o dirección manual.
4. **Given** coordenadas de una farmacia, **When** las consulta otra farmacia, **Then** se deniega (RLS de F07).

---

### User Story 5 - Chat flotante y sugerencias por etapas (Priority: P2)

Como visitante quiero un botón flotante de chat minimizable (sobre F06.1 en modo mock) que no tape el contenido, y como cualquier persona quiero sugerencias que solo propongan.

**Why this priority**: MEJ-009/010/012: valor de apoyo, sin riesgo si se mantiene como lectura.
**Independent Test**: La burbuja se abre y minimiza conservando el contexto; las respuestas citan fuente y fecha de ofertas comparables; ninguna sugerencia cambia datos por sí sola.

**Acceptance Scenarios**:

1. **Given** cualquier pantalla pública, **When** se abre la burbuja, **Then** no tapa el contenido principal, mantiene el foco accesible y conserva la conversación al minimizar.
2. **Given** una consulta de comparación, **When** responde el asistente (mock), **Then** cita las ofertas públicas con su fecha y no ejecuta ninguna acción.
3. **Given** una consulta sin resultados o con intento de inyección, **When** se envía, **Then** responde con honestidad y sin acceso privado.
4. **Given** una sugerencia (nombre, filtros, preguntas del chat, farmacias comparables, preferencias), **When** se muestra, **Then** solo propone y nunca cambia precio, dosis, ubicación, permisos ni reservas.

---

### Edge Cases

- Cambio de farmacia con una vista abierta: la vista se recarga con la nueva farmacia y descarta datos de la anterior.
- Revocación de permisos en otra pestaña: la siguiente acción se deniega en el servidor y el menú se corrige.
- Búsqueda con caracteres raros o muy larga: se rechaza con mensaje claro.
- Mapa o geolocalización bloqueados por el navegador: la funcionalidad principal sigue disponible.
- Preferencia de tema en un navegador sin almacenamiento: se usa el tema del sistema.
- Sin ofertas: se explica que aún no hay ofertas, sin inventar datos.

## Requirements *(mandatory)*

### Functional Requirements

- **F081-FR-001**: El menú DEBE construirse por actor (visitante, cliente, trabajador, propietario, revisor) y mostrar solo destinos permitidos; la ocultación es presentación, no control de seguridad.
- **F081-FR-002**: El panel del propietario DEBE seguir el orden Resumen, Farmacia y ubicación, Inventario, Importar, Reservas, Historial, Personal, Configuración, y el del trabajador solo sus tareas por permiso, sin duplicados.
- **F081-FR-003**: Cada acción privada DEBE revalidarse en el servidor; abrir una ruta directa sin permiso DEBE denegarse sin revelar datos.
- **F081-FR-004**: El «Resumen» DEBE ser una proyección de solo lectura de la farmacia autorizada (reservas pendientes, confirmadas próximas a vencer, productos sin stock), con RLS y sin datos de otras farmacias.
- **F081-FR-005**: La búsqueda DEBE ser medicamento primero, mostrando ofertas comparables con precio, disponibilidad referencial, fecha y farmacia, y distancia opcional, sin exponer inventario interno.
- **F081-FR-006**: La búsqueda DEBE ofrecer sugerencias de nombre/principio activo y concentración/presentación a partir de datos públicos, con límite de resultados y sin modificar datos.
- **F081-FR-007**: Los filtros (precio, disponibilidad, distancia) DEBEN ser colapsables, accesibles con teclado, conservar su estado y permitir alternar lista y mapa; DEBE mantenerse el respaldo cuando falle la caché.
- **F081-FR-008**: El tema (claro, oscuro, sistema) DEBE aplicarse de inmediato y recordarse según D-03, sin datos personales.
- **F081-FR-009**: Los flujos principales DEBEN poder recorrerse con teclado, tener foco visible, contraste suficiente y funcionar en móvil sin desplazamiento horizontal.
- **F081-FR-010**: La ubicación puntual (GPS) DEBE pedir consentimiento, usarse una sola vez y no guardarse como rastro; DEBE existir elección manual del punto y confirmación de dirección sin proveedor de geocodificación obligatorio (D-04).
- **F081-FR-011**: Las farmacias cercanas DEBEN poder consultarse sin mapa y sin ubicación (ciudad o dirección manual).
- **F081-FR-012**: La burbuja de chat DEBE ser flotante y minimizable, no tapar el contenido, conservar el contexto y usar solo F06.1 en modo mock; las respuestas de comparación DEBEN citar ofertas públicas con fecha y NO DEBEN ejecutar mutaciones.
- **F081-FR-013**: Las sugerencias (D-02) DEBEN solo proponer: nunca modificar silenciosamente dosis, formulación, precio, ubicación, estado de reserva ni permisos.
- **F081-FR-014**: Cualquier dato nuevo (proyección de resumen, sugerencias) DEBE ser aditivo, conservar RLS y `farmacia_id` donde aplique, y respuestas históricas de las API NO DEBEN romperse.
- **F081-FR-015**: DEBE mantenerse US$0: sin Gemini facturable, sin geocodificación de pago, sin contenido farmacológico no revisado, solo TEST/DEMO con datos ficticios.
- **F081-FR-016**: Las pruebas DEBEN cubrir menú por actor, cambio de farmacia y revocación, rutas directas denegadas, aislamiento Alfa/Beta del resumen, búsqueda con y sin distancia, respaldo sin Redis, tema persistente, teclado/contraste/móvil, burbuja de chat, sugerencias sin mutación y E2E de los cinco actores.
- **F081-FR-017**: Quedan **fuera** (D-01/D-02): asistente de solicitud de farmacia (MEJ-011) y sugerencia 11 hasta cerrar F02.5; sugerencias 3 y 4; cualquier proveedor externo obligatorio.

### Key Entities

- **Navegación por actor**: conjunto de destinos derivado de sesión, membresías y capacidades ya existentes (sin entidades nuevas de seguridad).
- **Resumen de farmacia**: proyección de lectura con tres cifras de la farmacia autorizada.
- **Sugerencia**: propuesta efímera (texto o filtro) con fuente; no se persiste.
- **Preferencia de tema**: valor `CLARO | OSCURO | SISTEMA` en el perfil (ya existente) o en el navegador.

## Success Criteria *(mandatory)*

- **F081-SC-001**: El 100 % de las rutas privadas de la matriz se deniega en el servidor sin permiso, aunque el menú las ocultara o no.
- **F081-SC-002**: Cero datos de Beta en el Resumen, menú y paneles de Alfa (y viceversa) en la matriz Alfa/Beta con conexión reutilizada.
- **F081-SC-003**: En la búsqueda, el 100 % de los resultados contiene solo campos públicos; con Redis caído, la búsqueda responde igual.
- **F081-SC-004**: Los flujos principales se completan solo con teclado y en 360 px de ancho sin desplazamiento horizontal.
- **F081-SC-005**: El tema elegido persiste entre visitas (perfil o navegador) sin guardar datos personales.
- **F081-SC-006**: Ninguna sugerencia ni respuesta del chat modifica datos; el 100 % de las pruebas de mutación indebida pasa.
- **F081-SC-007**: Los cinco recorridos E2E (visitante, cliente, trabajador, propietario, revisor) pasan sobre fixture TEST.
- **F081-SC-008**: La regresión de F01–F07, F01.1, F02.1 y F04.1 pasa sin cambios de comportamiento.

## Assumptions

- Se reutilizan identidad, membresías y permisos de F01/F01.1, reservas de F04/F04.1, inventario e importación de F02/F02.1, búsqueda F03, geolocalización F07 y asistente F06.1 mock.
- F02.5 sigue **sin aceptar**; por eso MEJ-011 queda fuera (D-01).
- No hay proveedor de geocodificación ni catálogo geográfico licenciado (D-02/D-04).
- Alcance TEST/DEMO local; ninguna base persistente.

## Trazabilidad

| Origen | Requisitos |
|---|---|
| MEJ-003/004/005, HU13–14, RF26–27 | F081-FR-001–004; SC-001, SC-002 |
| MEJ-007/008, HU16, RF29 | F081-FR-005–007; SC-003 |
| MEJ-018, HU26, RF42–43 | F081-FR-008–009; SC-004, SC-005 |
| MEJ-006, HU15, RF28 | F081-FR-010–011 |
| MEJ-009/010/012, HU17/18/20, RF30/31/33 | F081-FR-012–013, 017; SC-006 |
| Transversal | F081-FR-014–016; SC-007, SC-008 |
