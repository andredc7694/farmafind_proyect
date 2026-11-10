# Implementation Plan: F00 — Bootstrap del proyecto FarmaFind

**Branch**: `feat/sdd-aws-multitenant` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Especificación F00 aclarada y aprobada expresamente en esta conversación.

**Status**: Approved — plan corregido y documentos complementarios aprobados expresamente por el usuario el 2026-11-10. No autoriza implementación.

**Approval record**: aprobación documental expresa registrada en esta conversación después
de la revisión final de H01/CHK002, H02/CHK010 y H03/CHK034. Comprende Windows 10,
React/Vite/JSX, Express/TypeScript, npm workspaces, arquitectura modular y Clean Architecture,
siete módulos más IA futura, Notificaciones independiente, configuración segura,
controles locales y dos preparaciones independientes. Se mantienen Playwright y aceptación
completa pendientes de entorno oficialmente compatible, sin reducir criterios; RC04 y
ADR complementarias pendientes; PostgreSQL RLS, Redis, Docker y AWS diferidos.
La aprobación no acredita implementación, pruebas ni validación de F00. La invocación
posterior expresa de speckit-tasks autoriza únicamente su descomposición documental.

**Constitution**: v1.1.0, ratificada el 2026-11-10; no modificada por este plan.

El resolutor de Spec Kit identifica la funcionalidad como `001-f00-bootstrap-proyecto`;
ese identificador no implica que se haya creado una rama Git con ese nombre.

## Summary

Preparar, en una implementación posterior autorizada, tres componentes técnicos locales:
SPA React/Vite en JavaScript/JSX, núcleo Express en TypeScript y servicio independiente
de Notificaciones. Se propone un repositorio npm workspaces con una instalación congelada,
configuración local sin secretos y controles automáticos locales en Windows 10.
Las verificaciones de navegador con Playwright permanecen obligatorias y pendientes
de ejecución en un entorno oficialmente compatible; no se declaran soportadas en Windows 10.
No se implementan funcionalidades de negocio ni integraciones de PostgreSQL, RLS, Redis,
Outbox, IA o AWS. Docker permanece diferido para F00 y obligatorio en etapas posteriores.
Ubuntu, WSL y actualizar Windows no forman parte de F00 por decisión expresa del usuario.

La planificación inicial creó documentos y corrigió metadatos de spec.md. Una corrección
posterior fijó Windows 10 y separó controles locales y completos; los complementarios ya
fueron armonizados. Este mantenimiento documental resuelve H01/CHK002, H02/CHK010 y
H03/CHK034 sin modificar spec.md, la Constitución o el alcance aprobado.
No se han creado manifests, lockfiles, aplicaciones, scripts ejecutables, tests, contenedores
ni infraestructura. Las rutas de código y comandos siguientes son diseño futuro.

Estados de decisión:

- **Aprobado por el usuario:** requisitos y aclaraciones de spec.md, Constitución ratificada,
  tecnologías obligatorias, dos preparaciones limpias en Windows, verificaciones automáticas,
  exclusiones F00 y separación entre repositorio histórico y desarrollo. Windows 10 con
  VS Code, Codex, Spec Kit, Node y npm es el entorno principal de desarrollo aprobado;
  no se instalará Ubuntu ni se actualizará Windows en F00.
- **Diseño de este plan aprobado documentalmente:** versiones de dependencias, manteniendo Node 24.17.0/npm
  11.13.0 como referencias observadas, entorno compatible separado para aceptación Playwright,
  npm workspaces, estructura física, puertos, contratos técnicos, scripts, tiempos y evidencias.
- **Pendiente de autorización:** generación de código, instalación y ejecución de pruebas;
  ADR complementarias y regularización documental de RC04 en su ámbito correspondiente.
  Instalar dependencias, generar código, ejecutar pruebas o desplegar no queda autorizado aquí.

## Technical Context

**Language/Version**: JavaScript/JSX y scripts Node ESM; TypeScript 5.9.3 para backend y
Notificaciones. Node.js 24.17.0 y npm 11.13.0 como versiones de referencia observadas
y conservadas para el desarrollo local Windows 10.

**Primary Dependencies**: React/React DOM 19.2.7, Vite 7.3.6, plugin-react 5.0.4,
Express 5.2.1; Vitest 4.0.18, Supertest 7.1.4 y Playwright 1.65.0 para comprobaciones.
Compatibilidad declarada por engines/peers, no instalación ni validación runtime.
Fuentes, tipos auxiliares y alternativas en [research.md](research.md).

**Storage**: Sin almacenamiento de negocio. Archivos locales de configuración privada y
reportes técnicos sintéticos. Sin cliente SQL, ORM, Redis, migraciones, seeds ni tabla Outbox.

**Testing**: Vitest para validación de configuración y errores; Supertest para contrato
HTTP en cada proceso Express sin dependencias externas y supervisor Node para endpoints,
arranque/separación/limpieza: controles previstos para Windows 10 sin navegador.
Playwright/Chromium para carga real de la pantalla bootstrap: obligatorio, pendiente en
un entorno oficialmente compatible, por ejemplo un equipo Windows 11 x64 disponible
posteriormente sin actualizar el equipo actual ni añadir Ubuntu a F00.
Son comprobaciones de bootstrap, no flujos E2E del negocio ni carga k6.

**Target Platform**: Windows 10 como entorno principal aprobado de desarrollo local,
VS Code, Codex, Spec Kit, Windows PowerShell 5.1 y Node 24.17.0/npm 11.13.0.
No se requiere instalar otro sistema operativo ni PowerShell adicional.
Comandos documentados con npm.cmd para evitar depender de
permisos de ejecución de npm.ps1. No se cambia la política de ejecución del equipo.
El host observado informa NT 10.0.19045 y PowerShell 5.1.19041.6456; no se certifica
como entorno soportado por Playwright. Consulta CIM de edición denegada.
Se realizarán dos preparaciones limpias locales Windows 10 cuando exista implementación
autorizada; sus controles sin navegador no completan la aceptación. El arranque observable
de UI y la separación comprobada con UI quedan pendientes en un Windows oficialmente
compatible con Playwright. No hay aceptación global hasta disponer de evidencia completa
de la misma revisión en dos preparaciones independientes con todos los controles obligatorios.

**Project Type**: Web SPA más dos procesos Node independientes; núcleo monolítico modular.

**Performance Goals**: Techos propuestos de comprobación: arranque 60 s/componente,
petición local 5 s, aserción de pantalla 10 s y limpieza 10 s/proceso. No sustituyen AC01–AC09
ni son resultados medidos. Dos preparaciones independientes con registro completo.

**Constraints**: Ejecución de verificaciones sin Docker, PostgreSQL, Redis, AWS ni proveedores.
La preparación autorizada de dependencias puede requerir internet; la del navegador solo
se contempla posteriormente en el entorno compatible autorizado. Después
no se permiten descargas implícitas ni tráfico de integración durante los controles.
Sin secretos reales, rutas de negocio, cuentas, membresías, políticas SQL o envío de mensajes.
Solo loopback IPv4 `127.0.0.1`; puertos explícitos y fallo ante colisión, sin terminación ajena.

**Scale/Scope**: Un desarrollador local, dos preparaciones de la misma revisión, tres
componentes, siete módulos delimitados sin lógica y referencia de una ampliación IA futura.
No hay objetivos de usuarios simultáneos, datos reales o disponibilidad del producto en F00.

## Constitution Check

**Gate previo a investigación:** PASA documentalmente. Constitución 1.1.0 ratificada,
especificación aprobada, alcance F00 explícito y ninguna implementación autorizada.
La postergación de Docker y las integraciones procede del usuario, no de una excepción
inventada por el plan. RC10/RC11 siguen obligatorios para el destino del proyecto.

| Principios | Aplicación al diseño | Revisión después de Phase 1 |
|---|---|---|
| I, XVIII | Spec y plan aprobados; tasks autorizado por invocación expresa; implementación no autorizada. | Pasa: solo documentos; aprobación no acredita código o pruebas. |
| II, III | Siete módulos internos; AsistenteIA solo referencia futura, sin proveedor ni mock ejecutable. | Pasa: no se añade otro servicio de negocio. |
| IV, V | React/Vite/JSX; Node/Express/TS. | Pasa: no migración frontend a TS. |
| VI | Presentación/aplicación/dominio/infraestructura; composición externa. | Pasa: contratos de salud fuera del dominio. |
| VII, VIII | Persistencia y RLS solo límites documentados. | Pasa: no BD alternativa ni bypass de seguridad futuro. |
| IX | Redis Cache-Aside futuro con TTL, invalidación y fallback. | Pasa: ninguna caché operativa en F00. |
| X | Notificaciones independiente; UoW/Outbox conservados para negocio futuro. | Pasa: /health no envía ni procesa eventos. |
| XI, XII | Destino S3 privado/CloudFront OAC/Lightsail; Docker posterior. | Pasa: ningún recurso, contenedor o gasto creado. |
| XIII, XIV | Controles base propuestos y evidencia por preparación; 16 criterios trazados. | Pasa: ninguna prueba o evidencia de ejecución declarada realizada. |
| XV | Fuentes e IDs históricos preservados; D01 registra relación entre repositorios. | Pasa: RC04 y ADR complementarias no se declaran enmendados. |
| XVI, XVII | Rama actual distinta de main; solo F00 activa. | Pasa: sin commits, push ni otra feature. |
| XIX, XX | Sin IA ejecutable, datos clínicos ni credenciales reales. | Pasa: reportes sintéticos y configuración redactada. |

**Gate después del diseño:** PASA a nivel documental; ningún incumplimiento constitucional
no justificado ni decisión de diseño sin alternativa seleccionada. Aceptar el plan no
acredita compatibilidad runtime. La decisión de desarrollar en Windows 10 es compatible
con conservar las comprobaciones obligatorias de navegador como pendientes. El gate de
aceptación de F00 permanece pendiente: no pasa por aprobar controles locales parciales.
La revisión de dependencias y la disponibilidad del entorno compatible siguen pendientes.

## Project Structure

### Documentation (this feature)

```text
specs/001-f00-bootstrap-proyecto/
  spec.md                         requisitos aprobados; solo metadatos actualizados
  plan.md                         este plan propuesto
  research.md                     decisiones, alternativas y fuentes primarias
  data-model.md                   entidades técnicas; ninguna tabla de negocio
  quickstart.md                   procedimiento futuro de preparación A/B
  evidence-traceability.md        verificaciones, 20 requisitos y 16 criterios
  contracts/
    bootstrap.openapi.yaml        contrato documental /health de API y Notificaciones
    local-configuration.md        variables, scripts y límites de configuración
    validation.md                 UI, procesos, errores y registro de verificaciones
```

La planificación inicial no creó tasks.md; la invocación posterior autoriza ese documento.
No se modifica la Constitución, el histórico, plantillas ni imágenes.
Se usa la selección de feature por variable de entorno sin persistir un nuevo feature.json.

### Source Code (repository root)

Estructura **propuesta, no creada**; solamente se generará tras aprobaciones posteriores:

```text
frontend/
  src/                            pantalla Bootstrap en JSX; sin pantallas de negocio
  public/                         solo recursos locales sin secretos
  tests/                          comprobaciones técnicas de UI/configuración
backend/
  src/
    app.ts                        composición Express del contrato técnico
    main.ts                       ciclo de vida del proceso
    bootstrap/                    presentación técnica /health
    config/                       validación propia de configuración
    modules/
      usuarios/                   Usuarios y roles, reservado sin lógica
      farmacias/                  reservado
      medicamentos/               reservado
      busqueda/                   reservado
      inventario/                 reservado
      reservas/                   reservado
      administracion/             reservado
  tests/                          comprobaciones de configuración y contrato técnico
notifications/
  src/                            proceso Express/TS independiente; solo salud/config
  tests/                          comprobaciones de configuración y contrato técnico
scripts/                          supervisión local portable con Node, no shell Unix
tests/
  bootstrap/                      controles de proceso, UI y separación
  fixtures/                       configuración ficticia
```

El diseño no exige crear carpetas vacías de negocio o capas
sin contenido: cada módulo tiene ubicación/responsabilidad reservadas; cuando se active,
sus subcarpetas serán `domain/`, `application/`, `presentation/`, `infrastructure/`.
AsistenteIA queda reservado conceptualmente como `backend/src/modules/asistente-ia/`,
fuera del inventario de siete y sin crearse código de agente en F00.

Artefactos futuros raíz: package.json privado con workspaces frontend/backend/notifications,
un package-lock.json, .npmrc sin credenciales, .env.example por componente, README de arranque,
ignore de secretos/reportes y configuración de calidad. Ninguno se genera en esta fase.
Evidencias futuras: `artifacts/f00/<run-id>/`, excluidas de versionado salvo resumen sintético
revisado que se archive con autorización. No se crea el directorio de evidencias ahora.
`.github/workflows/` e `infra/` se reservan conceptualmente; no hay workflow, Dockerfile,
Compose, IaC ni script de despliegue en F00.

**Structure Decision**: npm workspaces con frontend/backend/notifications en raíz sigue
la propuesta del capítulo 25 del maestro y evita crear un paquete compartido o framework
de monorepo para tres componentes. El código de salud pertenece a presentación/bootstrap,
no a entidades de dominio. Cada proceso posee su configuración y no importa el servidor
del otro. No se requiere hacer peticiones desde el frontend a backend para mostrar bootstrap.

### Límites de dependencia y ampliación

| Área | Preparación F00 | Implementación posterior excluida |
|---|---|---|
| PostgreSQL | Referencia de persistencia en infraestructura; variables futuras opcionales/no leídas por bootstrap. | Driver, ORM, schema, conexión, seeds y migraciones. |
| Multi-tenant/RLS | Contrato documental: membresía/rol/recurso/farmacia, contexto transaccional local y conexión no privilegiada. | Autenticación, políticas USING/WITH CHECK/FORCE RLS, grants y pruebas con BD real. |
| Redis | Límite de caché por puerto futuro en Búsqueda, salida pública, TTL/invalidation/fallback. | Cliente Redis, conexión, respuestas cacheadas o prueba de caída operativa. |
| UoW/Outbox | Reserva de responsabilidades de aplicación/infraestructura; sin llamadas externas en transacción futura. | Transacciones stock/reserva/evento, publicador, receptor de eventos o deduplicación. |
| FarmaFind AI | Ampliación informativa por puertos y ADR complementaria pendiente. | MockAIProvider, LLM, API key, herramientas o consulta conversacional. |
| Docker/AWS | Config externa, frontend estático y procesos separados adecuados para contenedores futuros. | Imágenes, Compose, S3, CloudFront, Lightsail, DNS, OIDC, TLS operativo y backups. |

No se crean interfaces TypeScript vacías únicamente para aparentar integraciones.
Las futuras reservas preservarán ADR-10 y la transacción UoW/Outbox, sin implementarlas aquí.

### Herramientas, ejecución y configuración

Los nombres y efectos propuestos de scripts están en [local-configuration.md](contracts/local-configuration.md).
Se elige npm, sin pnpm/yarn/Turbo, con workspaces y lockfile raíz; dependencias directas
fijadas y transitivas congeladas antes de la primera preparación de aceptación.
No usar npx con resolución o descarga implícita. No se exige instalar navegador ni ejecutar
browser:install para preparar o comprobar los controles locales Windows 10. Playwright
preparará su Chromium compatible solo en el entorno de navegador oficialmente soportado,
con autorización posterior; no se promete que ese control funciona en el equipo actual.

ES modules con TypeScript `NodeNext`, modo estricto y salida `dist/` en backend/Notificaciones;
frontend continúa JS/JSX. No se añade tsx ni daemon global: desarrollo de API/Notificaciones
mediante compilación y arranque explícitos; hot reload no es criterio de F00.
Para comprobaciones, supervisor Node lanza directamente artefactos compilados y el CLI
local de Vite; no depende de Bash, Docker ni señales POSIX. Limpieza solo de procesos propios.

`.env.local` por componente es privado y no versionado; `.env.example` contiene valores
ficticios de configuración técnica y un catálogo comentado de variables futuras deshabilitadas.
El lanzador pasa el mismo entorno validado a servidor y comprobador; prueba negativa sin
APP_MODE/HOST/PORT obligatorios y con valores inválidos. El plan no contiene secretos reales.
Frontend publica solo un indicador bootstrap; ningún VITE_* contiene secretos o URLs privadas.

### Estrategia de validación y dos preparaciones

[validation.md](contracts/validation.md) fija aserciones propias, tiempos máximos,
separación, limpieza, negativos, ausencia de tráfico externo y salida global. Un HTTP 200
del servidor estático o un PID vivo no demuestra que React haya cargado.
No se añade E2E de búsqueda/reserva; Playwright se usa aquí solo como comprobación de UI técnica.

Se distinguen dos grupos, sin eliminar ni reducir controles:

| Grupo | Entorno previsto | Resultado que puede acreditar |
|---|---|---|
| Local sin navegador | Windows 10: configuración válida/ausente/inválida, sintaxis/tipos/imports, build de los tres componentes, contratos y respuestas HTTP técnicas, colisión de puertos, parada/limpieza y separación de procesos. | Únicamente resultado local parcial; no prueba montaje React ni separación de componentes con UI visible. |
| Navegador y aceptación completa | Windows oficialmente compatible con Playwright, por ejemplo Windows 11 x64 autorizado posteriormente. | Pantalla React bootstrap visible, negativos de UI, recursos locales y separación con UI comprobada; completar todos los controles en dos preparaciones independientes de la misma revisión antes de aceptar F00. |

Los scripts existentes propuestos check, check:config, test:base y build no dependen
de Playwright. Se propone una entrada adicional futura verify:local para supervisar
los controles locales y endpoints, sin importar o lanzar Playwright. Es un nombre de
interfaz propuesto, no un script creado; ya está descrito en el contrato complementario
de configuración, aprobado documentalmente y pendiente de implementación autorizada.
verify:local puede devolver 0 si todo el grupo local pasa, pero su reporte debe indicar
`local: passed`, `overall: pending` y `acceptance: pending`, con los controles UI pendientes y su motivo.
Ese 0 no es aceptación global. verify:bootstrap conserva todos los controles obligatorios
del contrato completo; en Windows 10 no omite UI para devolver éxito: registra el
prerrequisito de navegador no satisfecho y no devuelve 0 global. Un fallo real se registra
como failed; una prueba no ejecutada por plataforma se registra pending, nunca passed.
El [contrato común de estados](data-model.md#contrato-común-de-estados-y-agregación)
define scope local/complete y la agregación failed > pending > passed de local/overall.
overall es el resultado completo de una ejecución; acceptance individual siempre es
pending. Solo el resumen separado del par comparable A/B calcula acceptance: failed
si algún overall falla, pending si faltan controles/evidencia, passed solo con ambos
overall passed y evidencia completa. Sin par comparable es pending, sin borrar fallos.
Una ejecución completa con overall passed puede retornar 0 sin aceptar por sí sola F00.
No se ha ejecutado ninguno de estos controles: todavía no existe implementación.

[quickstart.md](quickstart.md) define preparación A y B desde copias limpias de la misma
revisión, en Windows 10 para los controles locales y, posteriormente, en un Windows
oficialmente compatible para la aceptación completa de navegador. Se permite la misma
persona y caché de descargas; no reutilizar node_modules, dist, configuración privada,
procesos o resultados de A para sustituir B. La suite falla si encuentra puertos ocupados.
Ambas preparaciones incluyen comandos, versiones, expectativas, resultados y errores,
o ausencia de errores explícita, además de pendientes por plataforma. Si el entorno
compatible no está disponible, ambas preparaciones locales conservan UI pendiente y
F00 no se declara completamente validada. Ningún comando de esa guía se ha ejecutado aquí.

### Calidad y CI/CD posterior

F00 diseña controles locales reutilizables: validación de configuración, sintaxis/compilación,
checks de límites de imports, contratos técnicos, UI y ciclo de procesos. Sin tests vacíos.
GitHub Actions queda preparado mediante comandos deterministas y salida global 0/1;
un futuro workflow en Windows podrá ejecutar los mismos controles después de aprobación propia.
Su entorno compatible para navegador requerirá autorización y no está configurado aquí;
no se presume que un futuro runner o proveedor externo ya esté disponible.
Lint extensivo, suites de negocio/BD/RLS, k6, escaneo CI, artefactos remotos, entornos
protegidos y despliegue se trazan como posteriores. No se crean secretos CI ni workflow ahora.

### Riesgos y autorizaciones

| Riesgo | Tratamiento de diseño / verificación pendiente |
|---|---|
| Windows 10 aprobado para desarrollo; Playwright no acreditado como oficialmente soportado en ese SO | Continuar controles locales sin navegador; conservar UI y aceptación completa pendientes para un Windows compatible disponible posteriormente. No instalar Ubuntu, actualizar Windows, degradar pruebas o declarar F00 terminada. |
| Engines compatibles no equivalen a instalación segura o runtime válido | Revisar avisos oficiales y fijar lockfile en implementación aprobada; ejecutar A/B antes de aceptar F00. No se afirma ausencia de vulnerabilidades. |
| Proceso previo responde por el puerto esperado | Puertos estrictos, no reutilizar servidor, identificación de servicio y PIDs propios. |
| Limpieza deja procesos huérfanos Windows | Supervisión de procesos propios y cierre acotado; limpieza incompleta causa fallo, sin matar node.exe globalmente. |
| Preparación descarga paquetes; navegador diferido | Separar instalación autorizada de paquetes de controles Windows 10 sin servicios externos. Chromium solo se prepara después en entorno compatible; su ausencia local no bloquea los controles sin navegador ni acredita UI. |
| Falso verde por UI vacía o salud de BD simulada | DOM visible y respuestas técnicas exactas; integraciones declaradas no configuradas, no saludables. |
| RC04 e imágenes históricas pendientes | Preservar D01 y referencias por revisión; no alterar antecedentes ni declarar regularización concluida. |
| Configuración o reportes filtran datos | Redactar valores, datos sintéticos, ignore de archivos privados y revisión antes de cualquier publicación futura. |

## Complexity Tracking

No se identifican violaciones constitucionales que requieran excepción de diseño.
Se rechazan microservicios por módulo, broker, ORM, caché/BD activas y herramienta adicional
de monorepo porque no aportan al alcance técnico de F00. El aplazamiento explícito de Docker
no elimina RC10; las ADR complementarias permanecen pendientes fuera de esta generación.

### Coherencia de documentos complementarios

La corrección anterior dejó una lista de ajustes pendientes por su autorización limitada.
El encargo posterior armonizó local-configuration.md, validation.md y evidence-traceability.md
con el desarrollo Windows 10 y la aceptación UI pendiente. Esa lista ya no describe
trabajo documental por realizar. El mantenimiento actual añade:

- [evidence-traceability.md §Los 20 requisitos F00](evidence-traceability.md#los-20-requisitos-f00):
  cruce explícito de cada FR con escenarios USn.m existentes y criterios SC preservados.
- data-model.md: definición común de scope, local, overall y acceptance, combinaciones,
  salidas por ámbito y agregación del par A/B, referenciada por contratos y guía.
- Seguimiento actualizado en investigación, guía y checklist, conservando el diagnóstico
  inicial del checklist y todas sus casillas sin aprobación humana automática.

Los 20 requisitos, las aclaraciones, los siete criterios de éxito, la Constitución y
los 16 criterios docentes permanecen intactos. El contrato OpenAPI tampoco cambia.
No quedan pendientes de aplicar los ajustes de armonización antes enumerados; sí quedan
pendientes la disponibilidad del entorno Playwright compatible, autorización de
implementación y todas las pruebas de aceptación. Las correcciones y el plan ya recibieron
aprobación humana expresa, sin modificar las casillas de la checklist del revisor.

El plan termina después de investigación y diseño. La aprobación humana y posterior
invocación expresa autorizan la descomposición documental mediante speckit-tasks;
no autorizan speckit-implement ni ejecución de las tareas.
