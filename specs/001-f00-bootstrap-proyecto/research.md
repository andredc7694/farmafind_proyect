# F00 — Investigación y decisiones técnicas propuestas

Fecha: 2026-11-10. Estado: documento complementario del plan aprobado expresamente;
Windows 10 es la decisión aprobada para desarrollo local. No autoriza código.
En la planificación inicial se emplearon dos agentes de investigación,
para compatibilidad de versiones y verificaciones Windows. No escribieron archivos,
instalaron paquetes ni ejecutaron aplicaciones o pruebas.

## Fuentes y coherencia documental

- Constitución v1.1.0 ratificada el 2026-11-10, con 20 principios; se mantiene intacta.
- spec.md aclarada y aprobada expresamente; solo se actualizan metadatos de aprobación,
  referencias de ratificación y autorización de esta planificación, sin cambiar requisitos.
- Maestro local v2.0 leído en esta sesión y contrastado de nuevo: capítulos 5–6, 16–19,
  25–36, especialmente modelo pooled/RLS, primer despliegue AWS y F00 del capítulo 33.
  Sus recomendaciones son destino de diseño, no evidencias de ejecución.
- RUBRICA.png inspeccionada visualmente: 16 criterios y columna Puntaje vacía.
- Histórico [PROYEC_FARMAFIND, revisión 56d3ef9d334a96df400a29d1e0c52e8a6cd696f0](https://github.com/andredc7694/PROYEC_FARMAFIND/tree/56d3ef9d334a96df400a29d1e0c52e8a6cd696f0):
  RC01–RC11 releídos en 05-restricciones.md; ADR-01–ADR-12, RF, HU, AC y DA consultados
  durante las revisiones previas. El RAR local no se extrajo porque GitHub era legible.

La decisión del usuario de diferir Docker y de preparar integraciones sin operarlas
prevalece para F00 sobre la secuencia más amplia del maestro. No cambia el destino
constitucional. D01 establece desarrollo en farmafind_proyect e histórico en
PROYEC_FARMAFIND; la regularización documental de RC04 y nuevas ADR siguen pendientes.

## R01 — Versiones y plataforma

**Decision aprobada del usuario:** Windows 10 como entorno principal de desarrollo con
VS Code, Codex, Spec Kit, Node.js y npm, sin instalar Ubuntu ni actualizar Windows.
Node.js 24.17.0 y npm 11.13.0 se mantienen como versiones de referencia observadas.
Se conserva el conjunto de dependencias propuesto; Windows 11 deja de ser requisito
para desarrollar o ejecutar controles locales sin navegador. Playwright se conserva
como prueba obligatoria pendiente en un entorno oficialmente compatible, por ejemplo
un equipo Windows 11 disponible posteriormente, sin modificar el equipo actual.
Los rangos de engines y peers son evidencia documental de compatibilidad, no prueba runtime.
No se afirma que las versiones sean las últimas ni que estén libres de vulnerabilidades.

| Herramienta | Versión propuesta | Compatibilidad / fuente primaria |
|---|---|---|
| Node.js | 24.17.0 | Observada mediante node --version; línea 24 LTS según [Node releases](https://nodejs.org/en/about/previous-releases). |
| npm | 11.13.0 | Observada localmente; [engines oficial](https://github.com/npm/cli/blob/v11.13.0/package.json): ^20.17.0 o >=22.9.0. |
| React y React DOM | 19.2.7, iguales | [Versiones React](https://react.dev/versions) y [React DOM package](https://github.com/react/react/blob/v19.2.7/packages/react-dom/package.json). |
| Vite | 7.3.6 | [Package oficial](https://github.com/vitejs/vite/blob/v7.3.6/packages/vite/package.json): Node ^20.19.0 o >=22.12.0; [política de soporte](https://vite.dev/releases). |
| @vitejs/plugin-react | 5.0.4 | [Package oficial](https://github.com/vitejs/vite-plugin-react/blob/plugin-react@5.0.4/packages/plugin-react/package.json): engine compatible y peer Vite incluye 7. |
| Express | 5.2.1 | [Package oficial](https://github.com/expressjs/express/blob/v5.2.1/package.json): Node >=18. |
| TypeScript | 5.9.3 | [Package oficial](https://github.com/microsoft/TypeScript/blob/v5.9.3/package.json): Node >=14.17. Solo backend y Notificaciones. |
| Vitest | 4.0.18 | [Package oficial](https://github.com/vitest-dev/vitest/blob/v4.0.18/packages/vitest/package.json): Node ^20, ^22 o >=24; dependencia Vite ^6 o ^7. |
| Supertest | 7.1.4 | [Package oficial](https://github.com/forwardemail/supertest/blob/v7.1.4/package.json): Node >=14.18. |
| @playwright/test | 1.65.0 | [Release](https://github.com/microsoft/playwright/releases/tag/v1.65.0) y [package](https://github.com/microsoft/playwright/blob/v1.65.0/packages/playwright-test/package.json): Node >=20. |
| Chromium/Chrome for Testing | 158.0.8127.18, revisión 1254, para pruebas pendientes | [browsers.json de Playwright 1.65.0](https://github.com/microsoft/playwright/blob/v1.65.0/packages/playwright-core/browsers.json). Solo preparar posteriormente en el entorno compatible autorizado, no requisito de los controles Windows 10. |
| Desarrollo Windows y shell | Windows 10; Windows PowerShell 5.1 | Decisión del usuario; Node 24.17.0/npm 11.13.0 observados. No requiere Ubuntu, WSL, actualización de Windows ni shell adicional. |
| Entorno de aceptación de navegador pendiente | Windows oficialmente compatible, por ejemplo Windows 11 x64 disponible posteriormente | [Requisitos Playwright](https://playwright.dev/docs/intro#system-requirements): no se acredita soporte oficial para Windows 10. Su disponibilidad y ejecución siguen pendientes. |

Tipos auxiliares propuestos: @types/node línea 24, @types/express línea 5 y
@types/supertest línea 6. Sus parches se congelarán en el lockfile de la implementación,
tras revisión de disponibilidad, compatibilidad y avisos, antes de aceptar preparación A.
Esta es una política de resolución acotada, no permiso para instalar latest sin revisión.
No se añade ORM, cliente Redis/SQL, proveedor IA, tsx ni herramienta de monorepo adicional.

**Rationale:** Node 24 observado satisface los engines publicados de este conjunto;
se evita mezclar major incompatibles y se mantiene JS/JSX del frontend.

**Alternatives considered:** versiones latest sin congelar, migración frontend a TS,
Playwright antiguo solo para aparentar soporte Windows 10, migración a Ubuntu, WSL/Docker
o actualización del SO actual. Se rechazan por
reproducibilidad, restricción del usuario o falta de soporte verificable.

El host observado informa Node 24.17.0, npm 11.13.0, PowerShell 5.1.19041.6456 y
Windows NT 10.0.19045. La consulta CIM de edición recibió acceso denegado; no se solicitaron
privilegios. El usuario confirmó continuar en Windows 10: ese entorno no bloquea diseñar
los controles Node de configuración, compilación y endpoints locales. Su ejecución real
sigue pendiente de implementación y autorización. La lectura de versiones no es validación
de toda la aplicación. La disponibilidad de un entorno compatible para Playwright continúa
siendo un riesgo de aceptación, no una condición para cambiar el SO de desarrollo.

Consulta de soporte para esta corrección: la [tabla de plataformas Node 24.17.0](https://github.com/nodejs/node/blob/v24.17.0/BUILDING.md)
incluye Windows x64 desde Windows 10, con las condiciones de su documentación. No implica
que haya que compilar Node o instalar las herramientas de compilación de esa guía.
Los [requisitos vigentes de Playwright](https://playwright.dev/docs/intro#system-requirements)
enumeran Windows 11+ y Windows Server 2019+; no se afirma soporte Windows 10.
No se instalan ni utilizan alternativas Linux en F00 para suplir esta incompatibilidad.

La consulta directa al registro npm del investigador falló; la matriz se sustentó en
documentación y package.json de etiquetas oficiales. Verificar engines/peers no acredita
resolución completa del árbol, ausencia de vulnerabilidades o funcionamiento del navegador.

## R02 — Dependencias, scripts y estructura

**Decision:** npm workspaces privado con frontend, backend y notifications y un único
package-lock.json raíz. Dependencias directas con versión exacta y transitivas congeladas.
Usar npm ci durante preparaciones A/B, no npm install ni npx con descarga implícita.
Scripts Node ESM portables y npm.cmd en PowerShell. Rutas relativas calculadas desde
el script o raíz, sin rutas del usuario incrustadas en artefactos.

**Rationale:** tres componentes no requieren una plataforma adicional de monorepo.
Un lockfile permite reproducir el mismo árbol y npm ci falla si manifiesto y lock difieren.

**Alternatives considered:** pnpm/yarn/Turbo y lockfiles independientes; más decisiones y
riesgo de divergencia sin beneficio necesario para F00.

Fuentes: [npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/),
[npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/).

## R03 — Composición modular mínima

**Decision:** frontend/backend/notifications en raíz según capítulo 25. Siete ubicaciones
conceptuales en backend/src/modules, cuatro capas al activar un módulo, bootstrap técnico
fuera del dominio. AsistenteIA reservado como ampliación sin código. Notificaciones
Express/TS como segundo proceso, con configuración y endpoint técnico propios.

**Rationale:** mantiene ADR-01–ADR-03 y RC09 sin inventar operaciones ni interfaces vacías.
Express también en el proceso técnico de Notificaciones evita otro framework para salud.

**Alternatives considered:** siete microservicios, estructura apps alternativa del capítulo 11,
paquete shared con modelos de negocio o skeleton de todos los casos de uso. Se rechazan
por complejidad y ampliación de alcance. Elegir carpetas aquí es propuesta física, no ADR histórica.

## R04 — Estado observable y contratos

**Decision:** frontend muestra “FarmaFind — Bootstrap” visible y un marcador inequívoco
del modo técnico. API y Notificaciones exponen GET /health en puertos separados con HTTP 200,
service distinto, status ok y mode bootstrap. No conectan BD, caché, correo o IA.
Respuesta técnica exacta, no /ready de integraciones ni API de negocio.

**Rationale:** PID activo o HTTP 200 del servidor estático no acredita una pantalla React.
Playwright considera algunos 4xx/3xx como servidor listo; añadir aserciones propias
de HTTP 200, JSON y DOM visible para evitar falsos positivos.

**Alternatives considered:** inspección manual, solo puerto abierto, contenido HTML sin
comprobar hidratación/montaje. Insuficientes para las tres respuestas aprobadas por el usuario.

Fuentes: [Playwright webServer](https://playwright.dev/docs/test-webserver),
[assertions](https://playwright.dev/docs/test-assertions).

## R05 — Configuración y procesos Windows

**Decision:** loopback 127.0.0.1; Vite desarrollo 5173, preview técnico 4173, API 3000,
Notificaciones 3001. APP_MODE bootstrap, HOST loopback y PORT obligatorio en Node,
sin valores por defecto silenciosos ante variable requerida ausente. El supervisor recibe
puertos y pasa la misma configuración a servidores/controles; strictPort en Vite.
La suite negativa usa configuración temporal propia, nunca modifica .env.local del usuario.

Supervisor Node lanza artefactos compilados directamente con argumentos separados.
Registra PIDs, no reutiliza servidores existentes, detiene solo sus procesos y descendientes.
En Windows, no asumir que SIGTERM garantiza cierre; un cierre acotado puede recurrir
a taskkill /PID sobre el PID propio y /T, tras verificar propiedad. Nunca matar todos los node.exe.
Si limpieza falla, resultado global fallido; no continuar una segunda preparación contaminada.

**Rationale:** evita comillas frágiles, shells Unix, puertos automáticos y procesos huérfanos.

**Alternatives considered:** matar procesos por nombre, usar servidores previos, ejecutar
npm wrappers como si fueran el servidor final. No garantizan identidad ni limpieza.

Fuentes: [Node child_process](https://nodejs.org/api/child_process.html),
[taskkill](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/taskkill),
[Vite server options](https://vite.dev/config/server-options.html).

## R06 — Navegador y ausencia de servicios externos

**Decision:** diferir browser:install y las pruebas Playwright a una preparación autorizada
en un entorno oficialmente compatible. No bloquear el desarrollo ni los controles locales
Windows 10 por no disponer de ese navegador. Cuando se ejecuten, las pruebas
usan el binario ya instalado y scripts locales. Bloquear solicitudes de navegador fuera
de loopback y service workers para observar tráfico; todos los recursos de la pantalla
son locales. No incorporar clientes activos de integraciones en procesos F00.

**Rationale:** la preparación puede necesitar internet, pero la verificación debe operar
sin proveedores externos. Interceptar navegador no demuestra aislamiento de red del proceso
Node: completar con revisión de imports/configuración y registrar ese límite.

**Alternatives considered:** navegador remoto como dependencia obligatoria, CDN de fuentes/JS,
descargas durante pruebas, simular respuesta externa saludable o reemplazar la aserción
React visible por un HTTP 200 estático. Contradicen el alcance o reducen la aceptación.

Fuentes: [Playwright browsers](https://playwright.dev/docs/browsers),
[network](https://playwright.dev/docs/network).

## R07 — Evidencia y CI futuro

**Decision:** dos copias limpias de una misma revisión, cada una con configuración propia,
registro de comandos/versiones/expectativas/resultados/errores y reportes redactados.
La misma persona puede hacer A y B. Compartir caché de descargas o navegador instalado
como prerrequisito no permite compartir node_modules, dist, config o resultados.
Los registros locales A/B Windows 10 distinguen los controles pasados/fallidos de los
controles de navegador no ejecutados. La aceptación completa requiere posteriormente
todos los controles en dos preparaciones independientes de la misma revisión en entorno
compatible; no se acumulan éxitos parciales de revisiones distintas para declarar cierre.
Proponer comandos npm deterministas para un futuro workflow Windows de GitHub Actions,
sin generar workflow, credenciales, jobs remotos o publicación en F00.

**Rationale:** verifica preparación repetible y conserva la frontera del criterio CI/CD.

**Alternatives considered:** exigir dos personas/equipos, usar el primer reporte dos veces,
declarar pruebas verdes por existir scripts. Contradicen las aclaraciones o falsean evidencia.

## Cierre de investigación

La decisión de entorno está resuelta: Windows 10 para desarrollo, sin Ubuntu ni cambio de SO.
La aceptación de navegador permanece pendiente de un entorno oficialmente compatible,
sin eliminar F00-FR-013 o F00-SC-001/002/007 ni las aclaraciones aprobadas.
Las demás selecciones técnicas recibieron aprobación documental expresa junto con el plan,
sin modificar los requisitos funcionales. Lockfile, resultados runtime y preparaciones A/B
son entregables futuros; disponibilidad, avisos y compatibilidad real aún deben verificarse.
No se ha probado compatibilidad por compilar documentos ni por consultar engines.

## R08 — Separación de controles locales y aceptación completa

**Decision:** conservar check, check:config, test:base y build como controles independientes
de Playwright y proponer verify:local para supervisión local de endpoints/procesos Windows 10.
No se implementa ese comando ahora. No debe importar Playwright, necesitar navegador,
descargar herramientas o requerir Docker, PostgreSQL, Redis, AWS o servicios externos.
Un resultado local satisfactorio no prueba que React montó; UI visible y negativos de
navegador permanecen pendientes. La separación de procesos por HTTP es evidencia parcial,
no sustituto de la separación con la pantalla efectivamente cargada.

**Rationale:** permite continuar desarrollo y verificaciones técnicas locales sin atribuir
soporte oficial inexistente ni exigir una migración del equipo. Todos los criterios de
aceptación originales se mantienen, aunque algunos todavía no puedan ejecutarse.

**Alternatives considered:** detener cualquier control hasta tener Windows 11, declarar
soporte Playwright Windows 10, saltar UI para obtener verde global, actualizar Windows o
instalar Ubuntu. Se rechazan por decisión expresa del usuario o por falsear la aceptación.

El perfil local puede informar éxito de sus propios controles con aceptación global pending;
verify:bootstrap completo no devuelve éxito global si falta navegador o aserción obligatoria.
La disponibilidad del entorno compatible se decidirá después, con autorización, sin crear
recursos remotos o workflows aquí. No se declara F00 completamente validada.

La revisión inicial de Windows 10 identificó ajustes en los complementarios, sin permiso
entonces para editarlos. El encargo posterior ya armonizó local-configuration.md,
validation.md y evidence-traceability.md; no permanecen pendientes de ese ajuste.
La corrección actual formaliza el [contrato común de estados](data-model.md#contrato-común-de-estados-y-agregación)
y el cruce FR → escenario USn.m → criterio SC en evidence-traceability.md.

local resume el subconjunto local de una ejecución y overall todos sus controles
obligatorios, con prioridad failed > pending > passed. Cada reporte individual tiene
scope local/complete y acceptance pending, incluso con overall passed. El resumen
separado de un par complete comparable A/B calcula acceptance: failed ante un overall
failed; pending si hay controles/evidencia pendientes; passed solo con ambos overall
passed y evidencia completa. Sin par comparable, acceptance pending y fallos conservados
en los reportes originales. Un 0 de ejecución no acepta por sí solo el incremento.

El seguimiento desactualizado de H02/CHK010 queda corregido con esta nota cronológica,
no mediante una declaración de implementación o pruebas realizadas. Los contratos y la
guía comparten las reglas del modelo; spec.md, OpenAPI, Constitución y decisiones históricas
permanecen intactos. Las correcciones y el plan recibieron aprobación humana expresa el
2026-11-10, registrada en plan.md; implementación y aceptación siguen pendientes.
