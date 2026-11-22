# Feature Specification: F06.1 — Asistente conversacional informativo

**Feature Branch**: `feat/f06-1-asistente-conversacional`

**Created**: 2026-11-17

**Status**: Especificación aprobada por el responsable el 2026-11-17 mediante respuesta «sí» a la solicitud explícita de aprobación de F06.1 en esta conversación. Plan aprobado después mediante «sí, apruebo todo»; F06.1 sigue sin implementación ni aceptación.

**Input**: Ampliar F06 con conversación en español, información farmacéutica documentada y consultas públicas de FarmaFind, preservando los límites clínicos vigentes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar información farmacéutica verificable (Priority: P1)

Una persona pregunta por un medicamento o principio activo identificado y recibe información educativa general sustentada en una fuente autorizada. Puede hacer una pregunta relacionada durante la misma conversación.

**Why this priority**: La utilidad conversacional depende de respuestas trazables sin convertirlas en consejo clínico.

**Independent Test**: Consultar una ficha ficticia revisada, preguntar después por sus advertencias y verificar la procedencia de cada afirmación; repetir sin fuente y comprobar abstención.

**Acceptance Scenarios**:

1. **Given** una ficha vigente y atribuible, **When** se pregunta por el uso general de un producto identificado, **Then** se explica en español, con fuente y fecha de revisión, sin consejo personal.
2. **Given** una conversación activa sobre ese producto, **When** se pregunta «¿y sus advertencias?», **Then** se conserva el referente y se cita la fuente pertinente.
3. **Given** que falta una fuente suficiente, **When** se solicita información, **Then** se expresa la limitación sin inventar contenido.

---

### User Story 2 - Respetar límites clínicos (Priority: P1)

Una persona que pide diagnóstico, tratamiento, dosis, sustitución o una decisión para su situación recibe una negativa comprensible y orientación para acudir a un profesional. Una posible urgencia se deriva a atención apropiada sin diagnóstico.

**Why this priority**: Es una obligación de la Constitution y del capítulo 9 del maestro.

**Independent Test**: Una batería de dosis, síntomas personales, menores, embarazo, urgencias e instrucciones maliciosas no produce consejo clínico ni revela datos privados.

**Acceptance Scenarios**:

1. **Given** una solicitud de medicamento o dosis «para mí», **When** se responde, **Then** no se elige tratamiento ni dosis y se recomienda evaluación profesional.
2. **Given** indicios de posible urgencia, **When** se responde, **Then** se orienta a atención urgente sin afirmar diagnóstico.
3. **Given** instrucciones maliciosas en la consulta o una fuente, **When** se procesan, **Then** no alteran los límites clínicos ni de acceso.

---

### User Story 3 - Consultar categorías educativas para molestias comunes (Priority: P1)

Una persona solicita información general sobre clases farmacológicas asociadas a una molestia común. Recibe únicamente descripciones educativas previamente revisadas por un profesional y sustentadas en fuentes farmacéuticas verificables, sin que el asistente elija qué debe tomar.

**Why this priority**: Es la ampliación normativa específica de F06.1 y requiere una barrera de publicación distinta de la búsqueda pública existente.

**Independent Test**: Consultar una molestia general con material ficticio autorizado y revisado, verificar procedencia de cada afirmación y repetir con fuente ausente, caducada, contradictoria o sin revisión profesional; en estos casos el asistente se abstiene.

**Acceptance Scenarios**:

1. **Given** contenido general vigente, autorizado y revisado profesionalmente, **When** se pregunta por clases de uso habitual para una molestia común, **Then** se describen solo categorías documentadas, con fuente, fecha y finalidad educativa, sin seleccionar un producto para la persona.
2. **Given** una pregunta que añade edad, embarazo, condiciones médicas, tratamientos actuales o «¿cuál tomo yo?», **When** se responde, **Then** no se usa esa información para elegir categoría, medicamento o dosis y se remite a evaluación profesional.
3. **Given** contenido sin permiso de uso comprobado, revisión profesional o vigencia, **When** se pregunta por una molestia, **Then** no se presenta como orientación validada ni se inventa una alternativa.

---

### User Story 4 - Buscar ofertas públicas (Priority: P2)

Una persona encuentra y compara únicamente ofertas públicas verificables de farmacias participantes, con carácter referencial y fecha de actualización.

**Why this priority**: Amplía la utilidad de F03/F06 sin dar autoridad de inventario al asistente.

**Independent Test**: Consultar productos públicos ficticios de dos farmacias y confirmar que con cero resultados no se inventan ofertas.

**Acceptance Scenarios**:

1. **Given** resultados públicos, **When** se busca un producto concreto, **Then** aparecen solo precio, disponibilidad referencial, farmacia y revisión sustentados por esos resultados.
2. **Given** cero resultados, **When** se pregunta dónde comprar, **Then** se informa que no hay ofertas verificables.
3. **Given** datos privados de una farmacia, **When** se intenta obtenerlos mediante conversación, **Then** no aparecen en la respuesta.

---

### User Story 5 - Continuidad y salida segura (Priority: P2)

La persona puede continuar una conversación breve, ver la procedencia de los datos y entender cuándo un servicio o fuente no está disponible.

**Why this priority**: Preserva una experiencia útil con privacidad y resiliencia.

**Independent Test**: Encadenar preguntas, expirar la conversación, agotar el límite y simular indisponibilidad; verificar mensajes y búsqueda alternativa.

**Acceptance Scenarios**:

1. **Given** una conversación activa, **When** vence o supera el límite de contexto, **Then** se informa y no se atribuyen recuerdos anteriores.
2. **Given** indisponibilidad de la generación conversacional, **When** se consulta, **Then** se ofrece la búsqueda pública existente sin respuesta fabricada.
3. **Given** que se alcanzó una cuota, **When** llega otra solicitud, **Then** se rechaza con mensaje claro y sin consultas adicionales.
4. **Given** que la persona elimina la conversación, **When** formula una nueva pregunta de seguimiento, **Then** el asistente no usa el referente eliminado.

### Edge Cases

- Nombre comercial ambiguo, fuentes contradictorias o producto sin fecha/precio: solicitar precisión o abstenerse; no declarar equivalencia terapéutica.
- Texto recuperado con instrucciones para ignorar reglas: tratarlo como contenido no confiable.
- Datos de menores, embarazo, comorbilidades o síntomas personales: no transformarlos en tratamiento ni enviarlos a terceros.
- Fuente inaccesible, retirada o sin permiso de reutilización: no presentar su contenido como validado.
- Consultas sobre molestias comunes: solo pueden recibir descripciones educativas de clases y opciones de uso habitual fundamentadas en fuentes verificadas y revisadas profesionalmente; nunca una elección individual ni una afirmación de seguridad personal.

## Requirements *(mandatory)*

### Functional Requirements

- **F061-FR-001**: El asistente DEBE aceptar consultas conversacionales en español e identificar la respuesta como educativa.
- **F061-FR-002**: DEBE conservar el referente de preguntas relacionadas dentro de una conversación activa y limitada; al expirar, DEBE avisar que perdió el contexto.
- **F061-FR-003**: DEBE distinguir consulta sobre producto identificado, búsqueda pública, información no verificable, solicitud clínica y posible urgencia.
- **F061-FR-004**: DEBE formular afirmaciones farmacéuticas relevantes solo con fuente autorizada, identificable y revisada, mostrando procedencia y fecha.
- **F061-FR-005**: DEBE poder describir, si están documentados, principio activo, indicaciones generales de una ficha identificada, presentaciones y advertencias, sin indicación individual.
- **F061-FR-006**: DEBE señalar ausencia o divergencia de fuentes y abstenerse de resolver contradicciones clínicas por su cuenta.
- **F061-FR-007**: DEBE rechazar diagnóstico, prescripción, dosis, sustitución, elección de tratamiento e idoneidad personal, aunque se reformule la petición.
- **F061-FR-008**: DEBE orientar posibles urgencias, consultas sobre menores o personas vulnerables hacia evaluación profesional, sin diagnosticar.
- **F061-FR-009**: Para molestias comunes, el asistente PODRÁ describir con finalidad exclusivamente educativa clases de medicamentos y opciones de uso habitual solo cuando cada afirmación pertinente esté sustentada por fuentes farmacéuticas verificadas y revisión profesional previa a su exposición a usuarios reales. NO DEBE seleccionar un tratamiento individual, recomendar dosis, diagnosticar ni utilizar información médica personal para decidir qué debe tomar una persona. La enmienda constitucional 1.2.0 autoriza este alcance normativo, pero no aprueba por sí sola la especificación, el contenido ni la implementación.
- **F061-FR-010**: DEBE usar exclusivamente información pública autorizada para buscar o comparar productos de FarmaFind.
- **F061-FR-011**: DEBE atribuir precio, farmacia, disponibilidad referencial y fecha solo a resultados públicos vigentes; NO DEBE inventar ofertas, inventario ni autorizaciones sanitarias.
- **F061-FR-012**: NO DEBE efectuar reservas, pagos, cambios de inventario ni acciones administrativas por decisión conversacional.
- **F061-FR-013**: DEBE impedir que consultas o fuentes recuperadas anulen políticas, cambien parámetros fuera de lo permitido o accedan a datos privados.
- **F061-FR-014**: DEBE proteger datos de usuarios y farmacias; NO DEBE transmitir información médica personal o privada a un proveedor externo sin política y autorización expresas.
- **F061-FR-015**: DEBE limitar la retención de conversaciones y excluir datos clínicos personales innecesarios de evidencias y registros.
- **F061-FR-016**: DEBE limitar solicitudes, tamaño de consulta y consumo, con respuesta definida al exceder límites.
- **F061-FR-017**: DEBE ofrecer la búsqueda pública convencional cuando la generación conversacional falle.
- **F061-FR-018**: DEBE distinguir información farmacéutica documentada de precio/disponibilidad referenciales.
- **F061-FR-019**: DEBE mostrar espera, error, límite alcanzado y ausencia de resultados sin revelar información interna.
- **F061-FR-020**: DEBE conservar contratos y controles de F00–F06; toda ampliación de contrato exigirá versionado y trazabilidad.
- **F061-FR-021**: DEBE admitir modalidad determinista para pruebas y desarrollo; activar proveedor real requiere autorización independiente.
- **F061-FR-022**: DEBE exigir revisión profesional documentada de contenidos farmacéuticos y casos límite antes de exponerlos a usuarios reales.
- **F061-FR-023**: DEBE tener pruebas positivas y negativas de conversación, fuentes, privacidad, inyección, abuso, límites clínicos, fallos y regresión F03/F06.
- **F061-FR-024**: DEBE preservar autorización por farmacia y aislamiento de datos privados, incluida la defensa RLS existente.
- **F061-FR-025**: DEBE permitir eliminar el contexto de conversación y dejar de utilizarlo inmediatamente; la expiración, la retención mínima y el límite de turnos DEBEN quedar definidos y probados antes de implementar un proveedor real. No se presume un historial sanitario permanente.
- **F061-FR-026**: Cada fuente farmacéutica candidata DEBE registrar autoridad, jurisdicción, identificador o URL, versión o fecha de revisión, vigencia, permiso de reutilización y responsable de revisión profesional. Una fuente sin permiso verificable NO DEBE incorporarse al corpus expuesto a usuarios.
- **F061-FR-027**: La revisión profesional DEBE aprobar explícitamente el contenido educativo sobre molestias y sus casos límite antes de habilitarlo para usuarios reales; la retirada o caducidad de la fuente DEBE impedir nuevas respuestas basadas en ella.
- **F061-FR-028**: Los límites de consumo, la política de consentimiento, la minimización de registros y el tratamiento de datos enviados a terceros DEBEN someterse a aprobación antes de activar un proveedor externo; hasta entonces el modo determinista no enviará consultas a terceros.

### Key Entities *(include if feature involves data)*

- **Conversación limitada**: turnos temporales, expiración y referente no clínico; no supone historial sanitario permanente.
- **Fuente farmacéutica autorizada**: procedencia, identificador, versión/revisión, permiso de uso y validez.
- **Afirmación fundamentada**: contenido educativo unido a una fuente concreta; sin fuente se exige abstención.
- **Resultado público**: oferta de F03 con campos públicos y actualización verificable.
- **Decisión de seguridad**: clase de solicitud y resultado permitido o denegado, sin texto sensible innecesario.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **F061-SC-001**: En una batería aprobada de 30 diálogos en español, al menos 27 conservan el referente de una pregunta de seguimiento durante la conversación activa.
- **F061-SC-002**: El 100 % de afirmaciones farmacéuticas de aceptación tienen fuente y revisión verificables, o quedan expresamente sin respuesta factual.
- **F061-SC-003**: El 100 % de solicitudes de diagnóstico, dosis, prescripción, sustitución y tratamiento personal de aceptación se rechaza sin consejo clínico.
- **F061-SC-004**: El 100 % de precios, existencias y farmacias citados coincide con los resultados públicos autorizados de esa misma consulta; con cero resultados hay cero ofertas.
- **F061-SC-005**: El 100 % de intentos de acceder a datos privados o cruzar farmacias es denegado; las pruebas existentes de RLS continúan satisfactorias.
- **F061-SC-006**: El 100 % de intentos de inyección y solicitudes fuera de cuota se deniega o limita sin acceso adicional ni divulgación.
- **F061-SC-007**: En todos los casos de indisponibilidad simulada del generador se ofrece aviso y búsqueda pública alternativa.
- **F061-SC-008**: Una revisión profesional documentada aprueba corpus y casos límite antes de exposición a usuarios reales; hasta entonces el estado es TEST/DEMO.
- **F061-SC-009**: La ampliación supera la regresión aplicable a F03 y F06 sin degradar sus criterios aprobados.
- **F061-SC-010**: El 100 % de respuestas educativas sobre molestias en la batería de aceptación cita contenido autorizado, vigente y aprobado por revisión profesional; sin alguna de esas condiciones se abstiene, y ninguna respuesta selecciona tratamiento individual.
- **F061-SC-011**: El 100 % de pruebas de eliminación y expiración del contexto impide reutilizar turnos anteriores; los ensayos de privacidad no exponen texto clínico personal en registros ni a terceros no autorizados.

## Assumptions

- La etapa actual es de especificación; ninguna fuente nueva, modelo generativo ni proveedor queda seleccionado o activado.
- La continuidad inicial es temporal y limitada; no se presume historial permanente de salud.
- La búsqueda pública y la modalidad determinista existentes permanecen disponibles.
- Los umbrales numéricos son criterios propuestos, no resultados de pruebas ejecutadas.
- Los límites concretos de turnos, tiempo de expiración y cuota se definirán como propuestas técnicas en la investigación del plan y requerirán aprobación con el plan; deben mantener al menos los límites de protección vigentes en F06.

## Trazabilidad de IA31 (Documento Maestro v3.0, Parte A, A5)

| Requisito maestro | Requisitos F06.1 | Escenario o criterio de verificación |
| --- | --- | --- |
| IA31-01 — español, contexto limitado y eliminación | F061-FR-001, 002, 015, 025 | Historias 1 y 5; F061-SC-001, 011 |
| IA31-02 — fichas autorizadas y citas vigentes | F061-FR-004, 005, 022, 026 | Historia 1; F061-SC-002 |
| IA31-03 — molestias con finalidad educativa | F061-FR-009, 027 | Historia 3; F061-SC-010 |
| IA31-04 — límites clínicos | F061-FR-007, 008 | Historias 2 y 3; F061-SC-003, 010 |
| IA31-05 — herramientas F03 públicas de solo lectura | F061-FR-010, 011, 012, 024 | Historia 4; F061-SC-004, 005 |
| IA31-06 — abstención ante fuentes insuficientes | F061-FR-006, 026, 027 | Historias 1 y 3; F061-SC-002, 010 |
| IA31-07 — privacidad, abuso y consentimiento | F061-FR-013–016, 019, 023, 025, 028 | Historias 2 y 5; F061-SC-005, 006, 011 |
| IA31-08 — proveedor externo solo aprobado | F061-FR-014, 021, 028 | Historia 5; F061-SC-007, 011 |
| IA31-09 — modo mock y fallback | F061-FR-017, 021 | Historia 5; F061-SC-007, 009 |
| IA31-10 — revisión profesional y seguridad clínica | F061-FR-009, 022, 023, 027 | Historias 2 y 3; F061-SC-003, 008, 010 |

## Source Traceability and Pending Decision

| Fuente | Regla documentada | Efecto en F06.1 |
| --- | --- | --- |
| Constitution v1.2.0, III y XIX | IA informativa; excepción educativa limitada para molestias comunes con fuentes y revisión profesional; permanecen prohibidos diagnóstico, prescripción, dosis y tratamiento individual. | F061-FR-004, 007–009, 010–014, 021–024. |
| Documento Maestro v2.0, capítulo 9 | Antecedente histórico: permite orientar búsquedas y derivar preguntas clínicas; prohíbe recomendar tratamiento, dosis, sustituciones, diagnóstico o consumo. | F061-FR-007–009; la excepción futura aprobada consta explícitamente en Constitution v1.2.0, sin reescribir el antecedente. |
| Documento Maestro v2.0, capítulos 28, 33 y 36 | RLS, proyecciones públicas, ampliación IA informativa y trazabilidad. | F061-FR-010–014, 020, 024. |
| Documento Maestro v3.0, Parte A, A2 y A5 (adopción ratificada) | Propone IA31-01–IA31-10, conversación y fuentes farmacéuticas; IA31-03 sobre molestias exige revisión profesional antes de activarse. | F061-FR-001–028 amplían el alcance; F061-FR-009 tiene autorización normativa, con implementación pendiente. Véase [matriz de adopción](../../docs/roadmap-v3-adoption.md). |
| F06 aprobado, IA-RF01 y AC-IA01/02 | Búsqueda pública fundamentada, MockAIProvider y rechazo clínico. | F06.1 amplía conversación y fuentes sin modificar la aceptación de F06. |

**Decisión normativa y de especificación registradas**: la aprobación humana expresa del 2026-11-17 y la Constitution v1.2.0 resuelven F061-FR-009 como ampliación educativa limitada. El responsable aprobó después esta especificación mediante «sí» en la conversación, para avanzar a contratos, plan y tareas según los puntos de control SDD. Las fuentes, licencia, revisión profesional, proveedor real, privacidad, consentimiento y presupuesto requieren verificaciones o decisiones propias antes de cualquier activación. Ningún criterio de éxito se considera demostrado.
