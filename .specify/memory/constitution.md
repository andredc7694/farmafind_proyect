<!--
Sync Impact Report — material temporal de revisión; retirar antes de un futuro commit.
Versión: 1.0.0 propuesta → 1.1.0 propuesta, ampliación normativa basada en fuentes leídas.
Principios ampliados sin renombrar: III (IA híbrida), VIII (RLS), IX (alcance Redis),
XI (AWS definitivo como destino), XIII (herramientas), XIV (rúbrica), XV (drivers e historia).
Secciones ampliadas: Restricciones y continuidad documental; Flujo de desarrollo y evidencias;
Governance (estado y versión). Se añaden matriz de 16 criterios y clasificación documental.
Secciones normativas eliminadas: ninguna. Se corrigen avisos de fuentes ausentes.
Plantilla activa resuelta con resolve-template.ps1 constitution-template -Json.
No se modificaron plantillas ni documentos históricos. No existe extensions.yml.
Resueltos: TODO(MASTER_DOCUMENT), TODO(RUBRIC_SOURCE); DOCX v2.0 y RUBRICA.png leídos.
Pendientes: TODO(RATIFICATION_DATE), TODO(DOCUMENTATION_LAYOUT), ADR complementarias,
planes y parámetros operativos por aprobar; no equivalen a fuentes ausentes.
No se ejecutaron commits, despliegues ni otras funcionalidades de Spec Kit.
-->

# FarmaFind Constitution

Estado: propuesta oficial para revisión humana, pendiente de ratificación.
Redacción: 2026-11-10, según la fecha del usuario en America/Lima.
DEBE y NO DEBE expresan obligaciones verificables.

## Core Principles

### I. Spec-Driven Development con GitHub Spec Kit

FarmaFind DEBE utilizar Spec-Driven Development con GitHub Spec Kit. Cada funcionalidad
DEBE disponer de especificación, clarificaciones necesarias, plan, tareas y pruebas
vinculadas con criterios de aceptación. Las decisiones DEBEN ser trazables a requisitos;
el código NO DEBE sustituir a la especificación como definición del alcance.

### II. Siete módulos principales permanentes

El núcleo DEBE conservar Usuarios y roles, Farmacias, Medicamentos, Búsqueda, Inventario,
Reservas y Administración, con responsabilidades y contratos públicos delimitados.
«Usuarios» es el antecedente histórico de Usuarios y roles. Ninguna extensión DEBE
eliminar, fusionar implícitamente o reemplazar estos siete módulos.

### III. FarmaFind AI complementario e informativo

FarmaFind AI DEBE añadirse como módulo complementario de búsqueda y comparación
informativa, sujeto a los mismos contratos y controles de acceso. DEBE usar fuentes
identificables y datos autorizados, señalar información ausente o desactualizada y
permitir continuar con la búsqueda convencional si falla. NO DEBE asumir autoridad
sobre inventario ni alterar las reglas de reservas. Su implementación exige especificación
y plan aprobados y DEBE respetar los límites clínicos del principio XIX.

Según los capítulos 9, 18, 33 y 36 del maestro, DEBE adoptar una arquitectura híbrida:
búsqueda determinista como fuente de hechos, MockAIProvider predeterminado y determinista
sin llamadas pagadas, y LLM externo opcional detrás de un puerto configurable.
SearchCatalog, CompareOffers y GetPharmacyDetails representan herramientas de solo lectura;
sus contratos DEBEN validar intención y parámetros y NO DEBEN permitir SQL arbitrario ni
escrituras autónomas de reservas, stock o pagos. La salida DEBE fundarse exclusivamente
en resultados autorizados y mostrar su carácter referencial y fecha de revisión.
La ampliación DEBE documentarse como IA-RF01 y AC-IA01/02, sin reutilizar códigos históricos,
con ADR complementaria y C4 revisado antes de implementarla. Gemini Flash-Lite es un
candidato documental, no una selección aprobada ni una garantía de gratuidad.
El proveedor solo DEBE invocarse desde backend con límites de longitud, llamadas,
herramientas, tasa por usuario/IP, timeout y presupuesto, observando consumo y fallback.
NO DEBEN enviarse datos clínicos personales, identificadores, reservas ni credenciales.
Antes de uso real se DEBEN revisar condiciones vigentes y obtener consentimiento informado.
Las pruebas DEBEN cubrir prompt injection, PII, alucinaciones, límites y fallo de proveedor;
los E2E DEBEN funcionar con mock y datos ficticios sin depender de una API externa.

### IV. Frontend establecido

El frontend DEBE utilizar React + Vite + JavaScript/JSX, accesible desde computadora y
celular mediante navegador. Un cambio de lenguaje o framework DEBE tramitarse como
una enmienda aprobada, no como una decisión incidental de una funcionalidad.

### V. Backend establecido

El backend DEBE utilizar Node.js + Express + TypeScript. Las API REST DEBEN documentarse
mediante OpenAPI, validar entradas, manejar errores consistentemente y autorizar las
operaciones protegidas. El frontend DEBE comunicarse mediante HTTPS y JSON en despliegues.

### VI. Monolito modular y Clean Architecture

El núcleo DEBE ser un monolito modular con capas de Presentación, Aplicación, Dominio e
Infraestructura y dependencias dirigidas hacia las abstracciones internas. El dominio
NO DEBE depender de Express, PostgreSQL, Redis ni proveedores externos. Los módulos
DEBEN comunicarse mediante contratos públicos. Se DEBEN conservar Repository, Adapter,
Dependency Injection y DTO/Command, además de los patrones del principio X.
La separación de Notificaciones NO autoriza fragmentar el núcleo en microservicios.

### VII. PostgreSQL como fuente oficial

PostgreSQL DEBE conservar los datos oficiales de usuarios, farmacias, medicamentos,
inventario, movimientos, reservas y Outbox. Las escrituras críticas DEBEN utilizar
transacciones, restricciones y control de concurrencia. Redis y la IA NO DEBEN confirmar
stock ni reemplazar PostgreSQL como autoridad de datos.

### VIII. Aislamiento multi-tenant por farmacia y RLS

El sistema DEBE combinar autorización por rol, recurso y farmacia con PostgreSQL
Row-Level Security en los datos sujetos a aislamiento. El contexto tenant DEBE derivarse
de la identidad autenticada y sus permisos verificados; NO DEBE confiarse únicamente
en identificadores enviados por el cliente. El acceso administrativo transversal DEBE
ser explícito, limitado y auditable. Los roles de ejecución NO DEBEN eludir RLS
implícitamente. El contexto DEBE aislarse entre transacciones, conexiones reutilizadas,
trabajos y cachés. La búsqueda pública solo DEBE exponer datos públicos autorizados.
Las pruebas DEBEN demostrar rechazo de lecturas y escrituras entre farmacias no autorizadas.

El modelo definitivo del maestro, capítulos 27–29 y 36, DEBE ser pooled: una infraestructura
PostgreSQL con tablas compartidas y farmacia_id en registros privados, más membresías
explícitas usuario–farmacia con rol, estado y delegaciones. Un usuario con varias farmacias
DEBE elegir establecimiento activo y el servidor DEBE verificarlo en cada operación.
RLS DEBE cubrir lectura, inserción, actualización y borrado mediante políticas USING y
WITH CHECK. El contexto tenant validado DEBE establecerse localmente a la transacción,
en la misma conexión de sus consultas; sin contexto válido se DEBE denegar acceso privado.
El rol de aplicación NO DEBE ser superusuario ni tener BYPASSRLS; la propiedad de tablas
NO DEBE permitir eludir políticas y se DEBE aplicar FORCE ROW LEVEL SECURITY cuando
corresponda. Roles de migración, mantenimiento, supervisión y workers DEBEN tener políticas
explícitas y auditadas. Claves foráneas, unicidad compuesta e índices DEBEN revisarse
para impedir relaciones cruzadas. El SQL del capítulo 28 es ilustrativo, no una migración final.
La búsqueda DEBE usar DTO o proyecciones públicas seguras sin desactivar RLS ni exponer
tablas privadas de inventario, movimientos, importaciones, reservas o auditoría.

### IX. Redis Cache-Aside con fallback a PostgreSQL

Redis DEBE ser obligatorio en el MVP para búsquedas mediante Cache-Aside, con TTL
configurable e invalidación posterior al commit de cambios relevantes, incluidos ajustes
e importaciones. Ante ausencia de una entrada o fallo de Redis, se DEBE consultar
PostgreSQL. Las claves DEBEN respetar el alcance de autorización. NO DEBEN almacenarse
credenciales ni datos privados innecesarios en la caché de búsquedas. Los 60 segundos
de TTL son una propuesta histórica configurable, sujeta a validación; el TTL NO acredita
existencia física ni sustituye la fecha de revisión del inventario.

Redis DEBE permanecer privado, accesible por componentes autorizados de API y sin puerto
6379 público. Su alcance obligatorio es caché de resultados de búsqueda; NO DEBE ampliarse
a autoridad transaccional o almacén de datos privados. La caché de intenciones no sensibles
mencionada como opción en el capítulo 9 NO se adopta aquí: requiere decisión específica
compatible con la restricción del capítulo 6. Las métricas DEBEN incluir hit/miss, latencia,
invalidación, memoria, errores y utilización del fallback.

### X. Unit of Work, Transactional Outbox y Notificaciones

Unit of Work DEBE coordinar el compromiso atómico de stock, la reserva y el evento Outbox
en una misma transacción PostgreSQL. Un fallo DEBE revertir el conjunto. Redis y llamadas
externas NO DEBEN participar en esa transacción. Notificaciones DEBE ejecutarse como
servicio independiente. El publicador DEBE enviar eventos después del commit mediante
HTTPS/REST interno autenticado, conservar pendientes y aplicar reintentos. El consumidor
DEBE deduplicar trabajos mediante identificadores persistentes de evento; NO DEBE
prometer entrega externa exactamente una vez sin garantías verificadas del proveedor.
Una falla de Notificaciones NO DEBE impedir registrar reservas.

### XI. Arquitectura AWS propuesta

La arquitectura objetivo definitiva del maestro v2.0, capítulos 25–36, DEBE conservar
S3 privado + CloudFront para la SPA compilada y Lightsail Linux con Docker Compose para
API sin estado, Notificaciones como proceso separado, PostgreSQL y Redis privados.
S3 DEBE usar Block Public Access y origen regional estándar con CloudFront Origin Access
Control (OAC), HTTPS y resolución de rutas SPA. Los assets DEBEN versionarse y index.html
DEBE tener una política de caché corta definida en el plan.
El VPS DEBE usar proxy HTTPS, certificado válido, healthchecks, CORS explícito, cabeceras
de seguridad y puertos mínimos; PostgreSQL DEBE tener volumen persistente y acceso por
red interna, y Notificaciones y Redis NO DEBEN exponerse directamente a internet.
Los registros DNS, TTL y endpoints DEBEN documentarse; comprar dominio o usar Route 53
es opcional y requiere aprobación de costo y validación del criterio docente 10.
RDS PostgreSQL y Redis administrado son evolución posterior, no requisitos del primer despliegue.

Se DEBEN conservar Docker, Docker Compose, migraciones, seeds ficticios y observabilidad.
El CI/CD objetivo DEBE usar GitHub Actions con checks de PR, entornos protegidos y revisión
humana; para AWS DEBE preferir OIDC con IAM acotado a repositorio, rama y entorno o
credenciales temporales mínimas. Un merge NO autoriza por sí solo despliegues facturables.
Cada release DEBE identificar revisión, artefactos, salud y rollback; se DEBEN ejecutar
smoke de HTTPS, autenticación y aislamiento después de un despliegue autorizado y
detener la promoción si fallan las comprobaciones.
PostgreSQL DEBE contar con backup lógico periódico cifrado, retención, copia fuera del
servidor cuando sea posible y restauración mensual probada. RPO y RTO DEBEN definirse y
medirse. Un único Lightsail es punto único de fallo para API, Notificaciones, BD y Redis;
NO DEBE presentarse como alta disponibilidad. AC02 exige un ensayo controlado con dos
réplicas API y balanceador, declarando los fallos restantes. La topología es un destino
documentado, todavía no evidencia de despliegue ni autorización de recursos.

### XII. Autorización previa de recursos AWS facturables

Está prohibido crear recursos AWS facturables sin autorización humana explícita previa.
Antes de solicitarla, se DEBEN presentar recursos concretos, propósito, región, costos
estimados, duración y procedimiento de eliminación. La autorización DEBE registrarse con
su alcance. Disponer de cuenta o de una oferta gratuita NO equivale a autorización.
Las validaciones sin recursos aprobados DEBEN realizarse localmente o por simulación,
identificando el entorno real utilizado.

El presupuesto DEBE contemplar almacenamiento, transferencia, DNS, backups, monitoreo
y ventanas de carga. AWS Budgets y sus alertas NO DEBEN tratarse como techo universal
de gasto. Región, capacidad, costos vigentes y plan de apagado/eliminación DEBEN
verificarse antes de solicitar aprobación; las cifras del maestro son referencias
documentales y NO constituyen una cotización actual ni una capacidad garantizada.

### XIII. Pruebas según requisitos y riesgo

Cada funcionalidad DEBE justificar y ejecutar pruebas unitarias, de integración, E2E,
de seguridad y de carga según corresponda. Una categoría no aplicable DEBE justificarse
en el plan y revisarse humanamente. Las reglas de negocio exigen pruebas unitarias;
transacciones, RLS, Redis y Outbox exigen integración; los recorridos afectados exigen
E2E; permisos y aislamiento exigen seguridad; búsqueda y reservas concurrentes exigen
carga. Los resultados DEBEN ser reproducibles y trazables a criterios de aceptación.
Una prueba no ejecutada NO DEBE declararse aprobada.

La selección documental de referencia del capítulo 36 DEBE conservar Vitest, Supertest,
Playwright y k6 para unitarias/integración, API, E2E y carga respectivamente, con PostgreSQL
y Redis reales de prueba cuando se valide integración. Prisma, Tailwind y la estructura
de carpetas siguen siendo propuestas y NO se adoptan por esta mención. El ORM elegido
DEBE demostrar compatibilidad con Unit of Work, bloqueo y contexto RLS en el pool.

### XIV. Evidencias de los 16 criterios de la rúbrica

El proyecto DEBE mantener una matriz de los 16 criterios exactos de la rúbrica oficial,
vinculando cada uno con requisitos, artefactos, pruebas, resultados y evidencias
localizables. Cada evidencia DEBE identificar revisión o versión, fecha, entorno,
procedimiento y resultado. Las simulaciones DEBEN identificarse. RUBRICA.png fue leída
y contrastada con los capítulos 18 y 35; su columna Puntaje está vacía. NO DEBEN inventarse
ponderaciones, calificaciones ni cumplimiento. La entrega NO DEBE declararse
completa respecto de la rúbrica sin comprobar los 16 criterios.

### XV. Continuidad de requisitos y decisiones históricas

Se DEBEN conservar identificadores y contenido aplicable de HU01–HU06, RF01–RF13,
AC01–AC09, RC01–RC11, DA01–DA09 y ADR-01–ADR-12 consultados. Los planes DEBEN verificar compatibilidad
con sus fuentes. Un conflicto DEBE registrarse con referencias, impacto y resolución
humana mediante una decisión trazable o enmienda; NO DEBE eliminarse ni reescribirse
el antecedente. AWS, RLS y FarmaFind AI están documentados en el maestro v2.0; las nuevas
decisiones DEBEN registrarse en ADR complementarias sobre despliegue AWS económico con
evolución, modelo multi-tenant/RLS y agente informativo con presupuesto controlado.
Estas ADR y sus especificaciones requieren aprobación; esta revisión NO las crea.
Los capítulos 25–36 prevalecen sobre recomendaciones anteriores de AWS y multitenencia;
NO autorizan renumerar ni sustituir los requisitos o ADR históricos.

### XVI. Protección de main

Está prohibido realizar cambios directos en main, incluidos commits, push directo y
force-push. Los cambios DEBEN prepararse en otra rama y pasar por pull request, revisión
humana y controles aplicables antes de integrarse. Al configurar GitHub se DEBE proteger
main para impedir que se omitan estos controles.

### XVII. Una funcionalidad por vez

Solo DEBE existir una funcionalidad activa en el flujo de especificación, planificación
e implementación del equipo y sus agentes. Sus tareas DEBEN permanecer dentro del
alcance aprobado. Iniciar otra exige cerrar la actual o registrar su suspensión y la
decisión humana de cambiar de prioridad, conservando sus pendientes.

### XVIII. Aprobación humana antes de generar código

La especificación y el plan DEBEN recibir aprobación humana explícita, registrada y
asociada a la revisión aprobada antes de generar código de la funcionalidad, incluidos
prototipos y pruebas ejecutables. Generar documentos o tareas NO equivale a aprobarlos.
Los cambios materiales de alcance o arquitectura DEBEN volver a revisión antes de generar
el código afectado. El agente NO DEBE autoaprobar documentos ni inferir aprobación
por silencio, tiempo transcurrido o disponibilidad de herramientas.

### XIX. Límites clínicos y veracidad de la IA

FarmaFind AI y los agentes de IA del proyecto NO DEBEN diagnosticar, prescribir,
recomendar dosis ni inventar información de inventario, precios o disponibilidad.
Las comparaciones DEBEN limitarse a información verificable y NO DEBEN presentarse
como equivalencia terapéutica, sustitución de medicamentos o consejo clínico personalizado.
Ante una consulta clínica, DEBEN expresar el límite y remitir a un profesional de salud;
ante falta de datos, DEBEN declarar esa ausencia. NO DEBEN confirmar existencia física
ni alterar inventario por inferencias. Las evaluaciones DEBEN incluir consultas clínicas
y solicitudes para las que no existan datos verificables.

### XX. Datos ficticios, credenciales y privacidad

Desarrollo, demostraciones y pruebas DEBEN usar datos ficticios claramente identificados.
NO DEBEN incorporarse datos personales reales ni inventarios reales como fixtures.
Las credenciales DEBEN mantenerse fuera del repositorio, documentos, prompts, capturas,
cachés y registros, mediante configuración externa y acceso mínimo necesario.
Las evidencias DEBEN excluir secretos y datos personales. Una exposición DEBE activar
revocación o rotación y registro del incidente sin reproducir el secreto.

## Restricciones y continuidad documental

Las especificaciones afectadas DEBEN conservar estas reglas históricas:

- Las búsquedas por nombre comercial o principio activo son públicas y permiten filtrar
  u ordenar por precio, disponibilidad o cercanía. DEBEN mostrar precio y disponibilidad
  referenciales, dirección y fecha de revisión por la farmacia. Si falla mapas, DEBE
  permanecer la dirección textual. Consultar, recargar caché o comprometer stock NO DEBE
  renovar la fecha de revisión del inventario.
- El stock disponible digital DEBE ser físico registrado menos comprometido. NO DEBE
  existir stock negativo, sobreasignación ni sobrescritura de compromisos. Crear una
  PENDIENTE NO garantiza existencia física.
- Las reservas DEBEN seguir PENDIENTE → CONFIRMADA, CANCELADA o EXPIRADA;
  CONFIRMADA → ENTREGADA, CANCELADA o EXPIRADA. Los tres últimos estados son terminales.
  Solo dueño, administrador o personal expresamente delegado DEBE aceptar una PENDIENTE
  vigente después de comprobar físicamente el producto. La entrega exige CONFIRMADA
  vigente y autorización. Cancelación y expiración DEBEN liberar compromisos una sola
  vez; la entrega DEBE descontar físico registrado y comprometido.
- PENDIENTE DEBE tener un plazo de respuesta configurable, inicialmente 20 minutos.
  Las 24 horas desde la aceptación son una propuesta inicial configurable para la
  recogida de CONFIRMADA, sujeta a validación; NO constituyen un único plazo de respuesta.
- Ante STOCK_FISICO_INSUFICIENTE se DEBE cancelar PENDIENTE y registrar liberación única,
  incidencia, movimiento y alerta Outbox en una transacción. La corrección física exige
  conciliación de compromisos restantes. Alertas y recordatorios NO DEBEN alterar stock.
- Inventario DEBE incluir registro manual e importación obligatoria .xlsx/.csv con vista
  previa, validación y mapeo al catálogo general sin duplicidades. La plantilla propuesta
  contiene nombre, concentración, presentación, precio referencial y stock físico;
  las columnas reales DEBEN validarse con farmacias, sin suponer uniformidad.
  La importación DEBE ser atómica por archivo: una fila inválida o no conciliada impide
  guardar todas y exige un reporte de errores. Al confirmar se DEBEN revalidar compromisos
  concurrentes sin guardar físico inferior al comprometido. movimientos_inventario DEBE
  conservar producto, farmacia, cantidades anterior y nueva, motivo, responsable y fecha.
- Cada farmacia DEBE administrar sus precios y existencias; FarmaFind DEBE supervisar.
  Las farmacias desactivadas NO DEBEN admitir nuevas reservas. Cada cliente solo DEBE
  consultar sus propias reservas. Pagos electrónicos y sincronización automática de
  inventarios externos DEBEN permanecer fuera del MVP; prever puertos no autoriza
  implementarlos. Si se aprueban pagos futuros, DEBE utilizarse una pasarela externa
  sin almacenar datos sensibles de tarjetas.

Fuentes consultadas y límites de la revisión, al 2026-11-10:

| Fuente | Alcance verificado |
|---|---|
| Solicitudes del usuario | Los 20 principios originales y esta revisión limitada a constitution; no autorizan código, commits, cambios históricos ni despliegues. |
| Plantilla activa de Spec Kit y constitución 1.0.0 propuesta | Plantilla resuelta por resolve-template.ps1; se conserva su jerarquía y los 20 principios, ampliados con fuentes ahora disponibles. |
| docs/referencias/FarmaFind_Documento_Maestro_Definitivo_AWS_Multitenant_SDD.docx | Versión interna 2.0, noviembre de 2026. Leídos todos los capítulos 0–36, incluidos 25–36, tablas, encabezado y pie. Extracción XML de 929 párrafos en orden documental; sin imágenes embebidas. No se ejecutaron instrucciones ni ejemplos incluidos en el Word. |
| docs/referencias/RUBRICA.png | Imagen inspeccionada visualmente: 16 criterios, columna Puntaje vacía. Contrastada con capítulos 18 y 35 del maestro. Los nombres de la matriz inferior siguen la imagen. |
| andredc7694/PROYEC_FARMAFIND, documentación histórica | Releídos mediante GitHub docs/01-analisis-de-sistema/02-historias-de-usuario.md, 03-requisitos-funcionales.md, 04-atributos-de-calidad.md, 05-restricciones.md, 06-drivers-arquitectonicos.md y 07-decisiones-arquitectonicas.md. La búsqueda sigue mostrando la revisión 56d3ef9d334a96df400a29d1e0c52e8a6cd696f0 como referencia; no se afirma que no existan otras ramas. |
| Arquitectura y diseño históricos revisados en la primera redacción | README.md, docs/02-arquitectura/estilo-arquitectonico.md, docs/03-diseño-de-software/diseño-interno/patrones-de-diseño.md y docs/04-modelo-c4/Nivel4-DiagramadeCodigo.md. Sus imágenes enlazadas no se inspeccionaron; no se certifica su sincronización visual. |
| Referencias externas citadas por el maestro | No revalidadas en esta revisión documental. Antes de contratar servicios o utilizar comandos se DEBEN verificar versiones, condiciones y precios vigentes; no se presume actualidad por estar citados en el Word. |

Referencia histórica reproducible:
https://github.com/andredc7694/PROYEC_FARMAFIND/tree/56d3ef9d334a96df400a29d1e0c52e8a6cd696f0.
Los archivos históricos releídos conservaron los blobs RF 1578d94e64aa2c69231f89b232c2ed476feb4a88,
AC fde79e511a32fb1f603619c03bc113f0e18acc80, RC 9afe3126362e2d8635c10260db331db99f505826,
DA 55c396a3bebd3c407733b7cd0fcd026d2e9dd5f9, ADR 66964f4dd857e3625ada59cad4f1fbbafe445692
y HU 979dfebc7a257a03f80be78720d5792535726adf, según las respuestas GitHub consultadas.

Integridad SHA-256 de las fuentes locales leídas:

- Documento maestro: 761e59cf403c0d153c8fcbbe535f48f991bdd3789e8f2eca0e20dd76cf3faf05.
- Rúbrica: 184f2fef8446fd69d62b63c41396b998261d10126801f5606a3b86066ac51f41.

Los drivers DEBEN conservar su sentido y trazarse sin renumeración: DA01 confiabilidad
del inventario, DA02 consistencia concurrente, DA03 búsquedas rápidas, DA04 protección
por recurso, DA05 integración desacoplada, DA06 mantenibilidad, DA07 crecimiento y
continuidad, DA08 resiliencia de Notificaciones y DA09 decisiones demostrables con
evidencias. RLS amplía DA04 y AWS amplía DA07/DA09 mediante decisiones complementarias;
ninguno sustituye esos drivers.

La clasificación documental DEBE distinguir:

- **Base documentada:** requisitos y ADR históricos, los 16 criterios de la imagen y las
  decisiones destino AWS/RLS del maestro v2.0. Documentado NO significa implementado,
  ratificado como constitución, contratado ni validado mediante pruebas.
- **Propuesta de implementación:** Prisma, Tailwind, proveedor/modelo LLM, capacidad
  Lightsail, carpetas, rutas API orientativas y parámetros operativos. Requieren planes
  y decisiones aprobados; los ejemplos SQL del maestro NO son migraciones finales.
- **Pendiente de implementación/verificación:** aplicación y configuración destino,
  políticas RLS, integraciones, pipelines, despliegue, pruebas y métricas sin evidencia
  ejecutable aportada en esta revisión. Ningún resultado se da por aprobado o existente.

Inconsistencias y decisiones que DEBEN permanecer visibles hasta revisión humana:

- TODO(DOCUMENTATION_LAYOUT): RC04 y capítulos 0 y 25 del maestro prevén un repositorio
  único/referencia histórica; el usuario identifica farmafind_proyect como desarrollo
  y PROYEC_FARMAFIND como histórico. Se DEBE aprobar la relación y trazabilidad entre
  ambos sin cambiar los antecedentes. Esta revisión no migra ni modifica documentos.
- Los capítulos 10 y 33 proponen numeraciones F00–F08 diferentes; el 33 es la referencia
  actualizada para AWS/tenancy. Su secuencia DEBE ratificarse al planificar; NO se deben
  mezclar IDs, abrir features ni generar tareas en esta revisión constitucional.
- Los capítulos 11 y 25 muestran estructuras de carpetas alternativas. Ninguna DEBE
  declararse existente o aprobada sin un plan revisado. El proveedor LLM y el ORM tampoco
  quedan elegidos por aparecer como candidatos.
- El capítulo 9 contempla caché de intenciones como opción, mientras el 6 limita Redis
  a búsquedas. Se conserva el alcance obligatorio de búsquedas; cualquier ampliación
  requiere una decisión específica revisada.
- El punto único de fallo de Lightsail NO elimina AC02. La prueba de dos réplicas y
  balanceador DEBE distinguir caída de API de caída de host/BD y reportar sus límites.
- C4 nivel 4 registra deuda visual; se DEBEN revisar C4 y vista de despliegue al aprobar
  ADR complementarias. NO se alteran diagramas históricos en esta revisión.
- Deben aprobarse ADR complementarias AWS, RLS y AI, especificaciones y planes,
  políticas de acceso global/workers, dominio/DNS, presupuesto/región/capacidad, RPO/RTO,
  retención y proveedor opcional antes de sus acciones dependientes. La ausencia de
  puntajes en RUBRICA.png NO autoriza asignar ponderaciones.

## Flujo de desarrollo y evidencias

1. Seleccionar una funcionalidad y su rama. Identificar HU, RF, AC, RC, DA, ADR y criterios
   de rúbrica aplicables, con fuentes y conflictos pendientes.
2. Elaborar y aclarar la especificación mediante Spec Kit. Registrar aprobación humana
   de su revisión antes de avanzar al diseño de implementación.
3. Elaborar el plan, contratos, modelo de datos, controles tenant, pruebas y riesgos.
   Revisar cumplimiento constitucional y registrar aprobación humana del plan.
4. Descomponer en tareas y comprobar consistencia documental. Generar código únicamente
   con ambas aprobaciones vigentes y dentro del alcance autorizado.
5. Ejecutar verificaciones, reunir evidencias y presentar pull request. El cierre exige
   revisión humana y resultados verificables; los pendientes DEBEN quedar expresos.
   Los recursos AWS facturables requieren además la autorización del principio XII.

La siguiente matriz DEBE guiar la trazabilidad de los 16 criterios de RUBRICA.png,
contrastados con los capítulos 18 y 35. La columna de evidencia prescribe entregables
futuros; NO declara que existan ni asigna resultados. Todos quedan **pendientes de
verificación de cumplimiento** en esta revisión; contar con documentación fuente solo
acredita su lectura, no el cumplimiento académico. Las asociaciones son trazabilidad
constitucional y NO nuevas calificaciones del docente.

| N.º | Criterio de RUBRICA.png | Trazabilidad documental / constitucional | Evidencia exigida para verificar cumplimiento |
|---|---|---|---|
| 1 | Identificación del problema y requerimientos | Maestro 2–4, 7, 18 y 35; HU01–HU06, RF01–RF13; principios I, XV | Problema de Huamanga, comparación referencial, actores y permisos, diagnóstico exploratorio con límites y matriz de requisitos. |
| 2 | Análisis y diseño del sistema | Maestro 5, 8, 12–13, 27–29; DA01–DA06; principios VI, VIII, X | UML/ERD, claves tenant, membresías, DTO público, contratos OpenAPI y diseño interno revisados. |
| 3 | Arquitectura de Bajo y alto nivel | Maestro 6, 25–28, 34; ADR-01–ADR-12; principios VI–XI, XV | C4 niveles 1–4, patrones, ADR complementarias y vista de despliegue AWS coherentes. |
| 4 | Desarrollo basado en SDD | Maestro 10, 19, 33; RC08, DA09; principios I, XVII, XVIII | Constitution y spec/plan/tasks/análisis/convergencia por feature, aprobaciones trazables y PR revisado. |
| 5 | Pruebas unitarias e integración | Maestro 14, 29, 35; AC04–AC08; principios VIII, X, XIII | Reportes reales Vitest/Supertest de reglas, permisos, RLS, pool, UoW, rollback y contratos entre servicios. |
| 6 | Pruebas End to End | Maestro 15, 29, 35; HU01–HU06; principios VIII, XIII | Playwright: buscar, comparar, reservar, aceptar, entregar; cancelación/expiración, importación y usuarios de dos farmacias sin acceso cruzado. |
| 7 | Interfaz y experiencia de usuario | Maestro 2, 15, 18, 35; HU01–HU06; principios II–IV | Capturas escritorio/móvil, accesibilidad, estados de carga/error, prueba de usabilidad, farmacia activa y permisos visibles, disponibilidad y fecha referenciales. |
| 8 | Escalabilidad del Frontend y backend | Maestro 26, 32, 35; AC01–AC03, DA07; principios IX, XI | SPA/CloudFront y comparación 1 vs 2 API sin estado con balanceador, mismo dataset/carga, métricas y límites del VPS declarados. |
| 9 | Escalabilidad de Base de datos | Maestro 12, 28, 35; AC03, AC05, DA02–DA03; principios VII, VIII | Índices incluida farmacia_id, EXPLAIN, pool sin fugas tenant, bloqueos, conexiones y carga; migraciones reproducibles, sin afirmar escalabilidad no medida. |
| 10 | Configuración de dominio y/o subdominio DNS y CDN | Maestro 16, 26, 30, 35; principios XI, XII | DNS y TTL reales, HTTPS, CloudFront, OAC y S3 privado, headers y assets cacheables; documentar si nombre público o dominio aprobado satisface al docente. |
| 11 | Implementación Cache | Maestro 6, 14–15, 35; RC11, ADR-07–ADR-08, AC01/AC08; principio IX | Redis Cache-Aside: hit/miss, TTL, invalidación posterior al commit, claves seguras, caída y fallback a PostgreSQL con métricas. |
| 12 | CI/CD | Maestro 17, 31, 35; RC10, DA09; principios XI, XVI, XVIII | GitHub Actions con lint, TS backend, unitarias/integración RLS, build, contratos y escaneo secretos; entorno protegido, OIDC/permisos mínimos, deploy autorizado, smoke y rollback. |
| 13 | Pruebas de Carga k6 | Maestro 14–15, 31, 35; AC01–AC05, DA02–DA03/DA07; principios XII, XIII | Scripts y reportes k6: p95/p99, throughput, errores, caché on/off, 100 solicitudes/10 unidades y carga por tenant en ventana y presupuesto controlados. |
| 14 | Codigo fuente y base de datos en Github | Maestro 18, 25, 35; RC04, RC10; principios XV, XVI, XX | Código, migraciones y seeds ficticios versionados, README reproducible y revisión de secretos; no publicar una BD productiva ni backups privados. |
| 15 | Informe Final | Maestro 18, 21, 32, 35; DA09, AC09; principios XIV, XV | Informe DOCX/PDF con fuentes, SDD, amenazas, arquitectura, costos, resultados reales, límites y capturas numeradas e interpretadas en el cuerpo. |
| 16 | Presentación y dominio del Tema | Maestro 18, 35; DA09; principios XIV, XIX | Presentación y guion de defensa, demo con datos ficticios, acceso cruzado rechazado, HTTPS/CDN y explicación de RLS, concurrencia, costos y puntos únicos de fallo. |

El agente IA es un requisito adicional según el capítulo 18, no un criterio 17 inventado.
IA-RF01 y AC-IA01/02 DEBEN vincular herramientas de solo lectura, respuestas fundamentadas,
límites clínicos, privacidad, presupuesto y fallback a pruebas con MockAIProvider.
La evidencia E18 prevista por el maestro DEBE diferenciar mock de proveedor real; una API
no configurada o no autorizada DEBE registrarse como tal, sin afirmar integración probada.

Por cada fila se DEBEN registrar posteriormente referencias concretas de evidencias,
revisión, fecha, entorno, procedimiento, resultado esperado/obtenido, responsable de
revisión y pendientes. Las evidencias E01–E18 del capítulo 21 son un índice propuesto,
NO un conjunto ya producido ni una sustitución de los 16 criterios.

Los planes DEBEN preservar los escenarios históricos aplicables:

- AC01: p95 de búsqueda ≤ 2 segundos y errores técnicos < 1 % bajo carga y datos definidos;
  comparar con y sin caché usando el mismo conjunto y carga. Medir p99, throughput,
  consultas PostgreSQL, hit/miss rate, latencia Redis y recursos; separar conflictos de stock.
- AC02–AC03: comparar una y dos instancias; al detener una, continuar con la sana en
  ≤ 30 segundos en el escenario definido. Probar caída de Redis y fallback. Declarar
  PostgreSQL como punto único de fallo del MVP y no afirmar escalabilidad sin mediciones.
- AC04–AC05: rechazar el 100 % de intentos no autorizados del conjunto de pruebas.
  Con 10 unidades y 100 solicitudes válidas independientes de una unidad, crear exactamente
  10 reservas PENDIENTES sin sobreasignación. Probar RLS, delegación, importación atómica,
  conciliación, concurrencia y liberación única.
- AC06–AC08: sustituir adaptadores sin cambiar dominio ni contratos de casos de uso;
  probar contratos y deduplicación. Interrumpir Notificaciones durante 5 minutos,
  conservar eventos y recuperarlos sin pérdida de eventos confirmados. Probar recuperación
  de Redis, TTL e invalidación posterior al commit.
- AC09: correlacionar reservas con registros e identificadores; medir latencias, errores,
  conflictos, CPU, memoria, conexiones, transacciones fallidas, Outbox y métricas Redis.
  Evidenciar importaciones, movimientos, delegación, plazos y recordatorios sin alterar stock.

Cada evidencia DEBE permitir reproducir la comprobación e indicar resultados esperado y
obtenido y sus limitaciones. Una simulación local NO DEBE presentarse como despliegue
AWS real. Esta constitución NO acredita por sí misma cumplimiento de ningún escenario.

## Governance

Una vez ratificada, esta constitución DEBE regir especificaciones, planes, tareas,
código y revisiones. Su creación NO aprueba especificaciones, planes, código, gastos
ni despliegues. Hasta la ratificación DEBE identificarse como propuesta.

Una enmienda DEBE incluir motivo, fuentes, principios afectados, impacto sobre requisitos
y decisiones históricas, transición propuesta y evidencias de compatibilidad. DEBE recibir
aprobación humana explícita antes de adoptarse. Los conflictos DEBEN permanecer visibles
hasta una resolución registrada; ningún agente o documento nuevo DEBE anular silenciosamente
una obligación histórica.

La versión DEBE seguir MAJOR.MINOR.PATCH: MAJOR para eliminaciones o redefiniciones
incompatibles; MINOR para principios o secciones nuevas y ampliaciones normativas;
PATCH para aclaraciones sin cambio normativo. 1.0.0 fue la propuesta inicial; 1.1.0 amplía
las reglas AWS, RLS, IA y la trazabilidad con fuentes ahora leídas, sin retirar principios
ni afirmar una ratificación anterior. Sigue pendiente de adopción humana.

Cada plan y pull request DEBE revisar principios aplicables, continuidad documental,
aprobaciones y evidencias. Un incumplimiento DEBE corregirse antes de integrar; si exige
cambiar una regla, DEBE tramitarse como enmienda humana y no como excepción tácita.
Las actualizaciones de otros artefactos DEBEN autorizarse por separado; esta revisión
solo autoriza escribir .specify/memory/constitution.md.

TODO(RATIFICATION_DATE): registrar la fecha ISO efectiva de aprobación humana;
la fecha de redacción no constituye adopción ni aprobación retroactiva.

**Version**: 1.1.0 | **Ratified**: pendiente, TODO(RATIFICATION_DATE) | **Last Amended**: 2026-11-10
