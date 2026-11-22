# Feature Specification: F06 — Asistente IA informativo

**Feature Branch**: `feat/f06-asistente-ia`

**Created**: 2026-11-16

**Status**: Approved — aprobación humana expresa registrada el 2026-11-16

**Input**: Asistente público informativo con MockAIProvider determinista, proveedor desacoplado, herramientas públicas de solo lectura, protección contra abuso y límites clínicos estrictos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Buscar y comparar información verificable (Priority: P1)

Como visitante, quiero formular en español una consulta sobre medicamentos, precios o farmacias para recibir una orientación basada exclusivamente en resultados públicos de FarmaFind.

**Why this priority**: Materializa IA-RF01 sin convertir al modelo en fuente de datos.

**Independent Test**: Con un catálogo ficticio, consultar un producto y una comparación; cada afirmación factual debe corresponder a una herramienta autorizada y mostrar el aviso referencial.

**Acceptance Scenarios**:

1. **Given** resultados públicos verificables, **When** se solicita una búsqueda o comparación, **Then** la respuesta usa esos resultados, identifica su intención y conserva precio, farmacia y fecha de revisión sin alterarlos.
2. **Given** que no existen resultados, **When** se consulta, **Then** declara la ausencia de datos y no inventa inventario, precio, farmacia ni disponibilidad.
3. **Given** una pregunta sobre cómo usar FarmaFind, **When** se solicita ayuda, **Then** explica búsquedas, filtros y reservas sin ejecutar cambios.

---

### User Story 2 - Rechazar consejo clínico (Priority: P1)

Como usuario, necesito que el asistente rechace diagnósticos, dosis, tratamientos y sustituciones para no confundir información del catálogo con consejo sanitario.

**Why this priority**: Es una obligación normativa y de seguridad de la Constitution XIX.

**Independent Test**: Ejecutar un conjunto de preguntas clínicas, ambiguas y de sustitución; todas deben producir un límite claro y remisión a un profesional, sin llamar herramientas innecesarias.

**Acceptance Scenarios**:

1. **Given** una solicitud de diagnóstico, prescripción, dosis, tratamiento o sustitución, **When** se procesa, **Then** se rechaza y se recomienda consultar a un profesional sanitario.
2. **Given** una consulta que mezcla búsqueda y consejo clínico, **When** se procesa, **Then** prevalece la respuesta segura y no se presenta equivalencia terapéutica.
3. **Given** incertidumbre sobre la intención clínica, **When** no puede clasificarse con seguridad, **Then** aplica el límite clínico conservador.

---

### User Story 3 - Continuar sin proveedor externo (Priority: P2)

Como responsable del proyecto, quiero un proveedor mock determinista y desacoplado para demostrar el recorrido sin costo, credenciales ni dependencia de una IA real.

**Why this priority**: Permite pruebas reproducibles y conserva una futura integración mediante autorización independiente.

**Independent Test**: Repetir la misma consulta y conjunto de herramientas; el mock devuelve la misma estructura. Simular fallo o timeout y comprobar una respuesta segura y visible.

**Acceptance Scenarios**:

1. **Given** los mismos datos y consulta normalizada, **When** se invoca el mock repetidamente, **Then** produce el mismo resultado funcional.
2. **Given** un proveedor no configurado o fallido, **When** se consulta, **Then** no intenta una API externa y responde con fallback seguro o indisponibilidad explícita.
3. **Given** una futura implementación de proveedor, **When** se revise la arquitectura, **Then** deberá implementar el puerto aprobado sin cambiar las reglas clínicas, de herramientas o privacidad.

---

### User Story 4 - Proteger el servicio público y la privacidad (Priority: P2)

Como operador, necesito límites por origen, tamaño y uso de herramientas para impedir abuso y filtración de datos privados.

**Why this priority**: El endpoint es público y no debe abrir acceso indirecto a tablas tenant.

**Independent Test**: Superar el límite, enviar payload excesivo, prompt injection, PII y referencias a recursos privados; comprobar 429/4xx, errores genéricos, cero mutaciones y ausencia de contenido sensible en registros.

**Acceptance Scenarios**:

1. **Given** un origen que supera su cuota, **When** vuelve a consultar, **Then** recibe 429 y un tiempo de reintento sin ejecutar proveedor ni herramientas.
2. **Given** instrucciones para ignorar límites o consultar SQL/datos privados, **When** se procesan, **Then** se tratan como texto no confiable y no amplían capacidades.
3. **Given** datos con apariencia personal, **When** se consulta, **Then** no se persisten, reproducen en logs ni envían a terceros.

### Edge Cases

- Consulta vacía, demasiado larga, binaria, con campos extra o tipo incorrecto.
- Homónimos, errores ortográficos y ausencia de resultados públicos.
- Prompt injection que intenta cambiar herramientas, revelar instrucciones o efectuar mutaciones.
- Pregunta clínica indirecta, mezcla clínica/comercial o petición de sustitución “más barata”.
- Herramienta pública indisponible, timeout o respuesta inválida.
- Múltiples solicitudes simultáneas desde el mismo origen y evasión mediante cuerpo variable.
- Identificadores de farmacia conocidos sin autorización: solo pueden resolverse mediante la proyección pública.

## Requirements *(mandatory)*

### Functional Requirements

- **IA-RF01 / F06-FR-001**: F06 DEBE ofrecer consultas informativas públicas en español para búsqueda, comparación y ayuda de uso de FarmaFind.
- **F06-FR-002**: El orquestador DEBE clasificar únicamente las intenciones `BUSQUEDA`, `COMPARACION`, `AYUDA` o `CLINICA_RECHAZADA` mediante una salida validada.
- **F06-FR-003**: Solo DEBE invocar herramientas de lectura equivalentes a `SearchCatalog`, `CompareOffers` y `GetPharmacyDetails`; NO DEBE admitir SQL arbitrario ni herramientas de escritura.
- **F06-FR-004**: Las herramientas DEBEN reutilizar exclusivamente contratos y proyecciones públicas autorizadas de F03.
- **F06-FR-005**: F06 NO DEBE leer sesiones, perfiles, membresías, inventario privado, reservas privadas, auditoría ni datos internos de farmacias.
- **F06-FR-006**: Cada afirmación sobre catálogo, precio, farmacia, distancia o fecha DEBE derivarse de resultados de herramienta incluidos en la misma ejecución.
- **F06-FR-007**: Cuando falten datos verificables, la respuesta DEBE declarar la ausencia y NO DEBE completar valores por inferencia.
- **F06-FR-008**: Toda respuesta factual DEBE mostrar que precio y disponibilidad son referenciales y que la existencia se confirma con la farmacia.
- **F06-FR-009**: Solicitudes de diagnóstico, prescripción, dosis, tratamiento, consumo, contraindicación o sustitución terapéutica DEBEN rechazarse sin recomendación clínica personalizada.
- **F06-FR-010**: Ante intención clínica o incertidumbre clínica DEBE recomendarse consultar a un profesional sanitario.
- **F06-FR-011**: El proveedor operativo inicial DEBE ser `MockAIProvider`, determinista, local y sin red externa.
- **F06-FR-012**: El módulo DEBE definir un puerto de proveedor desacoplado; cualquier proveedor real queda deshabilitado hasta otra especificación y autorización humana.
- **F06-FR-013**: El fallo, timeout o salida inválida del proveedor NO DEBE producir hechos inventados; DEBE usar fallback determinista seguro o error explícito.
- **F06-FR-014**: El endpoint público DEBE aplicar límite por origen antes de clasificar, invocar proveedor o ejecutar herramientas.
- **F06-FR-015**: La entrada DEBE tener contrato estricto, longitud máxima, límite de cuerpo y rechazo de campos adicionales.
- **F06-FR-016**: El número de herramientas por consulta, tiempo de ejecución y volumen de resultados DEBEN permanecer acotados y observables.
- **F06-FR-017**: Prompts e instrucciones externas DEBEN tratarse como datos no confiables y NO DEBEN modificar políticas, herramientas o autorizaciones.
- **F06-FR-018**: F06 NO DEBE persistir el texto de consultas ni respuestas, ni registrar PII, payloads, secretos o instrucciones internas.
- **F06-FR-019**: Errores y métricas DEBEN usar correlación y categorías técnicas minimizadas, sin reflejar la consulta completa.
- **F06-FR-020**: F06 NO DEBE crear reservas, cambiar inventario, modificar precios, autenticar usuarios, enviar notificaciones ni ejecutar pagos.
- **F06-FR-021**: La interfaz React mínima DEBE permitir consultar, mostrar respuesta, fuentes públicas y estados de límite/error sin incorporar el rediseño visual definitivo.
- **F06-FR-022**: Las pruebas DEBEN cubrir grounding, ausencia de datos, determinismo, fallo de proveedor, clínica, prompt injection, PII, rate limit, contratos, herramientas y regresión F00–F05.
- **F06-FR-023**: Fixtures y evidencias DEBEN usar datos ficticios y no consumir APIs externas, AWS ni servicios pagados.
- **F06-FR-024**: La ADR complementaria y las vistas C4 F06 DEBEN aprobarse junto con spec/plan antes de generar código.

### Key Entities

- **Consulta informativa**: texto efímero, origen técnico minimizado y correlación; no se persiste.
- **Intención validada**: una de las cuatro categorías permitidas con parámetros acotados.
- **Invocación de herramienta**: nombre permitido, argumentos públicos y resultado público.
- **Respuesta fundamentada**: texto en español, fuentes/resultados utilizados, aviso referencial y límites.
- **Proveedor IA**: puerto desacoplado; inicialmente solo mock local determinista.
- **Métrica técnica**: categoría, duración, resultado, intención y conteo de herramientas sin contenido del usuario.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **AC-IA01 / F06-SC-001**: El 100 % de respuestas factuales de la batería aprobada puede vincularse a resultados públicos devueltos por herramientas en la misma ejecución.
- **AC-IA02 / F06-SC-002**: El 100 % de solicitudes clínicas, dosis, sustitución y prompt injection de la batería se rechaza sin consejo clínico ni mutación.
- **F06-SC-003**: Cien repeticiones de una consulta con el mismo dataset producen el mismo resultado funcional con el mock.
- **F06-SC-004**: El 100 % de consultas sin resultados declara ausencia de datos y contiene cero precios, farmacias o disponibilidad inventados.
- **F06-SC-005**: Todas las solicitudes que exceden cuota, tamaño o contrato se rechazan antes de proveedor y herramientas.
- **F06-SC-006**: La inspección automatizada de respuestas, errores y métricas encuentra cero secretos, PII, consultas completas o campos privados.
- **F06-SC-007**: Fallo y timeout simulados del proveedor producen fallback/error seguro en el 100 % de los casos, sin acceso externo.
- **F06-SC-008**: Las suites afectadas de F00–F05 permanecen satisfactorias o conservan explícitamente sus pendientes humanos previos.

## Assumptions

- F03 es la única fuente funcional de herramientas públicas; PostgreSQL sigue siendo la fuente oficial y Redis continúa siendo caché derivada de F03.
- El endpoint es público. Una sesión existente no amplía sus datos ni herramientas.
- El límite inicial y los parámetros técnicos se fijarán en el plan; no constituyen autorización para almacenamiento distribuido ni Redis adicional.
- La interfaz será mínima y funcional. El sistema de diseño profesional continúa fuera de F06.
- La tabla antigua del maestro que enumera F07 como IA queda supersedida para este repositorio por el plan actualizado de capítulos 25–36: F05 Notificaciones y F06 Asistente IA.

## Source Traceability

- Documento Maestro v2.0: capítulos 5, 7, 9, 18 y 25–36; flujo seguro y pruebas de los párrafos 184–207; plan actualizado F06 de los párrafos 806–808.
- Constitution v1.1.0: principios II, VI–IX, XIII–XV, XVII–XX; en especial XIX.
- F03: contratos y proyecciones públicas, Cache-Aside y fallback.
- F01/F02/F04/F05: límites privados y ausencia de autoridad de escritura para F06.
- Históricos HU01–HU02, RF01–RF04, AC/RC/DA/ADR aplicables se conservan; IA usa IDs nuevos y no renumera antecedentes.
