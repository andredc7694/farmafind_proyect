# Feature Specification: F06.2 — Asistente FarmaFind AI mejorado (enmienda de F06.1)

**Feature Branch**: `feat/f062-asistente-mejorado` (creada desde `main` `66c5f96`)
**Created**: 2026-11-27
**Status**: **Aprobada por Andre el 2026-11-27** (commit `69ef164`, D-01 a D-10 en A, con ajustes en D-04, D-06 y D-08; ver `approval.md`).
**Input**: pedido de Andre del 2026-11-27 (panel más grande, frases naturales, tarjetas, aclaraciones, «¿Quisiste decir…?», memoria mientras está abierto, contexto de pantalla y reglas de seguridad visibles).
**Trazabilidad**: Maestro v3.2 **MEJ-009** (HU17, RF30: chat flotante minimizable que no pierde contexto, móvil en cajón, privacidad y mensajes claros) y **MEJ-010** (HU18, RF31: herramientas públicas restringidas, cita resultados, compara formulaciones compatibles, nunca prescribe ni hace commit de reservas); F06.1 (spec 009) y su enmienda del 2026-11-25; F03.2; F03.1; F07.1.

## Por qué falla hoy (revisado en el código)
- «¿En qué farmacia el ibuprofeno está más barato?»: el clasificador de prueba (`mock-conversation-provider.ts`) solo busca si ve «precio», «busca», «cuesta» o «dónde hay», o si la frase es un nombre suelto de hasta 4 palabras. «más barato» no activa la búsqueda y la frase tiene 7 palabras: responde «escribe el nombre».
- Las respuestas de precios son texto (`friendly-replies.ts`); no hay tarjetas ni botones.
- La burbuja tiene el mismo tamaño en computadora y en celular.
- La orientación de urgencia no da ningún número.

## Revisión previa (lo aprobado que toca este pedido)

| Fuente | Qué dice | Efecto |
|---|---|---|
| Constitution III | Módulo complementario de búsqueda y comparación **informativa**; herramientas de solo lectura; MockAIProvider determinista; sin escrituras de reservas, stock ni pagos; mostrar carácter referencial y fecha. | Todo sale de las herramientas públicas; el proveedor sigue en MOCK; el botón «Reservar» solo lleva a la pantalla de reserva (D-07). |
| Constitution XIX y F061-FR-007/008/032 | Rechazar diagnóstico, prescripción, dosis, **sustitución** e idoneidad personal; orientar urgencias. | Se mantienen y se hacen visibles. «Algo más barato que X» se acota a comparación de precios de formulaciones compatibles, sin recomendar el cambio (D-04, enmienda). |
| MEJ-010 | «Compara formulaciones compatibles; nunca prescribe ni hace commit de reservas». | Base de D-04 y D-07. |
| F061-FR-002/025 | Conversación limitada que expira; poder borrarla. Hoy: almacén en memoria del servidor 15 min y 6 turnos. | Tu regla «al cerrar o recargar no se guarda nada» → D-01. |
| F061-FR-033 (enmienda 25/11) | «Las preguntas sugeridas solo rellenan el campo». | Enmienda: los botones rápidos y de aclaración pueden enviar (D-10). |
| F061-FR-020 | Toda ampliación de contrato exige versionado. | Respuesta con tarjetas y botones = contrato nuevo versionado (D-05). |
| F03 / F03.2 | Solo farmacias activas, ofertas con stock y campos públicos; limpieza de texto de F03.2. | Se reutilizan sin cambiar reglas ni SQL. |
| F07.1 | Horario público por farmacia (`/farmacias-publicas/horarios`) y farmacias públicas por ciudad. | Base de «¿Qué farmacia está abierta ahora?». |
| F03.1 | Lugar de búsqueda (distrito de la lista o punto aproximado a ~100 m) solo en el navegador. | Base de «cerca» y «¿y en Carmen Alto?». |
| ADR-ROADMAP-V3-002 | US$0. | Sin IA externa, servicios ni librerías nuevas. |

## User Scenarios & Testing

### US1 — Panel grande e interactivo (P1)
1. En computadora, al abrir el asistente se ve un **panel lateral** amplio, con título, botón «Minimizar», historial de la conversación y campo de texto; no tapa la navegación principal.
2. En celular sigue como burbuja; al abrir, ocupa la parte inferior de la pantalla y la burbuja nunca tapa «Buscar», «Reservar» ni el envío de formularios.
3. Al abrir aparecen preguntas rápidas: «¿Dónde está más barato…?», «¿Qué farmacia está abierta ahora?» y «Buscar un genérico».
4. Todo se usa con teclado: Tab llega a cada botón, Enter envía, Escape minimiza; los botones tienen texto claro.

### US2 — Frases naturales (P1)
1. «¿En qué farmacia el ibuprofeno está más barato?» → tarjetas de ibuprofeno de menor a mayor precio.
2. «¿Dónde hay amoxicilina cerca?» con el distrito elegido en la búsqueda → tarjetas por cercanía; sin distrito → «¿En qué distrito estás?» con botones.
3. «¿Qué farmacia está abierta ahora?» → farmacias abiertas ahora (hora de Lima, horario F07.1) en el distrito elegido.
4. «¿Hay algo más barato que Panadol?» → productos con el mismo principio activo y concentración, más baratos, con el aviso de consultar al químico farmacéutico (D-04).
5. Misma limpieza de F03.2: tildes, mayúsculas y «500mg» = «500 mg».

### US3 — Tarjetas, aclaraciones y sugerencias (P1)
1. Respuestas en **tarjetas compactas** (máx. 3): farmacia, producto, precio, distancia (si hay lugar), horario de hoy y «Reservar»; debajo, «Ver todas en Buscar medicamentos».
2. Sin resultados: «No encontré ibuprofeno disponible en las farmacias activas.» y el enlace a Buscar.
3. Varias concentraciones o presentaciones y la frase no dice cuál → «¿Cuál buscas?» con botones (máx. 5 y «Ver todas»).
4. «ibuprofemo», «amoxisilina» → «¿Quisiste decir ibuprofeno?» con botón (D-03).

### US4 — Memoria mientras está abierto y contexto de pantalla (P2)
1. Tras una respuesta de ibuprofeno, «¿y en Carmen Alto?» repite la búsqueda en Carmen Alto; «¿y el de 600 mg?» la afina.
2. Al cerrar el panel o recargar la página, la conversación desaparece y no queda guardada (D-01).
3. Si estoy en «Buscar medicamentos» con «celecoxib», al abrir el asistente propone «¿Quieres ver el más barato cerca de ti?».

### US5 — Seguridad visible (P1)
1. Dosis, diagnóstico, síntomas o tratamiento → respuesta amable: no puede, consulta al químico farmacéutico; ofrece lo que sí puede hacer.
2. Señales de emergencia («dolor de pecho», «no puede respirar», «convulsión»…) → mensaje destacado con **SAMU 106** (Minsa, gratis), Bomberos 116 y Policía 105 (D-08), antes de cualquier otra cosa.

### Edge Cases
- Nombres de varias palabras («ácido acetilsalicílico») y nombres que contienen palabras comunes.
- Frases con dos medicamentos: se pregunta cuál con botones.
- Pregunta de contexto sin conversación previa («¿y en Carmen Alto?» al abrir): se pide el medicamento.
- Distrito fuera de la lista: se dice que no está y se ofrecen los de la lista.
- Farmacia sin horario publicado: «Horario no publicado»; no cuenta como abierta.
- Consultas largas, repetidas o abusivas: límites actuales de F06.1 (500 caracteres y límite por minuto).

## Requirements

### Functional Requirements
- **F062-FR-001**: Panel lateral en computadora y burbuja/hoja inferior en celular, minimizable, sin tapar botones principales (MEJ-009).
- **F062-FR-002**: Preguntas rápidas al abrir; las que necesitan un medicamento rellenan el campo y piden el nombre; «abierta ahora» se envía directa (D-10).
- **F062-FR-003**: Reconocer en frases naturales las intenciones PRECIO, CERCANÍA, HORARIO y ALTERNATIVA (mismo principio activo), además de las de F06.1.
- **F062-FR-004**: Encontrar el medicamento dentro de la frase comparando con nombres y principios activos de las **ofertas públicas**, con la limpieza de F03.2 (D-02).
- **F062-FR-005**: Respuestas con hasta 3 tarjetas compactas y enlace «Ver todas en Buscar medicamentos»; texto equivalente para lectores de pantalla (D-05).
- **F062-FR-006**: Sin resultados, decirlo claramente nombrando el medicamento.
- **F062-FR-007**: Pregunta de aclaración con botones cuando hay varias concentraciones o presentaciones (o varios medicamentos) y la frase no las distingue.
- **F062-FR-008**: «¿Quisiste decir…?» comparando con nombres del catálogo público, sin servicios ni librerías nuevas (D-03).
- **F062-FR-009**: Memoria solo mientras el panel está abierto; nada se guarda al cerrar o recargar (D-01).
- **F062-FR-010**: Contexto de pantalla: en «Buscar medicamentos» con un término, sugerir «¿Quieres ver el más barato cerca de ti?».
- **F062-FR-011**: «Reservar» lleva a la pantalla de reserva existente con farmacia y producto elegidos; el asistente nunca reserva (D-07; F061-FR-012).
- **F062-FR-012**: Rechazo amable de dosis, diagnóstico, síntomas y tratamiento; urgencias con SAMU 106, Bomberos 116 y Policía 105, citando la fuente oficial y su fecha de verificación (D-08).
- **F062-FR-013**: Solo datos públicos: farmacias activas, ofertas publicadas y horario público. Nada de inventario interno, reservas ni datos privados. Sin cambios en las reglas de publicación de F03.
- **F062-FR-014**: Proveedor en MOCK; sin Gemini ni proveedores de pago; sin servicios ni librerías nuevas. US$0.
- **F062-FR-015**: Accesible con teclado; Enter envía; botones con texto claro; mensajes anunciados (`aria-live`).
- **F062-FR-016**: Mostrarlo en la copia temporal 3001/5174 con datos ficticios.

### Key Entities
- **Contexto de conversación (en el navegador):** último medicamento, intención, distrito o punto aproximado, concentración/presentación elegida. Sin datos clínicos ni personales.
- **Tarjeta:** farmacia, producto (nombre, concentración, presentación), precio referencial, distancia, horario de hoy, enlace a reservar.
- **Opción:** texto del botón y la consulta que envía.

## Success Criteria
- **SC-001**: Las 4 frases del pedido (precio, cerca, abierta ahora, más barato que Panadol) dan tarjetas o una aclaración correcta con datos ficticios.
- **SC-002**: «ibuprofemo» y «amoxisilina» sugieren el nombre correcto.
- **SC-003**: «¿y en Carmen Alto?» y «¿y el de 600 mg?» continúan la pregunta anterior; tras recargar, no.
- **SC-004**: 100 % de las pruebas clínicas y de urgencia de F06.1 siguen pasando; las de urgencia muestran 106/116/105.
- **SC-005**: axe sin violaciones graves; todo operable con teclado; en celular la burbuja no tapa botones principales.

## Decisiones para Andre (opción recomendada en **negrita**)
- **D-01 · Memoria de la conversación**
  - **A) Solo en el navegador:** el panel guarda un contexto pequeño en memoria de la página y lo envía con cada pregunta; el servidor no guarda nada. Al cerrar o recargar, desaparece. Cambia el contrato (campo `contexto` validado) y el flujo deja de usar el almacén del servidor.
  - B) Mantener el almacén en memoria del servidor (15 min) y borrarlo al cerrar el panel; tras recargar sigue en el servidor hasta expirar.
- **D-02 · Encontrar el nombre en la frase**
  - **A) Sin SQL:** se quitan las palabras de pregunta («dónde», «está», «más», «barato»…), se busca con la búsqueda F03.2 y se eligen los nombres de las ofertas que aparecen completos en la frase.
  - B) Nueva función SQL que liste los nombres del catálogo público (te presentaría el SQL con su hash).
- **D-03 · «¿Quisiste decir…?»**
  - **A) Sin SQL ni librerías:** la palabra desconocida se compara con candidatos obtenidos buscando sus primeras letras (F03.2) y una distancia de edición escrita en el proyecto. Límite: si el error está en las primeras letras («ivuprofeno»), puede no sugerir.
  - B) Comparar con la lista completa de nombres públicos (requiere el SQL de D-02 B).
- **D-04 · «Algo más barato que Panadol»** (enmienda de F061-FR-007, que prohíbe la sustitución)
  - **A) Formulación compatible e informativa (aprobada con ajuste):** mismo principio activo, misma concentración **y misma forma farmacéutica** (tableta con tableta, jarabe con jarabe…). Si la forma no está clara en el catálogo, **no** se muestra como alternativa. Tarjetas con la etiqueta «Mismo principio activo y concentración» (nunca «genérico») y el aviso «Consulta al químico farmacéutico antes de cambiar de producto». Nunca «es equivalente» ni «puedes reemplazarlo».
  - B) Solo mismo principio activo (puede mezclar concentraciones distintas).
  - C) No responder esta pregunta y remitir al químico farmacéutico.
- **D-05 · Contrato de respuesta:** **A) versión nueva con campos estructurados** (`tarjetas` ≤ 3, `opciones`, `sugerencia`, `verTodas`) y el texto `respuesta` siempre presente. B) Solo texto con formato.
- **D-06 · Panel en computadora:** **A) panel lateral derecho de ~420 px a alto completo, con «Minimizar»** (desde 1024 px de ancho). **Ajuste aprobado:** no debe tapar los resultados de la búsqueda de forma que no se puedan usar; si los tapa, se minimiza con un clic y recuerda estar minimizado mientras dure la visita. B) Ventana flotante más grande, centrada.
- **D-07 · «Reservar» en la tarjeta:** **A) enlace a la pantalla de reserva existente** con farmacia y producto ya elegidos; quien reserva confirma allí.
- **D-08 · Emergencias:** **A) «Si puede ser una emergencia, llama gratis al SAMU 106 (Minsa). Bomberos: 116. Policía: 105.»** con fuente gob.pe y fecha de verificación 2026-11-27, botón de llamada (`tel:`) en celular. **Ajuste aprobado:** aparece antes que cualquier otra respuesta y nunca se mezcla con tarjetas de productos.
- **D-09 · «Abierta ahora» sin distrito elegido:** **A) preguntar «¿En qué distrito?» con botones de la lista (Huamanga).** B) Mostrar todas las farmacias abiertas.
- **D-10 · Botones rápidos y de aclaración:** **A) envían al pulsar** (enmienda de F061-FR-033); los que necesitan nombre rellenan el campo y ponen el foco. B) Siempre solo rellenan el campo.

## Fuera de alcance (segunda etapa, registrada en ESTADO.md, sin empezar)
- Consultar «mis reservas» con sesión.
- Asistente para dueños y trabajadores en el panel (poco stock, reservas pendientes).
- Botones «útil / no útil».
- Activar Gemini u otro proveedor externo; contenido farmacológico educativo nuevo (exige revisión profesional, F061-FR-022).
- También siguen sin empezar: márgenes, ayuda de dirección en el registro (después de T063), corrida de pruebas por investigar y opción C de F03.2.

## Assumptions
- Números de emergencia verificados el 2026-11-27 en gob.pe: SAMU 106 (Minsa, gratuito, 24 h), Policía 105 (PNP), Bomberos 116 (CGBVP).
- El distrito o punto de búsqueda lo conoce la pantalla (F03.1); el asistente lo recibe solo como parte de la pregunta, aproximado.
- F02.5 sigue sin aceptar (T057 y T063 sin marcar) y la spec 020 sigue en opción A.
