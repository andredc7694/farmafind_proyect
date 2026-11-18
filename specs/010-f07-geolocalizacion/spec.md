# Especificación funcional: F07 — Geolocalización de farmacias

**Rama**: `feat/f07-geolocalizacion`
**Fecha**: 2026-11-18
**Estado**: Decisiones Q1/Q2, especificación y plan aprobados por respuestas humanas del 2026-11-18; implementación TEST/DEMO en verificación, aceptación F07 pendiente
**Entrada**: Continuar con el siguiente incremento del roadmap v3.0 tras el cierre técnico F06.1 TEST/DEMO.
**Fuentes**: Constitution v1.2.0; Documento Maestro v3.0, Parte A §A3 y §A6.1–A6.4; especificaciones F01–F03; [trazabilidad v3.0](../../docs/roadmap-v3-adoption.md). El v2.0 permanece histórico. `F07-LEGACY-AWS` designa solo el borrador AWS antiguo.

## User Scenarios & Testing

### Historia 1 — Encontrar farmacias cercanas sin perder la búsqueda (P1)

Una persona encuentra farmacias públicas activas cerca de su ubicación consentida o introducida manualmente. Si deniega el permiso, puede buscar por ciudad.

**Prioridad**: La búsqueda no debe depender de compartir una posición personal.

**Prueba independiente**: Cinco farmacias DEMO con posiciones ficticias conocidas se ordenan por distancia lineal; al denegar la ubicación, la búsqueda textual sigue disponible.

**Escenarios de aceptación**:

1. **Dado** que no ha compartido su ubicación, **cuando** elige usar la posición actual, **entonces** se solicita permiso explícito antes de obtenerla.
2. **Dado** permiso concedido y ubicación válida, **cuando** elige un radio, **entonces** ve solo farmacias públicas activas dentro de él, ordenadas por distancia lineal estimada y etiquetada como tal.
3. **Dado** permiso denegado, revocado o no disponible, **cuando** busca por ciudad o ubicación manual válida, **entonces** recibe resultados sin exigir la ubicación del dispositivo.
4. **Dado** cero farmacias en el radio, **cuando** consulta, **entonces** se informa el resultado vacío sin inventar disponibilidad.

### Historia 2 — Consultar mapa y oferta pública (P2)

Una persona compara mapa y lista de farmacias y filtra productos publicados, con precio y disponibilidad referenciales.

**Prioridad**: Integra cercanía con las ofertas verificables de F03.

**Prueba independiente**: Mapa y listado coinciden para farmacias DEMO y ofertas públicas; el listado sigue disponible si el mapa falla.

**Escenarios de aceptación**:

1. **Dado** un conjunto de farmacias activas con coordenadas publicables, **cuando** abre la vista geográfica, **entonces** mapa y listado accesible presentan el mismo conjunto público.
2. **Dado** un producto publicado, **cuando** aplica filtros de producto y proximidad, **entonces** solo aparecen ofertas existentes con precio, disponibilidad referencial y última actualización.
3. **Dado** una farmacia sin coordenadas publicables, **cuando** consulta por ciudad o producto, **entonces** puede leer su dirección textual sin marcador ni distancia inventados.
4. **Dado** fallo del mapa o de las indicaciones, **cuando** continúa la consulta, **entonces** conserva lista y dirección textual con una explicación clara.

### Historia 3 — Corregir ubicación pública autorizada (P3)

Una persona expresamente autorizada para una farmacia corrige su ubicación publicable; otros actores no pueden hacerlo.

**Prioridad**: Mantiene datos fiables y límites entre farmacias.

**Prueba independiente**: La actualización válida registra fecha y auditoría; las solicitudes sin permiso o de otra farmacia no alteran datos.

**Escenarios de aceptación**:

1. **Dado** identidad, permiso explícito, membresía activa y contexto de la farmacia, **cuando** registra dirección y coordenadas válidas, **entonces** se guardan fuente, estado de verificación y fecha, con auditoría.
2. **Dado** ausencia de permiso o una farmacia ajena, **cuando** intenta cambiar la ubicación, **entonces** se deniega sin revelar datos privados ni modificar registros.
3. **Dado** coordenadas inválidas o incompletas, **cuando** intenta publicarlas, **entonces** se rechazan y no aparece un marcador incorrecto.

### Edge Cases

- Coordenadas fuera de rango, parciales, no numéricas o imprecisas; radios nulos, negativos o fuera de los límites aprobados.
- Permiso revocado, ciudad ambigua, ubicación manual ausente, cero resultados y distancias empatadas.
- Farmacias inactivas o sin ubicación; oferta desactualizada. No se promete stock físico ni se afirma «abierto ahora» sin horarios y excepciones verificados.
- Fallo o límite del servicio de mapas: conservar listado y dirección sin exponer datos personales.

## Requirements

### Functional Requirements

- **F07-FR-001**: Cada farmacia autorizada DEBE poder mantener dirección estructurada/publicable, coordenadas, precisión o estado de verificación, fuente y fecha de actualización mediante un flujo autorizado y auditado (GEO-01).
- **F07-FR-002**: La posición del dispositivo DEBE requerir consentimiento explícito; la búsqueda DEBE funcionar con ubicación manual o ciudad cuando el permiso no exista o se revoque (GEO-02, GEO-08).
- **F07-FR-003**: Mapa interactivo y listado accesible DEBEN mostrar únicamente farmacias públicas activas y posiciones publicables; cuando falten coordenadas, DEBE conservarse dirección textual cuando corresponda (GEO-03, GEO-07).
- **F07-FR-004**: La persona DEBE poder seleccionar un radio dentro de límites documentados y ordenar por distancia lineal estimada, diferenciándola de una ruta real (GEO-04).
- **F07-FR-005**: El filtro combinado de producto, cercanía, disponibilidad y precio DEBE utilizar solo ofertas públicas existentes de F03 y mostrar su última actualización; los datos siguen siendo referenciales (GEO-05).
- **F07-FR-006**: El plan DEBE evaluar una solución de mapa sin costo y verificar licencia, privacidad, cobertura y límites antes de activarla. Las indicaciones DEBEN ofrecerse mediante enlace externo autorizado o texto; no se habilitan APIs de rutas ni servicios facturables sin autorización específica. Ante fallo, DEBE conservarse el listado y la dirección (GEO-06, GEO-10).
- **F07-FR-007**: Se DEBEN validar coordenadas, precisión y parámetros geográficos, y señalar posiciones imprecisas o inexistentes sin inventar distancia (GEO-07).
- **F07-FR-008**: La ubicación personal de búsqueda DEBE ser efímera por defecto: no se guarda historial, no se comparte con farmacias y no se expone en datos públicos; cualquier retención futura requiere nueva aprobación (GEO-08).
- **F07-FR-009**: Lecturas geográficas públicas DEBEN limitar campos y abuso; escritura y lectura privada DEBEN exigir identidad, permiso, membresía activa y contexto de farmacia, con RLS y rechazo de accesos entre tenants (GEO-09).
- **F07-FR-010**: El actor autorizado de la farmacia DEBE proponer dirección y coordenadas con evidencia de fuente; un revisor independiente con permiso explícito DEBE comprobar esa evidencia antes de marcar la ubicación como verificada y publicable. La membresía o rol global por sí solos no conceden ese permiso. Una posición pendiente o rechazada NO DEBE presentarse como precisa.
- **F07-FR-011**: Se DEBEN comprobar posiciones ficticias, varios radios, cero resultados, permiso denegado, latencia, orden, corrección autorizada y rechazo de accesos cruzados (GEO-11).
- **F07-FR-012**: F07 NO DEBE incluir rastreo continuo de farmacias, garantías de stock en tiempo real, horarios «abierto ahora» sin datos suficientes, proveedores facturables no autorizados ni cambios de negocio ajenos a F07 (§A6.1–A6.3).

### Aclaraciones aprobadas

- **Q1 — Mapas y rutas (2026-11-18)**: El responsable aprobó evaluar en el plan una solución sin costo, activar el mapa solo tras verificar licencia y privacidad y limitar las indicaciones a enlace externo autorizado o texto. La selección técnica del proveedor permanece sujeta a esa evaluación; no autoriza pagos.
- **Q2 — Verificación de coordenadas (2026-11-18)**: El responsable aprobó que la farmacia autorizada proponga la ubicación y un revisor independiente con permiso explícito confirme la evidencia antes de publicarla como verificada. El plan debe definir controles y separación de funciones sin conceder privilegios por inferencia.
- La respuesta «sí apruebo» se recibió en esta conversación tras presentar ambas decisiones y el borrador F07. Se registra como aprobación de la especificación con estas aclaraciones; cualquier cambio material vuelve a revisión conforme a Constitution XVIII.

### Key Entities

- **Ubicación pública de farmacia**: farmacia vinculada, dirección publicable, coordenadas, precisión, fuente, verificación y fecha. Su proyección pública solo contiene campos aprobados.
- **Consulta de proximidad**: ubicación consentida o ciudad, radio, filtros y distancias estimadas; no representa historial personal.
- **Oferta pública cercana**: farmacia, producto, precio y disponibilidad referenciales, fecha y distancia opcional; procede de F03.
- **Auditoría de cambio**: actor autorizado, farmacia, acción y momento; no incluye la posición personal del visitante.

## Success Criteria

### Measurable Outcomes

- **F07-SC-001**: En cinco farmacias DEMO de posición conocida, el 100 % de distancias, pertenencias a radio y orden de empates coincide con resultados esperados documentados.
- **F07-SC-002**: El 100 % de escenarios con permiso denegado o revocado permiten continuar por ciudad o ubicación manual.
- **F07-SC-003**: El 100 % de marcadores corresponde a farmacias públicas activas con ubicación publicable; el listado sigue disponible si el mapa falla.
- **F07-SC-004**: El 100 % de ofertas geográficas mostradas procede de publicaciones existentes e incluye precio, disponibilidad referencial y actualización.
- **F07-SC-005**: El 100 % de casos negativos definidos para ausencia de permiso, autoelevación y acceso entre farmacias se rechazan sin modificar datos ni filtrar información privada.
- **F07-SC-006**: En pruebas consentidas, manuales y denegadas, no se encuentra historial de posición personal almacenado ni coordenadas privadas en respuestas públicas.
- **F07-SC-007**: En móvil y escritorio DEMO, el 100 % de tareas de localizar una farmacia y leer su dirección pueden completarse mediante listado accesible y teclado.
- **F07-SC-008**: Se miden y registran latencia y resultados con conjunto y umbral aprobados en el plan; no se declara F07 aceptada sin revisar licencias/costos de mapas y los criterios precedentes.

## Assumptions

- F07 parte de la línea base F00–F06 aceptada y del cierre técnico TEST/DEMO de F06.1; las fuentes farmacéuticas y revisión profesional pendientes de F06.1 permanecen separadas.
- F03 ya contiene dirección, coordenadas opcionales, oferta pública referencial y cálculo de proximidad efímero; F07 amplía esa experiencia sin duplicar catálogo.
- Los radios, umbrales de precisión y latencia se concretarán en el plan sin reducir criterios de aceptación.
- No se selecciona ni activa un proveedor de mapas/rutas, se crean recursos AWS ni se altera una base persistente durante esta especificación.
- La membresía TRABAJADOR por sí sola no concede permiso para publicar coordenadas.
