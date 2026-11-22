# Feature Specification: F00 — Bootstrap del proyecto FarmaFind

**Feature Branch**: `feat/sdd-aws-multitenant` (rama de trabajo observada; sin cambiar main)

**Feature Directory**: `specs/001-f00-bootstrap-proyecto`

**Feature ID**: F00. El prefijo 001 es la numeración secuencial de Spec Kit, no F01.

**Created**: 2026-11-10

**Status**: Approved — aprobación humana expresa registrada en esta conversación.

**Approved**: 2026-11-10. Aprobación de la especificación aclarada; planificación F00
autorizada mediante invocación expresa de speckit-plan. No autoriza implementación.

**Input**: Especificar exclusivamente una base de proyecto reproducible, segura y trazable,
sin funcionalidades de negocio; mantener las tecnologías y la arquitectura de FarmaFind,
preparar integraciones futuras y diferir Docker a etapas posteriores.

Esta entrega contiene únicamente requisitos. Los escenarios y verificaciones siguientes
describen la aceptación de una futura implementación de F00, autorizada por separado;
no declaran aplicaciones creadas, dependencias instaladas, pruebas ejecutadas o despliegues.

## Clarifications

### Session 2026-11-10

Confirmaciones explícitas del encargo de aclaración, sin inferir aprobación de F00:

- **D01 — Repositorios:** andredc7694/PROYEC_FARMAFIND es el repositorio histórico
  documental; andredc7694/farmafind_proyect es el repositorio oficial de desarrollo SDD.
  F00 y sus futuros artefactos de desarrollo pertenecen al segundo. Las referencias
  históricas conservan repositorio, ruta y revisión; no se trasladan ni reescriben fuentes.
- **D02 — Docker:** no es obligatorio para el arranque local de F00; Docker y Docker
  Compose continúan siendo obligatorios en las etapas posteriores previstas por RC10
  y la arquitectura. El aplazamiento no los vuelve opcionales para el destino del proyecto.
- **D03 — Bootstrap:** F00 distingue el arranque técnico de frontend, API y proceso
  independiente de Notificaciones de sus capacidades de negocio. RLS, Redis operativo,
  AWS, reservas, envío de notificaciones y FarmaFind AI quedan fuera de su implementación.
- **V01 — Ratificación verificada:** durante la aclaración inicial se observó ratificación
  pendiente; posteriormente el usuario ratificó expresamente la Constitución v1.1.0
  el 2026-11-10 y autorizó actualizar sus metadatos. El archivo ya refleja esa ratificación.
  Esta actualización conserva el antecedente y no modifica la Constitución; las decisiones
  D01–D03 no reescriben RC04. La aprobación de F00 y la autorización del plan son expresas
  y separadas de la ratificación; ninguna autoriza código por silencio.

- Q: ¿Para aceptar la futura implementación de F00, las comprobaciones de configuración,
  arranque y separación de componentes deben ejecutarse automáticamente? → A: Opción A,
  confirmada por el usuario: comprobaciones automáticas, reproducibles y ejecutables
  localmente en Windows, con éxito o fallo claro, sobre frontend, backend y servicio
  de Notificaciones; sin requerir Docker, PostgreSQL, Redis, AWS ni servicios externos.
  Esta decisión especifica la aceptación futura; no autoriza generar código o plan ahora.
- Q: ¿La reproducibilidad de F00 puede demostrarse con dos preparaciones limpias realizadas
  por una misma persona, o debe participar una segunda persona? → A: Opción A, confirmada
  por el usuario: dos preparaciones limpias e independientes en Windows, que puede realizar
  una misma persona. Cada una registra comandos utilizados, versiones, resultados esperados,
  resultados obtenidos y errores encontrados. Se mantienen las comprobaciones automáticas
  de configuración, arranque y separación sin Docker, PostgreSQL, Redis, AWS ni servicios
  externos; esta aclaración no autoriza ejecutar el plan ni generar código.
- Q: ¿Qué debe demostrar la comprobación automática para considerar que cada componente
  arrancó correctamente? → A: Opción A, confirmada por el usuario: el frontend React/Vite
  carga una pantalla técnica identificada como bootstrap; el backend Express responde
  mediante un endpoint técnico sin acceder a negocio; Notificaciones responde mediante
  una comprobación técnica local, sin enviar mensajes ni procesar eventos reales.
  Las tres verificaciones son automáticas en Windows, con éxito o fallo identificable,
  sin depender de Docker, PostgreSQL, Redis, AWS ni proveedores externos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Preparar y comprobar el entorno local (Priority: P1)

Como integrante del equipo, quiero preparar una copia limpia del proyecto siguiendo una
guía verificable, para iniciar el desarrollo sin depender de configuraciones personales,
cuentas de nube, contenedores o servicios de negocio.

**Why this priority**: Una base reproducible permite que el equipo trabaje sobre las
mismas condiciones y que un revisor pueda comprobar el bootstrap por su cuenta.

**Independent Test**: En dos preparaciones limpias e independientes en Windows, una misma
persona o personas distintas siguen la misma guía y ejecutan las comprobaciones automáticas,
registrando por preparación los comandos, versiones, resultados esperados y obtenidos,
errores encontrados y estados de frontend, API y Notificaciones.
Se verifica la carga de la pantalla bootstrap, la respuesta del endpoint técnico del
backend y la respuesta de la comprobación local de Notificaciones. Solo se comprueba
arranque técnico; no se utiliza catálogo, inventario ni reservas ni se envían mensajes.

**Acceptance Scenarios**:

1. **Given** una copia limpia y los prerrequisitos documentados, **When** se sigue la
   preparación local, **Then** frontend, API y Notificaciones pueden iniciarse y detenerse
   siguiendo instrucciones versionadas, sin pasos privados ni edición de código fuente.
   La comprobación se repite en una segunda preparación limpia e independiente, aunque
   la realice la misma persona, y cada preparación conserva su propio registro de comandos,
   versiones, resultados esperados, resultados obtenidos y errores encontrados.
2. **Given** que no hay Docker, cuenta AWS, PostgreSQL, Redis ni proveedor IA disponibles,
   **When** se ejecutan las comprobaciones automáticas locales en Windows, **Then** los
   tres componentes demuestran resultados observables: el frontend carga una pantalla
   técnica identificada como bootstrap, el backend responde mediante un endpoint técnico
   sin acceder a negocio y Notificaciones responde a una comprobación técnica local sin
   enviar mensajes ni procesar eventos reales. Las integraciones futuras figuran como
   no configuradas, sin declarar conexión, disponibilidad de datos o salud integral.
3. **Given** una versión de herramienta no admitida o un puerto ocupado, **When** se
   intenta preparar o iniciar el componente afectado, **Then** se identifica el problema,
   su corrección y el resultado fallido, sin mostrar secretos ni informar éxito ficticio.

### User Story 2 - Configurar el proyecto sin exponer información (Priority: P1)

Como integrante del equipo, quiero conocer qué configuración necesita cada componente
y cuál permanece inactiva, para usar valores ficticios sin divulgar credenciales.

**Why this priority**: El bootstrap no debe convertir una prueba local en una conexión
accidental a servicios reales o en una exposición de datos.

**Independent Test**: Se revisa el inventario de configuración y se ejecutan automáticamente
en Windows los casos de configuración mínima válida, variable obligatoria ausente y
valor inválido, registrando resultados de éxito o fallo sin servicios externos.

**Acceptance Scenarios**:

1. **Given** las instrucciones y ejemplos de configuración, **When** se prepara una copia
   local, **Then** todos los valores de ejemplo son ficticios o marcadores inequívocos,
   se distingue configuración pública de privada y no se necesita ninguna credencial real.
2. **Given** una variable obligatoria para el arranque de F00 ausente o inválida, **When**
   se inicia el componente, **Then** se rechaza la configuración con un mensaje que
   identifica el nombre de la variable y el motivo sin imprimir su valor secreto.
3. **Given** que una integración posterior no está habilitada, **When** faltan sus
   credenciales, **Then** no se bloquea el arranque de F00 ni se intenta conectarla;
   tampoco se marca esa integración como probada o segura.

### User Story 3 - Reconocer responsabilidades y límites del bootstrap (Priority: P2)

Como responsable de arquitectura, quiero identificar los componentes y límites del
proyecto, para poder incorporar después cada funcionalidad sin sustituir el diseño histórico.

**Why this priority**: La base debe permitir continuidad arquitectónica sin adelantar
autenticación, persistencia, búsqueda, reservas o IA.

**Independent Test**: Un revisor contrasta la estructura y responsabilidades propuestas
con los siete módulos y las restricciones arquitectónicas, sin ejecutar negocio.

**Acceptance Scenarios**:

1. **Given** la base preparada, **When** se inspecciona su organización, **Then** se
   distinguen los siete módulos históricos dentro de un único núcleo modular, las
   responsabilidades de las cuatro capas y Notificaciones como servicio independiente.
2. **Given** la ampliación FarmaFind AI, **When** se revisa el inventario de componentes,
   **Then** aparece como futura ampliación informativa, sin reemplazar módulos originales,
   sin requerir un proveedor externo y sin afirmar que existe un agente funcional.
3. **Given** la comprobación técnica de F00, **When** se revisan las capacidades expuestas,
   **Then** no existen operaciones funcionales de usuarios, farmacias, catálogo, búsquedas,
   inventario, importación, reservas, envío de mensajes, pagos o consultas IA; cualquier
   pantalla o estado técnico se identifica como bootstrap, sin datos de negocio simulados
   que puedan confundirse con una funcionalidad terminada.

### User Story 4 - Revisar calidad, trazabilidad y aprobación (Priority: P2)

Como revisor académico y humano responsable, quiero comprobar qué aporta F00 y qué queda
pendiente, para aprobar su alcance sin atribuirle el cumplimiento completo del proyecto.

**Why this priority**: La aprobación y la evidencia deben diferenciar requisitos escritos
de preparación implementada y de funcionalidades demostradas.

**Independent Test**: Se recorren los requisitos F00, las fuentes, los controles de
calidad previstos y las 16 filas de la rúbrica, comprobando referencias y pendientes.

**Acceptance Scenarios**:

1. **Given** la especificación y sus fuentes, **When** se revisa su trazabilidad, **Then**
   los 13 puntos del encargo están cubiertos, se conservan los identificadores históricos
   y cada uno de los 16 criterios tiene una contribución acotada o una exclusión expresa.
2. **Given** los controles previstos de calidad, **When** se evalúa la futura entrega
   de F00, **Then** se ejecutan comprobaciones automáticas y reproducibles localmente
   en Windows de configuración, arranque técnico y separación de frontend, backend y
   Notificaciones, con éxito o fallo claro y registrable, sin Docker, PostgreSQL, Redis,
   AWS ni servicios externos; la guía
   distingue estos controles de las suites de negocio y del despliegue todavía pendientes.
3. **Given** un resultado no ejecutado o una decisión no aprobada, **When** se prepara
   la revisión, **Then** se registra como pendiente; esta especificación no genera código,
   plan, tareas, recursos de nube ni cambios en la Constitución y se detiene para aprobación.

### Edge Cases

- Copia en una ruta con espacios en Windows: las instrucciones deben ser utilizables
  sin mover el repositorio ni alterar rutas privadas; una incompatibilidad queda explícita.
- Dependencia o herramienta ausente: identificar el prerrequisito; no instalar globalmente
  ni modificar el equipo de manera silenciosa. No se exige preparar sin acceso a internet
  cuando la futura instalación de herramientas o dependencias lo necesite. Una vez
  preparados esos prerrequisitos locales, las comprobaciones automáticas no deben
  requerir llamadas a servicios externos ni descargas durante su ejecución.
- Variables contradictorias, puerto inválido u ocupado: informar el error y no ocultarlo
  cambiando silenciosamente a un entorno o servicio real.
- Ausencia de base de datos, caché o proveedor IA: marcar integración no habilitada;
  no confundir el arranque del proceso con una comprobación de dependencias no conectadas.
- Un proceso activo sin pantalla bootstrap cargada o sin respuesta técnica local no
  satisface el arranque correcto del componente. Una pantalla que no carga o una
  comprobación que falla debe producir un fallo identificable, no un éxito por existir
  el proceso. Las respuestas técnicas no prueban funcionalidades de negocio ni integraciones.
- Configuración privada confundida con configuración pública del navegador: rechazar
  la exposición; las futuras credenciales de BD, caché, IA y AWS nunca son configuración pública.
- Módulos reservados sin implementación: su presencia estructural no permite afirmar
  que funcionan autenticación, autorización, RLS, transacciones, caché o notificaciones.
- Diferencias entre el maestro y este encargo: el aplazamiento de Docker se registra como
  ajuste del alcance de F00, sin eliminar la obligación futura de contenedores del proyecto.
- Dos repositorios: el desarrollo SDD reside en farmafind_proyect y los antecedentes en
  PROYEC_FARMAFIND; conservar referencias reproducibles sin mover documentos ni declarar
  enmendada la redacción histórica de RC04.
- Repetir únicamente las comprobaciones sobre una preparación ya configurada no demuestra
  dos preparaciones independientes. Cada una parte de una copia limpia de la misma revisión,
  prepara su configuración local desde los ejemplos y genera su propio registro; no se
  sustituyen resultados de la segunda con los de la primera. Se permiten los mismos
  prerrequisitos del equipo y la misma persona, sin exigir otro equipo físico.

## Requirements *(mandatory)*

### Functional Requirements

Los IDs F00-FR son propios de este incremento y no sustituyen RF01–RF13.
Cada fila establece un requisito y su comprobación de aceptación; no prescribe archivos
de aplicación, comandos, paquetes concretos, modelos de tablas ni algoritmos.

| ID | Requisito verificable | Comprobación de aceptación de F00 |
|---|---|---|
| F00-FR-001 | La base DEBE disponer de un procedimiento de preparación, arranque, comprobación y parada local en Windows, con prerrequisitos y versiones compatibles declaradas. Su reproducibilidad DEBE demostrarse con dos preparaciones limpias e independientes, que puede realizar una misma persona. | Ambas preparaciones de la misma revisión y con las mismas instrucciones producen los estados técnicos esperados de los tres componentes, sin pasos privados ni edición de código. Cada preparación registra comandos utilizados, versiones, resultados esperados, resultados obtenidos y errores encontrados; si no hay errores se registra expresamente esa ausencia. |
| F00-FR-002 | La base DEBE conservar React + Vite + JavaScript/JSX en frontend y Node.js + Express + TypeScript en backend; son restricciones heredadas, no elecciones nuevas de este documento. | La revisión de la futura base identifica esas tecnologías y no una migración de lenguaje o framework. |
| F00-FR-003 | El backend DEBE mantener monolito modular y Clean Architecture, con Presentación, Aplicación, Dominio e Infraestructura y dependencias hacia abstracciones internas. | La organización permite identificar las cuatro responsabilidades; el dominio no importa detalles de Express, PostgreSQL, Redis o proveedores y no se crean microservicios por módulo. |
| F00-FR-004 | La base DEBE reconocer Usuarios y roles, Farmacias, Medicamentos, Búsqueda, Inventario, Reservas y Administración como siete módulos principales sin negocio implementado. FarmaFind AI DEBE figurar separadamente como ampliación futura. | Un inventario enumera exactamente esos siete módulos y distingue la ampliación; no existen operaciones de negocio ni un proveedor IA activo. |
| F00-FR-005 | Notificaciones DEBE reconocerse como servicio ejecutable independiente del núcleo, con identificación técnica propia, comprobación técnica local que responda y ciclo de arranque y parada independiente. | Su comprobación automática local en Windows obtiene una respuesta técnica identificable y permite distinguir éxito o fallo; puede detenerse ese proceso sin detener la API. No envía mensajes ni procesa eventos reales en F00. |
| F00-FR-006 | El arranque local de F00 NO DEBE requerir Docker, AWS, servicios PostgreSQL/Redis activos ni una API IA. | En un entorno sin esos servicios se comprueba únicamente el estado de los componentes base, sin conexiones salientes a esas integraciones ni declaración de salud integral. |
| F00-FR-007 | La preparación DEBE describir la configuración por componente: propósito, obligatoriedad en F00, carácter público o privado y valores de ejemplo ficticios; las integraciones futuras deben quedar diferenciadas. | Toda variable requerida por la futura base tiene esas propiedades; los ejemplos permiten preparar F00 sin credenciales reales. |
| F00-FR-008 | La base DEBE mantener secretos y configuración privada fuera de archivos versionados, frontend, registros y evidencias; solo se permiten ejemplos sin secretos. | La revisión de artefactos y salidas no encuentra credenciales reales ni valores privados publicados; una variable obligatoria inválida falla sin imprimir valores sensibles. |
| F00-FR-009 | La preparación DEBE reservar PostgreSQL como única fuente oficial futura de datos y separar persistencia del dominio, sin exigir esquemas de negocio, migraciones o conexión en F00. | Se identifica el límite de persistencia y su configuración futura; no se instala otro almacenamiento como fuente oficial ni se declara una BD funcional. |
| F00-FR-010 | La preparación DEBE registrar el contrato de seguridad futuro: farmacia_id en datos privados, membresías verificadas, autorización por rol/recurso/farmacia, contexto tenant local a la transacción en la misma conexión y RLS sin superusuario ni BYPASSRLS para negocio. | El registro distingue este compromiso de una implementación: no se crean políticas, membresías ni autenticación en F00; quedan identificadas las futuras verificaciones de denegación sin contexto, acceso cruzado, pool y proyección pública segura. |
| F00-FR-011 | La preparación DEBE delimitar Redis como caché futura de búsquedas Cache-Aside con TTL configurable, invalidación posterior al commit y fallback a PostgreSQL, sin dependencia del dominio. | Se identifica su límite y configuración futura; F00 no implementa búsquedas, no necesita Redis y no informa caché operativa ni validación de stock mediante caché. |
| F00-FR-012 | La base DEBE preservar Unit of Work y Transactional Outbox como decisiones para operaciones futuras, con Notificaciones independiente y publicación posterior al commit. | La documentación de responsabilidades conserva esas decisiones; F00 no crea reservas, transacciones de inventario, tablas Outbox, publicadores o consumidores de negocio. |
| F00-FR-013 | La futura implementación de F00 DEBE incluir comprobaciones automáticas, reproducibles y ejecutables localmente en Windows de configuración, arranque técnico y separación de frontend, backend y servicio de Notificaciones, con resultado inequívoco de éxito o fallo y reporte identificable. | Se comprueba que React/Vite carga una pantalla técnica identificada como bootstrap, Express responde mediante un endpoint técnico sin acceder a negocio y Notificaciones responde mediante una comprobación técnica local sin enviar mensajes ni procesar eventos reales. No basta que los procesos estén activos. Las tres verificaciones y la separación se ejecutan sin Docker, PostgreSQL, Redis, AWS ni servicios externos y registran resultados; no basta describir procedimientos manuales ni una prueba vacía. |
| F00-FR-014 | La preparación DEBE identificar la ruta de calidad futura: Vitest/Supertest, Playwright y k6 según corresponda, más controles de cambios para GitHub Actions; F00 exige verificaciones base automáticas locales en Windows y definición del alcance posterior. | Se documentan categorías, ejecución y condiciones de fallo; los controles base se ejecutan sin servicios externos. No se exige crear o ejecutar pipelines remotos, E2E de negocio, carga, despliegues o credenciales CI en F00. |
| F00-FR-015 | La base DEBE conservar compatibilidad objetivo con frontend estático en S3 privado + CloudFront OAC y API/Notificaciones en Lightsail, con PostgreSQL/Redis privados y contenedores futuros. | Se distingue configuración local de futura publicación, no se incrustan secretos o direcciones personales en código y se registra que Docker, DNS, TLS de despliegue, OIDC, backups y recursos AWS se atenderán después, con aprobación. |
| F00-FR-016 | Los antecedentes DEBEN conservarse sin modificación: Constitución, maestro, rúbrica y documentación histórica, incluidos HU01–HU06, RF01–RF13, AC01–AC09, RC01–RC11, DA01–DA09 y ADR-01–ADR-12. El repositorio oficial de desarrollo SDD es andredc7694/farmafind_proyect y el histórico documental es andredc7694/PROYEC_FARMAFIND. | La revisión identifica versiones y referencias con repositorio, ruta y revisión; mantiene los archivos existentes, ubica F00 en desarrollo y no renumera ni reemplaza requisitos ni declara enmendada RC04. |
| F00-FR-017 | F00 DEBE declarar su contribución y límites frente a los 16 criterios del docente sin inventar evidencia, puntajes o cumplimiento. | La matriz contiene las 16 filas de RUBRICA.png; todas distinguen evidencia esperada de resultados pendientes. IA es ampliación adicional, no un criterio 17. |
| F00-FR-018 | Los estados técnicos y errores DEBEN distinguir proceso iniciado, comprobación técnica satisfactoria o fallida, configuración rechazada e integración no habilitada. | Un proceso activo no equivale a una comprobación satisfactoria: se requieren los resultados observables de F00-FR-013. Una integración ausente no se marca disponible; un error muestra componente y causa sin secretos. No se simulan resultados de negocio para superar el control técnico. |
| F00-FR-019 | F00 DEBE mantenerse como única funcionalidad activa y requerir aprobación humana de esta especificación y, posteriormente, de su plan antes de generar código. | Esta entrega termina con spec.md; no hay plan, tareas, implementación ni avance a otra funcionalidad. El texto no convierte aprobación de la Constitución en aprobación de F00. |
| F00-FR-020 | La preparación futura DEBE preservar main y evitar efectos externos no autorizados, cambios irreversibles y uso de datos personales reales. | El trabajo se prepara fuera de main, con datos ficticios; la aceptación de F00 no requiere crear recursos, contratar servicios ni modificar repositorios remotos. |

### Scope Boundaries

**Incluido en el incremento futuro F00, después de las aprobaciones:** base local de los
tres componentes, identificación de módulos y capas sin lógica de negocio, configuración
segura, procedimiento reproducible, comprobaciones técnicas automáticas locales en
Windows sin servicios externos y trazabilidad documental.

**Incluido en esta ejecución de specify:** únicamente este spec.md. Por instrucción del
usuario no se crean checklist separado, puntero .specify/feature.json, plan ni tareas.
La validación de calidad se informa al finalizar, sin añadir otros archivos.

**Fuera de F00:** autenticación y roles operativos; CRUD; catálogo funcional; búsqueda
y comparación; inventario manual o Excel; reservas y concurrencia; políticas RLS y
modelo de datos de negocio implementados; conexiones obligatorias a PostgreSQL/Redis;
Unit of Work/Outbox operativos; envío de notificaciones; agente o mock IA ejecutable;
contenedores, Dockerfiles y Compose; pipeline remoto y despliegue; recursos AWS, DNS,
certificados, backups operativos, carga y pruebas E2E de negocio; pagos e integraciones
externas. Esos trabajos requieren sus especificaciones y aprobaciones posteriores.

El maestro, capítulos 10, 30 y 33, incluye Docker en el arranque inicial. La instrucción
actual del usuario lo difiere expresamente: F00 se acepta con desarrollo local sin Docker.
Esto ajusta la secuencia de entrega, no elimina RC10 ni la arquitectura final en contenedores.
Del mismo modo, preparar PostgreSQL/RLS y Redis en F00 significa documentar límites y
configuración futura, no satisfacer ya AC04, AC05 ni RC11 de manera operativa.

### Traceability to Existing Requirements

| Fuentes o IDs preservados | Contribución concreta de F00 | Límite de la aceptación |
|---|---|---|
| HU01–HU06; RF01–RF13 | Identificar los siete módulos y sus responsabilidades; F00-FR-004, 016. | Ninguna historia o requisito funcional de negocio se considera implementado por F00. |
| RC01–RC03; ADR-01–ADR-05 | Conservar stack, núcleo modular, capas y persistencia futura; F00-FR-002, 003, 009. | Sin CRUD, esquema de negocio ni conexión obligatoria. |
| RC04, RC08, RC10; DA06, DA09 | Reproducibilidad, SDD, conservación documental y controles base; F00-FR-001, 013, 014, 016, 019. | RC10 queda parcialmente preparado; contenedores y pipeline remoto se difieren. D01 fija la relación entre repositorios para F00, sin enmendar la redacción histórica de RC04 ni la Constitución. |
| RC09; ADR-11; DA05, DA08 | Separación de Notificaciones y conservación del contrato Outbox; F00-FR-005, 012. | Sin entrega de mensajes, eventos de negocio o ensayo de caída de cinco minutos. |
| RC11; ADR-07–ADR-08; DA03 | Preparación de Redis y fallback; F00-FR-011. | No se declara Redis operativo ni se mide aceleración de búsquedas. |
| ADR-06; DA04; AC04 | Registro del contrato tenant/RLS y protección de configuración; F00-FR-007, 008, 010. | Sin autorización de usuarios ni RLS implementados o certificados. |
| ADR-09–ADR-10; DA01–DA02; AC05 | Conservar decisiones de transacciones y estados; F00-FR-012, 016. | Sin reservas, compromisos de stock o evidencia de concurrencia. |
| DA07; AC01–AC03, AC06–AC09 | Base independiente de infraestructura externa, comprobable y extensible; F00-FR-001, 003, 006, 013, 015, 018. | No acredita rendimiento, resiliencia, escalabilidad ni observabilidad integral del producto. |
| RC05–RC07; ADR-12 | Mantener los límites históricos y referencias; F00-FR-016. | Pagos, mapas, inventario e importaciones no se implementan. |
| Maestro 9, 18, 26–36; Constitución III, VIII–XIV | Ampliaciones IA, tenant y AWS identificadas; F00-FR-004, 010, 015, 017. | No genera ADR complementarias ni adopta proveedores, ORM o carpetas concretas. |

### Traceability to the 16 Evaluation Criteria

Los títulos proceden de RUBRICA.png. Su columna Puntaje está vacía. La matriz define
contribuciones y evidencia esperada, no resultados obtenidos. En esta entrega todos los
criterios permanecen pendientes de verificación de cumplimiento académico.

| N.º | Criterio del docente | Aporte delimitado de F00 y referencia | Evidencia esperada / trabajo posterior |
|---|---|---|---|
| 1 | Identificación del problema y requerimientos | Relacionar base técnica con el alcance histórico; F00-FR-016, 017. | Referencias al problema y requisitos existentes; no nuevas entrevistas ni validación del negocio. |
| 2 | Análisis y diseño del sistema | Identificar responsabilidades y límites; F00-FR-003, 004, 009–012. | Revisión de organización base; diseño detallado, ERD y contratos de negocio posteriores. |
| 3 | Arquitectura de Bajo y alto nivel | Mantener arquitectura y destino AWS; F00-FR-002–005, 015. | Correspondencia de componentes; ADR complementarias y actualización C4 posteriores. |
| 4 | Desarrollo basado en SDD | Especificación separada y aprobaciones; F00-FR-019. | Este documento para revisión; plan, tareas, convergencia y PR posteriores, no producidos aquí. |
| 5 | Pruebas unitarias e integración | Exigir controles base automáticos locales en Windows; F00-FR-013, 014, 018. | Futura evidencia de configuración, arranque técnico y separación de los tres componentes sin servicios externos; integración con BD, RLS y negocio posterior. |
| 6 | Pruebas End to End | Identificar categoría posterior; F00-FR-014. | Ningún flujo E2E de negocio se exige ni acredita en F00. |
| 7 | Interfaz y experiencia de usuario | Identificación técnica mínima del frontend; F00-FR-001, 004. | Futura comprobación de arranque; interfaces de negocio, accesibilidad y usabilidad completas posteriores. |
| 8 | Escalabilidad del Frontend y backend | Conservar separación y configuración por entorno; F00-FR-003, 015. | Sin pruebas de carga, dos instancias o mejora de rendimiento atribuida a F00. |
| 9 | Escalabilidad de Base de datos | Reservar persistencia oficial desacoplada; F00-FR-009, 010. | Índices, pool real, EXPLAIN y mediciones posteriores. |
| 10 | Configuración de dominio y/o subdominio DNS y CDN | Conservar compatibilidad AWS; F00-FR-015. | Sin DNS, HTTPS de publicación ni CDN desplegado en F00. |
| 11 | Implementación Cache | Registrar alcance futuro Cache-Aside; F00-FR-011. | TTL, invalidación, hit/miss y fallback operativos se verifican posteriormente. |
| 12 | CI/CD | Preparar controles locales reutilizables y alcance de calidad; F00-FR-013, 014. | Pipeline GitHub Actions, credenciales y despliegues remotos posteriores. |
| 13 | Pruebas de Carga k6 | Reconocer pruebas futuras; F00-FR-014, 017. | No scripts de carga, tráfico ni reportes k6 en F00. |
| 14 | Codigo fuente y base de datos en Github | Preservar fuentes y preparar entrega reproducible; F00-FR-001, 008, 016, 020. | Esta entrega no publica código ni BD; migraciones y seeds ficticios se incorporarán con alcance aprobado. |
| 15 | Informe Final | Definir evidencia base identificable; F00-FR-013, 017, 018. | Índice y registros futuros de bootstrap; informe final y resultados del producto posteriores. |
| 16 | Presentación y dominio del Tema | Permitir explicar preparación, límites y pendientes; F00-FR-017, 019. | Revisión humana de alcance; demo funcional y defensa final posteriores. |

### Key Entities

- **Componente base:** frontend, núcleo API o Notificaciones; responsabilidad, estado
  técnico, configuración necesaria y procedimiento independiente de arranque/parada.
- **Perfil de configuración:** variables de un componente y entorno; carácter público
  o privado, necesidad en F00, validación y ejemplo ficticio. No contiene secretos reales.
- **Registro de verificación:** revisión del proyecto, entorno, prerrequisitos,
  identificación de la preparación, comandos utilizados, versiones, resultado esperado,
  resultado obtenido, errores encontrados y limitaciones. Si no se encuentran errores,
  se registra explícitamente. Cada preparación tiene su registro independiente; su ausencia
  implica pendiente, no éxito supuesto. No se diseña una tabla de negocio para almacenarlo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

Estos resultados se evaluarán después de una implementación aprobada. Escribir esta
especificación no los acredita.

- **F00-SC-001:** Dos preparaciones limpias e independientes en Windows de la misma
  revisión, que puede realizar una misma persona, completan preparación, comprobación
  automática y parada de los tres componentes con la misma guía, sin instrucciones privadas
  ni cambios al código. El 100 % de las dos preparaciones conserva su propio registro de
  comandos, versiones, resultados esperados, resultados obtenidos y errores encontrados,
  incluida la ausencia explícita de errores cuando corresponda.
- **F00-SC-002:** El 100 % de los tres componentes puede demostrar su arranque técnico
  mediante resultados observables en comprobaciones automáticas locales en Windows:
  pantalla técnica bootstrap cargada en frontend, respuesta del endpoint técnico del
  backend sin acceso a negocio y respuesta técnica local de Notificaciones sin mensajes
  ni eventos reales. No se requiere Docker, PostgreSQL, Redis, AWS ni servicios externos;
  mantener activos los procesos sin esos resultados no cumple el criterio.
- **F00-SC-003:** El 100 % de las variables utilizadas por la base tiene propósito,
  clasificación y obligatoriedad documentados; cero credenciales reales y cero datos
  personales reales aparecen en ejemplos, artefactos públicos o registros de aceptación.
- **F00-SC-004:** Los tres casos de configuración —mínima válida, obligatoria ausente
  e inválida— producen el resultado esperado; una integración futura no habilitada
  nunca se registra como disponible o probada.
- **F00-SC-005:** La revisión identifica los siete módulos originales, la ampliación
  futura y el servicio independiente sin ambigüedad; cero operaciones de negocio se
  presentan como implementadas por el bootstrap.
- **F00-SC-006:** Los 20 requisitos F00 tienen comprobación de aceptación y los 16
  criterios académicos tienen contribución o exclusión explícita; cero resultados
  no ejecutados se presentan como evidencia real.
- **F00-SC-007:** El 100 % de las comprobaciones de configuración, arranque técnico y
  separación de los tres componentes se ejecuta automáticamente en Windows y ofrece
  un resultado inequívoco y un registro reproducible; ningún fallo de preparación se
  convierte en éxito para cerrar F00. La ejecución no requiere servicios externos.

## Assumptions

- Los usuarios de F00 son integrantes del equipo y revisores; el cliente final de una
  farmacia no recibe una funcionalidad de negocio en este incremento.
- Windows es la plataforma obligatoria de aceptación para las comprobaciones automáticas
  de F00, confirmada por el usuario. Versiones exactas y shell soportado se fijarán en
  el plan revisado; no se exige compatibilidad con otras plataformas ni se presuponen
  versiones externas no verificadas.
- La instrucción actual de diferir Docker prevalece para la secuencia de F00. PostgreSQL,
  RLS, Redis, contenedores y AWS conservan su obligatoriedad en el destino del proyecto.
- No se eligen ahora ORM, gestor de paquetes, puertos, esquema de carpetas, mecanismo
  de autenticación, modelo IA, región AWS o plan de costos. Son decisiones posteriores;
  su ausencia no impide revisar los requisitos de F00.
- Se conserva la rama existente distinta de main. Sin hooks registrados no se crea
  otra rama; el directorio de especificación es independiente de su nombre.
- La Constitución v1.1.0 se utiliza como referencia ratificada el 2026-11-10, sin
  modificarla. La ratificación no constituye aprobación del futuro plan ni permiso
  para generar código.

### Sources and Dependencies

| Fuente consultada | Uso y límites |
|---|---|
| .specify/memory/constitution.md, versión 1.1.0 | Principios I–XX, matriz de rúbrica, continuidad histórica, aprobaciones y límites. El archivo permanece intacto. |
| docs/referencias/FarmaFind_Documento_Maestro_Definitivo_AWS_Multitenant_SDD.docx, versión interna 2.0 | Documento leído en las revisiones precedentes; contrastados para F00 los capítulos 5–6, 10–11, 16–19, 25–36 y en particular la delimitación F00/F01 del capítulo 33. Diseño y trabajo previsto, no código ni resultados existentes. |
| docs/referencias/RUBRICA.png | Imagen inspeccionada; 16 criterios con Puntaje vacío. No se asignan ponderaciones ni calificaciones. |
| andredc7694/PROYEC_FARMAFIND, revisión 56d3ef9d334a96df400a29d1e0c52e8a6cd696f0 | Documentación histórica consultada en esta sesión; para F00 se releyeron docs/01-analisis-de-sistema/05-restricciones.md y 07-decisiones-arquitectonicas.md mediante GitHub. RC01–RC11 y ADR-01–ADR-12 fundamentan la preparación. |
| docs/referencias/PROYEC_FARMAFIND.rar | Archivo localizado, no extraído ni utilizado como fuente: fue posible leer el histórico remoto autorizado. No se presume identidad de contenido con GitHub. |
| Plantilla activa spec-template | Resuelta mediante .specify/scripts/powershell/resolve-template.ps1; se conservan las secciones y su orden. |

Referencia histórica reproducible:
https://github.com/andredc7694/PROYEC_FARMAFIND/tree/56d3ef9d334a96df400a29d1e0c52e8a6cd696f0.
Los datos actuales del repositorio no se deducen del diseño de ese antecedente.

### Pending Human Decisions

- La especificación F00 aclarada fue aprobada expresamente el 2026-11-10, incluida su
  delimitación local sin Docker, sin persistencia/caché operativas y sin pipeline remoto.
  La planificación está autorizada; sus propuestas requieren aprobación humana posterior.
- Regularizar mediante decisión humana separada la divergencia entre RC04/el repositorio
  único del maestro y D01, que fija el repositorio oficial de desarrollo y el histórico.
  La relación operativa ya está confirmada para F00; esta ejecución no enmienda antecedentes.
- Ratificación de la Constitución resuelta: v1.1.0 ratificada expresamente el 2026-11-10.
  Esta planificación no modifica sus metadatos ni principios.
- En el plan de F00: aprobar versiones y requisitos de equipo, organización física,
  gestor de dependencias, configuración mínima y controles base. No se requiere decidir
  autenticación, esquema de negocio, proveedor IA o presupuesto AWS para aprobar este alcance.

Las decisiones D01–D03 proceden del encargo explícito y las tres preguntas de esta sesión
fueron respondidas e integradas. No quedan preguntas bloqueantes de comportamiento o
aceptación de F00; rutas y formato de las comprobaciones, versiones, shell y organización
física se difieren al plan, no a nuevas funcionalidades. Los pendientes de aprobación y
regularización documental anteriores siguen requiriendo decisión humana, sin aprobación
por silencio.
La especificación está aprobada y la planificación fue autorizada expresamente.
La generación de código permanece detenida hasta aprobación humana del plan y autorización
de la fase correspondiente.
