# Feature Specification: F03 — Consultas públicas de medicamentos y farmacias

**Feature Branch**: `feat/f03-consultas-publicas`

**Created**: 2026-11-12

**Status**: Especificación y plan aprobados expresamente por el usuario el 2026-11-12; implementación F03 en curso y aceptación pendiente de evidencia.

**Input**: Continuar el siguiente incremento funcional sustentado por el capítulo 33 del Documento Maestro Definitivo v2.0. F03 corresponde a «Consultas públicas»: proyección pública del catálogo e inventario publicado, búsqueda y comparación referencial con caché y fallback. El capítulo 10 conserva una secuencia histórica distinta; prevalece la secuencia actualizada del capítulo 33 sin alterar los identificadores históricos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Encontrar un medicamento sin iniciar sesión (Priority: P1)

Como visitante quiero buscar por nombre comercial o principio activo y ver las farmacias participantes que registran disponibilidad, para saber dónde consultar el producto.

**Why this priority**: Es el recorrido público central de HU01 y RF01–RF02.

**Independent Test**: Con medicamentos y dos farmacias ficticias publicados, una búsqueda sin sesión encuentra coincidencias por ambos tipos de nombre; una búsqueda sin coincidencias muestra un estado vacío comprensible.

**Acceptance Scenarios**:

1. **Given** una referencia publicada con nombre comercial y principio activo, **When** un visitante busca por cualquiera de los dos, **Then** obtiene la misma referencia y las farmacias activas con disponibilidad registrada de esa presentación.
2. **Given** una consulta válida sin coincidencias, **When** se realiza la búsqueda, **Then** se muestra un mensaje de ausencia de resultados sin inventar productos o farmacias.
3. **Given** un visitante sin sesión, **When** busca o abre un resultado público, **Then** puede hacerlo sin autenticarse y no recibe campos privados.
4. **Given** una presentación distinta o una farmacia sin disponibilidad registrada, **When** se buscan ofertas, **Then** no se confunden presentaciones ni se anuncia esa farmacia como disponible.

---

### User Story 2 - Comparar ofertas referenciales (Priority: P1)

Como visitante quiero comparar precio, disponibilidad registrada, ubicación y fecha de revisión de distintas farmacias, para decidir dónde consultar antes de desplazarme.

**Why this priority**: HU02 y RF03–RF04 exigen que el resultado sea útil y claramente referencial.

**Independent Test**: Con dos ofertas ficticias de una misma presentación, el visitante identifica precio, disponibilidad, dirección textual y última revisión de cada una; aplica filtros y ordenaciones verificables.

**Acceptance Scenarios**:

1. **Given** dos farmacias activas con la misma presentación publicada, **When** se muestran sus resultados, **Then** cada oferta identifica farmacia, precio referencial, disponibilidad referencial, dirección y fecha de revisión efectiva.
2. **Given** ofertas con distintos precios y cantidades disponibles, **When** el visitante filtra u ordena por precio o disponibilidad, **Then** los resultados corresponden al criterio elegido y mantienen una ordenación estable ante empates.
3. **Given** una ubicación voluntariamente proporcionada y datos de ubicación utilizables, **When** el visitante ordena por cercanía, **Then** el orden refleja las distancias calculables; las ofertas sin distancia calculable se identifican sin fingir una distancia.
4. **Given** ubicación no disponible o fallo de mapas, **When** el visitante consulta resultados, **Then** conserva búsqueda, precio y dirección textual, y se informa que la distancia o el mapa no están disponibles.
5. **Given** un resultado con datos de inventario revisados anteriormente, **When** se consulta o refresca la página, **Then** la fecha mostrada sigue siendo la revisión de la farmacia y no la hora de consulta.

---

### User Story 3 - Continuar la consulta si falla la caché (Priority: P1)

Como visitante quiero que la búsqueda siga funcionando durante una falla de la caché, para no perder acceso a información pública.

**Why this priority**: La continuidad de búsqueda forma parte de HU01, RC11 y AC02/AC08.

**Independent Test**: Con el mismo conjunto de datos ficticios, una búsqueda con caché disponible y otra con caché indisponible producen el mismo contenido público autorizado; la falla se registra como limitación técnica sin exponer detalles al visitante.

**Acceptance Scenarios**:

1. **Given** una consulta repetida con entrada válida y vigente, **When** se repite, **Then** se obtiene el mismo conjunto público y se puede comprobar que la entrada temporal fue reutilizada.
2. **Given** ausencia o caducidad de entrada temporal, **When** se busca, **Then** se consulta la fuente oficial y se entrega el resultado público.
3. **Given** indisponibilidad de la caché, **When** se busca, **Then** se obtiene el resultado desde la fuente oficial sin exigir que el visitante reintente manualmente.
4. **Given** un cambio confirmado de catálogo, estado público de farmacia, precio o inventario, **When** se realiza una nueva consulta tras la invalidación pertinente, **Then** no se presenta como vigente la entrada anterior; una falla de invalidación queda acotada por caducidad y el resultado continúa marcado como referencial.

---

### User Story 4 - Consultar sin revelar datos privados (Priority: P1)

Como farmacia participante y como visitante quiero que una consulta pública revele solo datos expresamente publicables, para mantener el aislamiento de las farmacias y de las personas.

**Why this priority**: El acceso público requiere una frontera verificable frente a inventario interno, membresías, importaciones, movimientos y reservas.

**Independent Test**: Una batería positiva confirma los campos públicos; una negativa intenta consultar identificadores, parámetros y respuestas manipuladas y verifica la ausencia de información privada de Alfa y Beta.

**Acceptance Scenarios**:

1. **Given** dos farmacias ficticias con inventario privado, **When** cualquier visitante busca, **Then** recibe solo la proyección pública permitida y no obtiene movimientos, compromisos, importaciones, membresías, auditoría ni datos de reservas.
2. **Given** una farmacia desactivada o una referencia no publicada, **When** el visitante busca por nombre o identificador, **Then** no aparece como oferta disponible.
3. **Given** una consulta malformada, excesiva o con parámetros no admitidos, **When** se envía, **Then** se rechaza de forma controlada sin consultar datos privados ni revelar detalles internos.
4. **Given** resultados de las farmacias Alfa y Beta, **When** se reutiliza una entrada temporal o una conexión, **Then** no se filtran datos privados entre farmacias ni se amplía el conjunto de campos públicos.

### Edge Cases

- Una consulta vacía o compuesta solo por espacios no ejecuta una búsqueda general ilimitada.
- Una búsqueda con acentos, mayúsculas o espacios habituales mantiene coincidencias coherentes; la normalización no fusiona presentaciones distintas.
- Una farmacia activa sin dirección o ubicación utilizable se identifica claramente; no se inventan mapa ni distancia.
- Precio o fecha de revisión ausentes no se sustituyen por valores inventados; la oferta muestra el dato como no disponible y conserva el carácter referencial.
- Una invalidación fallida no modifica el inventario ni convierte Redis en fuente oficial; se registra el fallo y se limita la antigüedad de la entrada.
- Cambios de filtros, orden o paginación no reutilizan una entrada temporal de otra consulta.

## Requirements *(mandatory)*

### Functional Requirements

- **F03-FR-001**: El sistema DEBE permitir la búsqueda pública, sin sesión, por nombre comercial o principio activo de medicamentos publicados.
- **F03-FR-002**: Cada resultado DEBE distinguir la referencia y presentación del medicamento y mostrar solo farmacias activas con disponibilidad digital registrada de esa presentación; ausencia de coincidencias DEBE producir un estado vacío explícito.
- **F03-FR-003**: Cada oferta pública DEBE mostrar identidad pública de la farmacia, precio referencial, disponibilidad referencial, dirección textual y fecha de última revisión efectiva cuando existan; la interfaz DEBE indicar los datos ausentes sin inventarlos.
- **F03-FR-004**: La interfaz DEBE advertir que precio y disponibilidad son referenciales, pueden variar y no acreditan existencia física ni constituyen una reserva.
- **F03-FR-005**: El visitante DEBE poder filtrar u ordenar resultados por disponibilidad y precio; la cercanía DEBE estar disponible solo cuando exista ubicación voluntaria y datos suficientes, con alternativa de dirección textual.
- **F03-FR-006**: Los resultados DEBEN ser paginados y ordenados de forma estable, con límites de consulta y de tamaño de página definidos en el contrato posterior para evitar respuestas ilimitadas.
- **F03-FR-007**: La búsqueda DEBE seguir disponible ante ausencia, expiración o fallo de la caché mediante consulta a la fuente oficial. La caché NO DEBE confirmar stock, autorizar operaciones ni sustituir la fuente oficial.
- **F03-FR-008**: Las entradas temporales de búsqueda DEBEN tener caducidad configurable e invalidarse después de confirmar cambios relevantes de catálogo, farmacia o inventario, incluidos ajustes e importaciones. El valor histórico propuesto de 60 segundos NO constituye una garantía de frescura ni cambia la fecha de revisión.
- **F03-FR-009**: La identidad de cada consulta temporal DEBE distinguir término normalizado, filtros, ordenación, página y demás parámetros que alteren el resultado; NO DEBE contener credenciales, tokens ni datos personales o privados innecesarios.
- **F03-FR-010**: La salida pública DEBE estar limitada a una proyección expresamente permitida del catálogo, farmacias e inventario referencial. NO DEBE revelar inventario interno detallado, cantidad comprometida, movimientos, importaciones, reservas, membresías, auditoría ni credenciales.
- **F03-FR-011**: El acceso público NO DEBE desactivar ni eludir el aislamiento multi-tenant y las políticas RLS de datos privados. El servidor DEBE rechazar parámetros y consultas que pretendan convertir una búsqueda pública en acceso privado.
- **F03-FR-012**: Las entradas de búsqueda DEBEN validarse y limitarse; los errores DEBEN ser comprensibles y no divulgar SQL, rutas internas, secretos ni datos de otras farmacias.
- **F03-FR-013**: La búsqueda pública DEBE conservar dirección textual y continuidad de consulta si un proveedor de mapas o la geolocalización no está disponible.
- **F03-FR-014**: Consultar, repetir, refrescar caché o calcular disponibilidad pública NO DEBE modificar inventario, compromisos ni fecha de revisión.
- **F03-FR-015**: Las verificaciones DEBEN cubrir coincidencias positivas y vacías, filtros y orden, paginación, campos públicos permitidos, ausencia de datos privados, farmacias desactivadas, caída de caché, caducidad, invalidación posterior al cambio confirmado y aislamiento A/B.
- **F03-FR-016**: El sistema DEBE registrar evidencias reproducibles de rendimiento de búsqueda con y sin caché, percentiles, errores, aciertos/fallos, uso del fallback y condiciones de prueba; una medición solo se declarará cumplida si fue ejecutada.
- **F03-FR-017**: F03 DEBE integrarse con las referencias y existencias ya aprobadas en F02 y la frontera de identidad F01, sin crear rutas de alta privilegiada ni modificar sus reglas de autorización.
- **F03-FR-018**: F03 NO DEBE implementar reservas, pagos, notificaciones de negocio, concesión de privilegios, alta de farmacias, FarmaFind AI ni el rediseño visual profesional.

### Key Entities

- **Referencia de medicamento**: identidad pública y atributos normalizados de una presentación del catálogo común.
- **Farmacia pública**: identidad, estado de participación y dirección publicable; los datos administrativos privados permanecen separados.
- **Oferta pública referencial**: proyección de una referencia disponible en una farmacia, con precio, disponibilidad calculada y fecha de revisión efectiva; no equivale a stock físico confirmado.
- **Consulta pública**: término, filtros, orden y página que determinan el resultado; no contiene una identidad privada de farmacia.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **F03-SC-001**: En las pruebas de aceptación, el 100 % de consultas válidas por nombre comercial o principio activo encuentra las referencias esperadas del conjunto definido, y el 100 % de consultas sin coincidencias muestra un estado vacío.
- **F03-SC-002**: El 100 % de ofertas del conjunto de aceptación muestra los datos públicos disponibles y señala explícitamente los ausentes; ninguna respuesta incluye un campo privado prohibido.
- **F03-SC-003**: El 100 % de escenarios de filtros, ordenación y paginación del conjunto definido entrega resultados correctos y estables; la falta de ubicación no impide buscar ni leer la dirección.
- **F03-SC-004**: El 100 % de búsquedas del escenario controlado de caída de caché sigue devolviendo el resultado público desde la fuente oficial, sin intervención manual del visitante.
- **F03-SC-005**: En una carga y un conjunto de datos documentados, el p95 de búsqueda es ≤ 2 segundos y los errores técnicos son < 1 %; se comparan resultados con y sin caché, sin atribuir una mejora no medida.
- **F03-SC-006**: El 100 % de intentos definidos para obtener campos privados o datos ajenos mediante la búsqueda pública es rechazado o devuelve únicamente la proyección pública autorizada.
- **F03-SC-007**: En todos los cambios confirmados del conjunto de aceptación, la búsqueda posterior a la invalidación refleja el dato publicable actualizado y la fecha de revisión solo cambia si hubo revisión efectiva.

## Assumptions

- F03 usa el catálogo y el inventario F02 y la información pública permitida de farmacia; los fixtures de demostración seguirán siendo ficticios y aislados. La publicación operativa de nuevas farmacias o referencias continúa sujeta a las autorizaciones de F01/F02.
- La disponibilidad digital mostrada es físico registrado menos comprometido y puede diferir de la existencia física. Se aplica la regla histórica de no ofrecer como disponible una cantidad no registrada.
- La ubicación del visitante es opcional. Sin ubicación válida, cercanía no se presenta como distancia verificada y los demás criterios funcionan.
- Los límites concretos de longitud, página, caducidad y carga de prueba se justifican en el plan y contrato; no se presentan aquí como valores aprobados distintos de la propuesta histórica de 60 segundos.
- El mecanismo de publicación pública debe preservar PostgreSQL RLS y los límites de F01/F02. Su diseño concreto requiere plan y pruebas reales antes de implementar.

## Traceability and status

| Fuente | Correspondencia F03 | Estado |
|---|---|---|
| Documento Maestro Definitivo v2.0, capítulos 5–7, 13–15, 27–29 y 33 | Módulo Búsqueda; RF01–RF04; consultas públicas, proyección segura, Redis Cache-Aside, fallback y pruebas. El capítulo 33 sitúa F03 después de F02. | Requisito documentado; F03 aún no implementada. |
| Constitución ratificada v1.1.0, principios VII–IX, XIII–XVIII y restricciones históricas | PostgreSQL fuente oficial, RLS, caché con fallback, datos referenciales, pruebas y aprobación SDD. | Normativa vigente. |
| Documentación histórica PROYEC_FARMAFIND: HU01–HU02, RF01–RF04, AC01/02/03/04/06/07/08/09, RC01/02/03/06/08/11, DA01/03/04/05/06/07/09 y ADR-01/03/04/05/06/07/08 | Búsqueda y comparación pública con aislamiento y resiliencia; conservar códigos originales sin renumerar. | Fuente histórica leída; los criterios no se declaran cumplidos. |
| F02 aprobado: spec.md, FR-020 y data-model.md | Catálogo e inventario internos preceden a la proyección pública de F03. | Dependencia documental; no se alteran F02 ni sus pendientes. |
| Rúbrica oficial de 16 criterios | F03 aporta trazabilidad directa a 1–7, 9, 11 y 13; 8, 10, 12 y 14–16 conservan seguimiento transversal del proyecto. | No se asignan puntajes ni evidencias no ejecutadas. |

La especificación y el plan F03 fueron aprobados expresamente el 2026-11-12. La implementación solo puede acreditarse con sus pruebas y evidencias reales; la aceptación permanece pendiente. GLO-01 y BOOT-01 siguen bloqueados para ejecución; esta especificación no los desbloquea.
