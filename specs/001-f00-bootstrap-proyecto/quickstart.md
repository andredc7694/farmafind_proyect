# F00 — Guía corregida de desarrollo Windows 10 y aceptación pendiente

Estado: guía complementaria aprobada expresamente con el plan, 2026-11-10; registro en
[plan.md](plan.md). **No existen todavía las
aplicaciones, manifests, lockfile o scripts aquí descritos.** Los comandos son interfaces
previstas de una implementación posterior aprobada; no se ejecutan en esta corrección.

Decisión aprobada: desarrollar en Windows 10 con VS Code, Codex, Spec Kit, Node.js y npm.
No instalar Ubuntu/WSL, actualizar Windows o añadir Docker para continuar F00.
Node.js 24.17.0 y npm 11.13.0 permanecen como referencias observadas.

Referencias: [plan corregido](plan.md), [investigación](research.md),
[configuración](contracts/local-configuration.md), [aceptación completa](contracts/validation.md),
[evidencias](evidence-traceability.md).
Los contratos complementarios ya incorporan el perfil local y conservan el completo.
La matriz de evidence-traceability.md cruza cada requisito con los escenarios y criterios
de éxito existentes. El [contrato común de estados](data-model.md#contrato-común-de-estados-y-agregación)
es la referencia de los reportes; estas son correcciones documentales, no pruebas ejecutadas.

## Dos ámbitos de verificación

| Ámbito | Entorno | Comprobaciones previstas | Alcance del resultado |
|---|---|---|---|
| Desarrollo y controles locales sin navegador | Windows 10 actual; PowerShell 5.1, Node 24.17.0/npm 11.13.0 | Configuración válida/ausente/inválida, sintaxis/tipos/imports, compilación frontend/backend/Notificaciones, contratos y endpoints HTTP, colisión de puertos, separación de procesos y limpieza. | Éxito o fallo local parcial, cuando exista implementación; no acredita UI React visible ni aceptación global. |
| Navegador y aceptación completa | Windows oficialmente compatible con Playwright, por ejemplo equipo Windows 11 x64 disponible posteriormente | Pantalla React/Vite bootstrap cargada, negativos y recursos UI, separación de los tres componentes con resultados observables, más todos los controles locales. | Pendiente de entorno y ejecución; requiere dos preparaciones limpias independientes de la misma revisión para cerrar aceptación. |

No se declara soporte oficial de Playwright en Windows 10. Su [documentación oficial](https://playwright.dev/docs/intro#system-requirements)
no incluye ese SO. Disponer de un entorno compatible para completar la prueba es un
pendiente, no permiso para actualizar el equipo actual ni para sustituir pruebas por
capturas manuales, HTTP estático o procesos activos. No se habilita un servicio externo
como dependencia de las comprobaciones.

## Prerrequisitos de desarrollo y controles locales futuros

- Especificación y plan corregido aprobados; fase de implementación/ejecución pendiente
  de autorización separada. La aprobación documental no permite ejecutar esta guía.
- Windows 10 y herramientas locales ya indicadas; no se exige otro SO o shell adicional.
- Fuente/snapshot inmutable de la futura implementación, tres workspaces y lockfile raíz
  revisado. npm workspaces, React/Vite y Express/TypeScript se conservan.
- Dependencias de controles locales preparadas mediante una instalación autorizada.
  Esa preparación puede usar internet; los controles posteriores no descargan herramientas
  ni utilizan Docker, BD, caché, AWS, IA o proveedores externos.
- Puertos 4173, 3000 y 3001 libres para preview técnico, API y Notificaciones. 5173 solo
  para desarrollo manual. Configuración ficticia local desde ejemplos, sin secretos reales.
- No se requiere Chromium, browser:install ni soporte Playwright para ejecutar el grupo
  sin navegador. La ausencia de navegador no convierte sus controles en fallidos por sí sola;
  deja explícitamente pendiente la aceptación UI/global.

La comprobación de Node/npm observada durante planificación no acredita que dependencias,
compilación o endpoints funcionen: aún no existe código. Si falla un prerrequisito local,
registrarlo y detener el control afectado sin ocultarlo ni cambiar versiones silenciosamente.

## Preparaciones limpias A y B

Una misma persona puede realizar ambas en el mismo equipo Windows 10. Partir de dos
copias independientes de la misma revisión/snapshot, por ejemplo
`C:\FarmaFindValidacion\A` y `C:\FarmaFindValidacion\B`. Son rutas ilustrativas, no creadas aquí.
No incluir node_modules, dist, .env.local, reportes, procesos ni configuración privada de
la otra preparación. No limpiar destructivamente el checkout actual para obtenerlas.

Registrar revisión y hashes de fuente, manifiestos y lockfile; si no existe commit,
usar el manifiesto/hash acordado sin inventar SHA ni crear commits en esta fase.
Compartir herramientas instaladas y caché de descargas no equivale a reutilizar el estado
preparado. Para cada preparación registrar comandos, directorios, versiones, expectativas,
resultados obtenidos y errores, o ausencia explícita de errores cuando corresponda.

### Preparación local A — comandos previstos, no ejecutados

Solo después de implementar y autorizar la ejecución:

```powershell
Set-Location -LiteralPath 'C:\FarmaFindValidacion\A'
node --version
npm.cmd --version
git --version
npm.cmd ci
npm.cmd ls --all
```

Esperado: referencias de herramientas correctas, instalación congelada sin alterar lockfile
y árbol registrado. Si falta lockfile, detener; no sustituir ci por una actualización
no revisada. No ejecutar browser:install en la preparación Windows 10 de controles locales.
Preparar .env.local por componente desde sus ejemplos ficticios; no copiar secretos o
activar DATABASE_URL, REDIS_URL, IA o AWS.

### Controles locales A — interfaces previstas

```powershell
npm.cmd run check
npm.cmd run check:config
npm.cmd run test:base
npm.cmd run build
npm.cmd run verify:local -- --preparation A
```

verify:local es una propuesta descrita también en contracts/local-configuration.md,
no un comando existente. Los documentos ya están armonizados; su implementación requiere
autorizar la fase correspondiente; el plan ya está aprobado. No ejecutarlo ahora.

Los controles locales se ejecutarán automáticamente sin importar o lanzar Playwright.
El supervisor podrá iniciar procesos propios, verificar HTTP 200 e identidad correcta
de API y Notificaciones, comprobar disponibilidad HTTP del frontend estático, separación
de procesos y limpieza. HTTP del frontend o build satisfactorio no prueban que React cargó;
la pantalla visible permanece pendiente de navegador, al igual que los negativos UI.

Cada control informa éxito/fallo y registra su evidencia. Un fallo esperado de un caso
negativo solo cuenta como correcto si satisface la expectativa definida; no oculta un
fallo inesperado del sistema. El reporte individual incluye scope local y siempre
acceptance pending. Con local passed, overall queda pending porque UI no fue comprobada;
con local failed, overall es failed aunque UI siga pending. Las agregaciones local/overall
siguen failed > pending > passed según el modelo, conservando cada error y cada pendiente.
Un exit code 0 de verify:local significa únicamente éxito local parcial. No sustituye
la salida global de verify:bootstrap ni permite declarar F00 terminada.

### Preparación y controles locales B — interfaces previstas

Cerrar solo procesos propios de A y comprobar sus puertos libres. En B, repetir desde
fuente limpia y preparar de nuevo los perfiles desde ejemplos, sin reutilizar estado de A:

```powershell
Set-Location -LiteralPath 'C:\FarmaFindValidacion\B'
node --version
npm.cmd --version
npm.cmd ci
npm.cmd ls --all
npm.cmd run check
npm.cmd run check:config
npm.cmd run test:base
npm.cmd run build
npm.cmd run verify:local -- --preparation B
```

Comparar hashes de fuente/lockfile y resultados locales, no run-id o tiempos idénticos.
Cada preparación conserva su registro propio, con controles UI/global pendientes por
plataforma. Cambiar fuente o lockfile exige repetir A/B de la revisión común antes de
atribuir reproducibilidad. No editar reportes para ocultar errores o pendientes.

## Pruebas de navegador pendientes de entorno compatible

No ejecutar browser:install o la suite Playwright en Windows 10 suponiendo soporte oficial.
No se cambia Windows ni se instala Ubuntu como parte de F00. Cuando exista un equipo Windows
oficialmente compatible y se autorice su uso, preparar dos copias limpias de la misma
revisión con todos los prerrequisitos y ejecutar la suite completa, sin depender de servicios
externos durante los controles. Un futuro runner compatible podría evaluarse por separado;
no se crea ni se presume autorizado aquí.

Interfaces conservadas para ese entorno, **todavía pendientes**, después de su preparación:

```powershell
npm.cmd run browser:install
npm.cmd run verify:bootstrap -- --preparation A
```

Repetir la preparación completa y verify:bootstrap con B en su propia copia. No basta
trasladar un reporte parcial de Windows 10 ni ejecutar solo una prueba aislada de navegador.
La revisión/lockfile debe ser común y los reportes indicar plataforma; si cambia la fuente,
no mezclar resultados de diferentes revisiones para cerrar los criterios.

La suite completa conserva las aserciones aprobadas: pantalla técnica “FarmaFind — Bootstrap”
cargada realmente, endpoint técnico Express y respuesta local independiente de Notificaciones,
sin negocio, mensajes o eventos reales; configuración, errores, separación y limpieza
se verifican también. Browser:install solo prepara el navegador compatible; no acredita UI.
Todos los controles y resultados exigidos en contracts/validation.md siguen obligatorios.

En cada ejecución completa el reporte tiene scope complete. overall passed permite
salida 0 de esa ejecución, pero su acceptance individual sigue pending: la pareja A/B
se consolida aparte. Un fallo obligatorio observado produce overall failed; sin fallos,
un prerrequisito o evidencia ausente produce overall pending y salida 1. No se borra
un fallo conocido porque haya otra prueba pendiente.

Si se intenta verify:bootstrap completo sin plataforma/navegador admisibles, debe registrar
el prerrequisito no satisfecho, dejar los controles no ejecutados en pending y no devolver
éxito global. No usar skips que conviertan falta de evidencia en passed. La suite local
puede seguir utilizándose para desarrollo sin declarar completos los criterios de aceptación.

## Registro y cierre pendiente

Por cada A/B: fuente/hashes, Windows/build, shell, Node/npm/paquetes, comandos, expectativas,
resultados, errores/none, cierre de PIDs y ámbitos comprobados. Para Playwright se añadirán
versiones de navegador, capturas y resultados reales cuando exista entorno compatible.
No publicar secretos, datos personales o inventarios reales. Ninguna integración futura
se informa saludable por responder /health técnico.

Conservar los 20 requisitos, las aclaraciones y los 16 criterios docentes. E-F00-05 y
F00-SC-001/002/007 permanecen pendientes de aceptación completa mientras falte UI o
cualquier prueba obligatoria de ambas preparaciones. El resumen separado identifica los
runId A/B de ámbito complete, su revisión común y su independencia: acceptance failed
si algún overall falla; pending si hay controles/evidencia pendientes; passed solo con
ambos overall passed y evidencia completa. Sin par comparable, acceptance pending,
preservando los fallos observados. No se reescriben reportes anteriores ni se suman
intentos/revisiones distintos para producir un éxito. Tener dos registros locales
parciales no basta para declarar F00 completamente validada.

La corrección anterior se limitó a tres documentos; su armonización complementaria ya
fue incorporada y el mantenimiento actual actualiza trazabilidad, seguimiento y estados.
No se ejecutó ningún comando de preparación o comprobación de aplicaciones, instalación,
código, infraestructura o despliegue.
El plan corregido y esta guía recibieron aprobación humana expresa. La invocación posterior
de speckit-tasks solo autoriza tareas documentales; no ejecutar esta guía ni implementar.
