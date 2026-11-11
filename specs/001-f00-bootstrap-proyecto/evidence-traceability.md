# F00 — Verificaciones y trazabilidad

Estado: matriz aprobada documentalmente con el plan, 2026-11-10. Esta actualización
registra el incremento local verificado; no acredita aceptación completa. Especificación
y plan aprobados; registro de aprobación y límites en [plan.md](plan.md).

Windows 10 es el entorno principal de desarrollo aprobado, con Node.js 24.17.0 y
npm 11.13.0 como referencias observadas. Los controles locales automáticos de configuración,
compilación, endpoints y procesos no requieren navegador, Docker, PostgreSQL, Redis,
AWS o proveedores. Los controles locales implementados generan reportes privados en
`artifacts/f00/`; sus resultados deben citarse por ejecución, no asumirse futuros.
Playwright conserva todas sus aserciones obligatorias, pendientes de un entorno
oficialmente compatible; no se declara soporte oficial en Windows 10 ni se exige
actualizar Windows o instalar Ubuntu/WSL para seguir desarrollando.

## Índice propuesto de evidencias

| ID | Evidencia futura | Estado actual |
|---|---|---|
| E-F00-01 | Fuente/revisión, hashes, versiones Windows/Node/npm/paquetes, ámbito local/completo y procedimiento; navegador cuando se ejecute el grupo compatible. | Reportes locales privados disponibles; revisión completa y navegador pendientes. |
| E-F00-02 | Perfiles ficticios y reporte de config válida/ausente/inválida, sin secretos. | Tests locales ejecutados; repetición completa A/B pendiente. |
| E-F00-03 | Build, sintaxis/tipos y revisión de límites de módulos/imports. | Controles locales ejecutados; aceptación completa pendiente. |
| E-F00-04 | Respuestas HTTP y contratos de API/Notificaciones con identidad propia. | Tests y endpoints locales ejecutados; repetición completa pendiente. |
| E-F00-05 | Playwright: pantalla bootstrap visible, captura técnica, negativos UI y ausencia de recursos externos. | Obligatoria y pendiente de entorno oficialmente compatible y ejecución; nunca sustituida por HTTP estático, build, PID o captura manual. |
| E-F00-06 | Ciclo de procesos, separación, colisión de puertos y limpieza solo de PIDs propios. Distinguir separación por HTTP local de la comprobada con UI real. | Separación HTTP local ejecutada; separación con UI real pendiente de entorno compatible. |
| E-F00-07 | Registro independiente de preparación A: comandos, versiones, expectativas, resultados y errores/none; identificar local parcial o completo y cada control pendiente. | Copia local A verificada; aceptación completa de A pendiente. |
| E-F00-08 | Registro propio de preparación B y comparación de fuente/lockfile/resultados; mismo alcance de evidencias que A. | Copia local B independiente verificada; aceptación completa de B pendiente. |
| E-F00-09 | Revisión humana del bootstrap y correspondencia con requisitos, fuentes y exclusiones. | Pendiente. |

Los IDs son índice propio de F00, no renumeran E01–E18 del maestro ni los 16 criterios.
Las pruebas negativas deben distinguir fallo esperado del fixture de un fallo inesperado
de la suite. Los comandos, códigos de salida y resultados deben permitir revisar esa distinción.

## Resultado local frente a aceptación completa

| Registro | Condición futura | Interpretación permitida |
|---|---|---|
| verify:local, preparación A o B en Windows 10 | Configuración, sintaxis/tipos/imports, build de los tres componentes, contratos/HTTP, separación de procesos, puertos y limpieza automáticos. | Puede informar local passed, overall pending y salida 0 solo si ese grupo pasa; acceptance individual permanece pending. Un fallo local informa local/overall failed y salida 1. |
| E-F00-05 y separación con UI | Playwright verifica pantalla cargada y todas sus aserciones en un Windows oficialmente compatible, por ejemplo otro equipo Windows 11 autorizado después. | Pending mientras no exista entorno o no se ejecute; no passed ni skipped como equivalente de éxito. |
| verify:bootstrap, preparación completa A o B | Todos los controles obligatorios, UI, negativos y limpieza satisfactorios en entorno compatible. | scope complete y overall passed permiten salida 0 de esa ejecución, con acceptance individual pending. Sin prerrequisitos y sin fallos reales, overall pending; con algún fallo obligatorio, overall failed. |
| Aceptación F00 | Resumen separado con dos reportes complete de preparaciones independientes de revisión común. | Sin par comparable, pending. Con par comparable, failed si algún overall falla; pending si falta evidencia/control; passed solo con ambos overall passed y evidencia completa. Nunca se cierra con dos resultados locales parciales. |

El [contrato común de estados y agregación](data-model.md#contrato-común-de-estados-y-agregación)
define campos obligatorios, combinaciones y elegibilidad. local agrega el subconjunto
Windows 10 y overall todos los controles completos de una ejecución; ambos aplican
failed > pending > passed. acceptance individual siempre es pending; la decisión del
par se informa en su resumen, con referencias a los runId candidatos A/B, sin reescribir
sus reportes históricos ni confundir un éxito de ejecución con aceptación de la pareja.
Los fallos locales o completos se preservan aunque otros controles estén pendientes.
Los resultados ejecutados se registran en reportes privados por runId; esta matriz no
sustituye esos registros ni declara las preparaciones completas.

Para cada preparación registrar fuente/hashes, Windows/build, herramientas, comandos,
versiones, resultados esperados, obtenidos, errores/none, limpieza y pendientes con causa.
La misma persona puede realizar A y B sobre copias limpias de la revisión común, sin
reutilizar node_modules, dist, perfiles privados o resultados. Compartir prerrequisitos
y caché de descargas no autoriza reutilizar estado de una preparación anterior.
Para cerrar aceptación, ejecutar posteriormente el grupo completo en dos preparaciones
independientes con Playwright compatible; no mezclar fuentes o reportes de revisiones
distintas ni añadir una captura aislada para completar artificialmente los registros.

## Los 20 requisitos F00

Esta es la matriz común requisito → escenario de aceptación → criterio de éxito.
USn.m identifica el escenario m de Acceptance Scenarios de User Story n en [spec.md](spec.md):
US1.1–US1.3, US2.1–US2.3, US3.1–US3.3 y US4.1–US4.3. Son alias de referencia,
no escenarios nuevos ni renumeración de los aprobados. SCnnn abrevia F00-SC-nnn.

Los criterios de consolidación SC005/SC006 pueden cubrir exigencias transversales de
estructura o revisión; no sustituyen la comprobación específica de cada FR en spec.md.
Por ejemplo, vincular el stack a SC006 no permite darlo por correcto solo por contar filas:
siguen siendo obligatorias su comprobación propia y la revisión del escenario US4.1.
Las referencias se leen en ambos sentidos por columnas; cubren los 20 FR, los 12 escenarios
ya existentes y los siete SC sin cambiar su contenido o extender el negocio.

| Requisito | Escenarios aprobados | Criterios de éxito existentes | Diseño / comprobación prevista | Evidencia futura | Tareas F00 |
|---|---|---|---|---|---|
| F00-FR-001 | US1.1; US4.2 | SC001; SC007 | quickstart A/B; mismas instrucciones, fuente y versiones; guía sin pasos privados. | E-F00-01, 07, 08 | T001–T006, T011–T013, T048, T050–T058 |
| F00-FR-002 | US3.1; US4.1 | SC006 | Matriz de versiones y manifests futuros; frontend JSX y procesos TS; conservar comprobación propia de stack. | E-F00-01, 03 | T002/T003/T005/T006, T021–T024, T038–T042 |
| F00-FR-003 | US3.1; US4.1 | SC005; SC006 | Estructura modular/capas; salud fuera del dominio y sin imports de integraciones. | E-F00-03, 09 | T022/T023, T038–T042 |
| F00-FR-004 | US3.1; US3.2; US3.3 | SC005 | Inventario de siete módulos y ampliación IA futura; sin operaciones de negocio. | E-F00-03, 09 | T039/T041/T042 |
| F00-FR-005 | US1.1; US1.2; US3.1; US4.2 | SC002; SC005; SC007 | /health propio y parada independiente de Notificaciones. | E-F00-04, 06 | T018/T023–T030, T055/T056 |
| F00-FR-006 | US1.2; US2.3 | SC002; SC004; SC007 | Controles sin contenedores, BD/caché/nube/IA ni servicios externos. | E-F00-02, 04–08 | T014/T015/T025–T030, T031–T037, T041 |
| F00-FR-007 | US2.1; US2.2 | SC003; SC004 | Catálogo de variables por componente con visibilidad/obligatoriedad. | E-F00-02 | T008/T010/T014, T031–T037 |
| F00-FR-008 | US1.3; US2.1; US2.2 | SC003; SC004 | Ejemplos ficticios, configuración privada excluida y logs redactados. | E-F00-02, 09 | T004/T012, T032–T037, T044/T046 |
| F00-FR-009 | US3.1; US3.3; US4.1 | SC005; SC006 | Límite de persistencia futuro, sin driver/ORM/esquema/conexión. | E-F00-03, 09 | T038–T042 |
| F00-FR-010 | US3.1; US4.1; US4.3 | SC006 | Contrato futuro tenant/RLS registrado; no afirmar políticas implementadas. | E-F00-09 | T038/T041/T042/T047 |
| F00-FR-011 | US1.2; US2.3; US3.3; US4.1 | SC002; SC004; SC006 | Cache-Aside futura con TTL/invalidation/fallback; sin cliente Redis. | E-F00-03, 09 | T032/T034/T038/T041/T042 |
| F00-FR-012 | US3.1; US3.3; US4.1 | SC005; SC006 | UoW/Outbox posteriores; salud técnica no publica ni recibe eventos. | E-F00-03, 04, 09 | T018/T023/T038/T041/T042 |
| F00-FR-013 | US1.2; US4.2 | SC001; SC002; SC004; SC007 | Config, compilación, HTTP y procesos locales; UI real y separación completa obligatorias en entorno compatible. | E-F00-02–08, con alcance y pendientes explícitos. | T007–T030, T037/T042, T051–T057 |
| F00-FR-014 | US4.2; US4.3 | SC006; SC007 | Comandos locales deterministas y ruta CI futura; sin pipeline remoto. | E-F00-03, 07–09 | T003/T006/T015/T029/T049/T054–T056 |
| F00-FR-015 | US1.2; US3.1; US4.1 | SC002; SC006 | Frontend estático, config externa y procesos separados; sin Docker/AWS creados. | E-F00-03, 09 | T004/T021–T024/T038/T041/T049 |
| F00-FR-016 | US3.1; US4.1 | SC005; SC006 | Fuentes/IDs preservados, D01 desarrollo/histórico y trazabilidad por revisión. | E-F00-01, 09 | T001/T039/T041/T047/T058 |
| F00-FR-017 | US4.1 | SC006 | Matriz de 16 criterios, sin puntajes, resultados o evidencias ficticias. | E-F00-09 | T046/T047/T049/T057/T058 |
| F00-FR-018 | US1.3; US2.2; US2.3; US4.3 | SC004; SC007 | Estados de proceso separados de aserciones; negativos de UI/HTTP/config. | E-F00-02, 04–06 | T007/T009/T012/T013/T019/T020/T025–T037/T043–T045 |
| F00-FR-019 | US4.3 | SC006 | Spec y plan aprobados; implementación F00 local autorizada expresamente, aceptación pendiente. | Registro de aprobación y E-F00-09 | T001/T047/T058; registro de aprobación en plan.md |
| F00-FR-020 | US2.1; US4.3 | SC003; SC006 | Rama distinta de main, datos ficticios y ninguna operación remota necesaria. | E-F00-01, 09 | T001/T004/T032/T035/T041/T046/T049/T058 |

## Criterios de éxito

| Criterio | Verificación de aceptación posterior |
|---|---|
| F00-SC-001 | Dos preparaciones independientes, permitida la misma persona, con registro completo; E-F00-07/08. |
| F00-SC-002 | Tres resultados observables automáticos Windows; E-F00-04/05, sin servicios externos. |
| F00-SC-003 | Todas las variables documentadas, cero datos personales/credenciales reales; E-F00-02/09. |
| F00-SC-004 | Config válida, ausente e inválida produce expectativas distintas correctas; E-F00-02. |
| F00-SC-005 | Siete módulos + ampliación + servicio, cero negocio presentado como terminado; E-F00-03/09. |
| F00-SC-006 | 20 requisitos y 16 filas con evidencia o exclusión, cero resultados inventados; E-F00-09. |
| F00-SC-007 | Todos los controles obligatorios se ejecutan, reportan y limpian; E-F00-02–08. |

F00-SC-001, F00-SC-002 y F00-SC-007 no se consideran satisfechos por dos preparaciones
Windows 10 con controles sin navegador. Falta la evidencia de UI real y demás aserciones
obligatorias de ambas preparaciones completas. No se modifican sus requisitos en spec.md
ni se rebajan porcentajes, número de preparaciones o resultados observables para cerrar F00.

## Los 16 criterios docentes

Fuente: RUBRICA.png, contrastada con capítulos 18 y 35 del maestro v2.0. Columna Puntaje
vacía. Ninguna fila recibe calificación, resultado de prueba o declaración de cumplimiento.

| N.º | Criterio | Aporte F00 previsto | Límite / evidencia futura |
|---|---|---|---|
| 1 | Identificación del problema y requerimientos | Referencias al alcance histórico y requisitos F00. | Documentación fuente, no nueva investigación; E-F00-09. |
| 2 | Análisis y diseño del sistema | Modelo técnico, configuración, interfaces y responsabilidades. | Documentos presentes son propuesta; no ERD de negocio ni funcionalidades. |
| 3 | Arquitectura de Bajo y alto nivel | Estructura modular, separación y destino AWS preservados. | Diseño documental; C4/ADR complementarias posteriores; E-F00-03/09. |
| 4 | Desarrollo basado en SDD | Constitución ratificada, spec/plan aprobados y tareas F00 en seguimiento. | Incremento técnico local ejecutado; aceptación completa, convergencia y PR pendientes. |
| 5 | Pruebas unitarias e integración | Configuración, compilación, HTTP y procesos locales Windows 10; UI técnica en entorno compatible. | Controles locales ejecutados; Playwright, BD/RLS y negocio pendientes. |
| 6 | Pruebas End to End | Conservar comprobación de UI técnica con Playwright. | Pendiente de entorno compatible y ejecución; no acredita recorrido de búsqueda/reserva/entrega ni E2E de negocio. |
| 7 | Interfaz y experiencia de usuario | Pantalla técnica bootstrap claramente identificada en fuente. | E-F00-05 obligatoria y pendiente; build o HTTP no prueba carga React. No UI de negocio ni evaluación de usabilidad completa. |
| 8 | Escalabilidad del Frontend y backend | Separar frontend estático y procesos sin estado de negocio local. | Sin carga, réplicas ni mejora medida. |
| 9 | Escalabilidad de Base de datos | Reservar persistencia PostgreSQL y seguridad tenant futuras. | Sin índices, EXPLAIN, pool real o mediciones BD en F00. |
| 10 | Configuración de dominio y/o subdominio DNS y CDN | Compatibilidad futura S3 privado/CloudFront y endpoint API. | Sin DNS, TLS público, CDN o despliegue; no simular evidencia real. |
| 11 | Implementación Cache | Delimitar Cache-Aside, TTL, invalidación y fallback futuros. | No Redis operativo ni hit/miss medidos. |
| 12 | CI/CD | Scripts locales reutilizables y ámbitos local/completo; preparación documental de CI. | Sin workflow, credenciales, runner compatible autorizado, ejecución remota o despliegue en F00. |
| 13 | Pruebas de Carga k6 | Herramienta reconocida para la fase posterior. | No scripts/carga/reportes k6 producidos. |
| 14 | Codigo fuente y base de datos en Github | Estructura, lockfile y fuentes locales trazables. | Base de datos y funcionalidades de negocio pendientes; la publicación se registra solo si el push autorizado se confirma. |
| 15 | Informe Final | Índice de evidencia y formato de registros por preparación. | E-F00-07/08 futuros; informe final y resultados del producto pendientes. |
| 16 | Presentación y dominio del Tema | Guía para explicar bootstrap, límites y reproducibilidad. | Demo funcional/defensa final posteriores, sin afirmar ejecución. |

IA continúa siendo ampliación adicional, no criterio 17. No se crean agentes funcionales,
API IA, prompts ejecutables ni resultados IA-RF01/AC-IA01/02 en F00.

## Continuidad histórica y cierre documental

HU01–HU06, RF01–RF13, AC01–AC09, RC01–RC11, DA01–DA09 y ADR-01–ADR-12 conservan sus IDs.
El plan no acredita pruebas AC01–AC09 por definir límites de proceso. AC02 requiere
posteriormente ensayo 1 vs 2 réplicas; un solo Lightsail sigue siendo punto único de fallo.
RLS y autorización no se sustituyen por aislar procesos. Redis/Outbox no se sustituyen
por un endpoint técnico que responde sin dependencias.
PostgreSQL con RLS, Redis Cache-Aside, UoW/Outbox, Docker y AWS conservan sus obligaciones
arquitectónicas posteriores. La decisión Windows 10 no las elimina ni las implementa.
Docker y Ubuntu no son herramientas de F00; no se instala otro SO para aparentar
compatibilidad del navegador. La arquitectura posterior sí conserva Docker donde lo exige.

Evidencia de esta fase: documentos SDD y reportes locales privados por runId de configuración,
tests, build, HTTP y procesos. El plan y la implementación local recibieron autorización
expresa. E-F00-05, las dos preparaciones completas y la aceptación siguen pendientes.

Las notas de armonización pendientes de la revisión anterior se actualizaron mediante
este encargo de corrección: plan.md, research.md y quickstart.md reflejan ya el estado
documental vigente. data-model.md formaliza el contrato común de estados y sus reglas;
los contratos y esta matriz lo referencian sin atribuir resultados ejecutados.
La matriz FR → USn.m → SC corrige H01/CHK002, el seguimiento actualizado corrige H02/CHK010
y el contrato común corrige H03/CHK034. El usuario aprobó expresamente el plan corregido
y sus complementarios el 2026-11-10; el registro está en plan.md. Se mantienen intactas
las casillas de la checklist; no se aprueban automáticamente implementación o resultados.
