# F00 — Contrato propuesto de comprobaciones automáticas

Estado: contrato aprobado documentalmente con el plan el 2026-11-10; registro en
[plan.md](../plan.md). Los controles no están implementados ni ejecutados.
Referencias: [OpenAPI técnico](bootstrap.openapi.yaml),
[configuración](local-configuration.md), [modelo técnico](../data-model.md).

Windows 10 es el entorno principal aprobado de desarrollo local. Node.js 24.17.0 y
npm 11.13.0 son las referencias observadas, con PowerShell 5.1. No se requiere Windows 11,
Ubuntu, WSL, Docker, PostgreSQL, Redis o AWS para el grupo de controles sin navegador.
Playwright no se declara oficialmente soportado en Windows 10: la comprobación real
de la pantalla y sus negativos permanecen obligatorios y pendientes de ejecución en
un Windows oficialmente compatible, por ejemplo otro equipo Windows 11 autorizado.
No se actualiza el equipo actual ni se crea un runner o proveedor externo en esta fase.

## Aserciones observables

Las siguientes condiciones de aceptación completa se conservan íntegramente. La tabla
de ámbitos posterior indica qué evidencia parcial puede obtenerse localmente sin
convertir una comprobación no ejecutada en aprobada.

| Control | Condición de éxito futuro | Fallo que no debe ocultarse |
|---|---|---|
| UI | Navegar en Chromium local a http://127.0.0.1:4173/; documento HTTP 200; encabezado visible exacto “FarmaFind — Bootstrap” y marcador visible “Modo técnico: sin funcionalidades de negocio”. | PID vivo, HTML vacío, componente que no monta, error de página o recurso local obligatorio fallido. |
| API | GET http://127.0.0.1:3000/health devuelve 200, application/json y esquema OpenAPI con service farmafind-api. | Respuesta de otro servidor, redirect, 4xx/5xx, timeout o JSON incorrecto. |
| Notificaciones | GET http://127.0.0.1:3001/health devuelve 200 y esquema con service farmafind-notifications. | Proceso API usado como sustituto, envío de mensajes o consumo de eventos para responder salud. |
| Config válida | Los tres perfiles técnicos mínimos se validan sin valores de integración. | Pedir credenciales reales o usar una URL heredada. |
| Config inválida | Ausente/incorrecta rechazada con nombre y motivo, sin valor secreto, y salida no cero. | Usar default silencioso, levantar servidor o informar éxito. |
| Separación | Detener controladamente un proceso propio no detiene ni cambia los resultados técnicos de los otros dos. | Dependencia obligatoria entre los tres o terminación colectiva. |
| Limpieza | Todos los PIDs propios terminan y sus puertos quedan libres; los ajenos siguen intactos. | Procesos huérfanos, matar procesos ajenos o reutilizar servidores previos. |

La pantalla puede incluir el nombre del proyecto y explicar que es una base técnica.
No lista farmacias, medicamentos, existencias o reservas ficticias como si fueran funciones.
No usa fuentes/JS/recursos remotos ni llama al backend para mostrar el mensaje bootstrap.
Las rutas privadas/de negocio no se implementan en F00. Las rutas no definidas en los
procesos técnicos devuelven 404 sin datos, sin ampliar el contrato a CRUD o auth.

HTTP local de loopback es una decisión de desarrollo, no una sustitución de HTTPS
obligatorio en el destino desplegado. No se agregan certificados o recursos DNS aquí.

## Orquestación y separación

### Grupo local Windows 10 — verify:local

1. Comprobar Node/npm de referencia, configuración, revisión/lockfile y puertos libres.
   Chromium y soporte Playwright no son prerrequisitos de este grupo. No instalar lo ausente.
2. Ejecutar automáticamente check, check:config, test:base y build sin importar o lanzar
   Playwright. Conservar configuración válida/ausente/inválida, sintaxis/tipos/imports,
   compilación y contratos técnicos, sin conexión a servicios externos.
3. Lanzar y registrar PIDs propios de API, Notificaciones y preview Vite. Exigir las
   respuestas HTTP técnicas de API/Notificaciones con identidad correspondiente.
   Comprobar disponibilidad HTTP estática del frontend solo como evidencia parcial:
   no equivale a pantalla React cargada ni satisface por sí misma su aceptación.
4. Detener controladamente cada proceso propio, comprobar por HTTP los otros y relanzar
   únicamente lo detenido; detectar colisión de puertos sin terminar procesos ajenos.
   Esto acredita separación de procesos/HTTP, no separación con la UI efectivamente visible.
5. Limpiar en finally/cancelación todos los PIDs propios, registrar resultados locales
   y dejar UI, negativos de navegador y aceptación completa en pending por plataforma.

El perfil local no elimina ni sustituye ninguna aserción de la tabla inicial. Es un
subconjunto que permite continuar desarrollo en Windows 10 sin afirmar aceptación global.

### Grupo completo — verify:bootstrap, pendiente de entorno compatible

1. Preflight de Windows oficialmente compatible con Playwright, Node/npm exactos, navegador local, configuración,
   revisión/lockfile e independencia de puertos. No intentar instalar lo ausente.
2. Ejecutar check, check:config, test:base y build con herramientas locales. La orden
   pública verify:bootstrap debe orquestarlos sin descarga y conservar resultados.
3. Lanzar tres procesos propios: Node compilado de API, Node compilado de Notificaciones
   y CLI Vite preview del frontend compilado. Nunca apuntar a servidores ya existentes.
4. Esperar como máximo 60 s por proceso y comprobar las tres aserciones observables.
   El readiness de una herramienta no sustituye HTTP 200/JSON/DOM requeridos.
5. Detener Notificaciones: comprobar API y UI. Relanzar solo Notificaciones con su perfil.
   Repetir deteniendo API y comprobando UI/Notificaciones; repetir deteniendo preview web
   y comprobando API/Notificaciones. Restaurar y registrar identidad de procesos relanzados.
6. Limpiar todos los procesos propios en finally/cancelación y registrar el resultado.
   Un fallo previo sigue siendo fallo después de una limpieza exitosa.

Si la plataforma o navegador requerido no están disponibles, registrar el prerrequisito
no satisfecho y los controles no ejecutados como pending, sin lanzar instalaciones
automáticas ni omitir UI para devolver 0 global. Conservar además cualquier fallo real
observado como failed; un pendiente por plataforma no borra errores de otros controles.

### Ámbitos y evidencia

| Control obligatorio | Grupo local Windows 10 | Aceptación completa posterior |
|---|---|---|
| Configuración válida/ausente/inválida, sintaxis/tipos/imports y build | Automático sin navegador, cuando exista implementación autorizada. | Repetir dentro de las dos preparaciones completas de la revisión común. |
| API y Notificaciones: HTTP/JSON/identidad propios | Automático en loopback. | Conservar las mismas aserciones y resultados observables. |
| Frontend | Build y disponibilidad HTTP estática; alcance parcial. | Playwright prueba pantalla y marcador visibles, recursos y errores. Pendiente, sin reemplazar por HTTP/PID. |
| Separación | Procesos y HTTP independientes; evidencia parcial. | Repetir las comprobaciones con UI efectivamente cargada, tal como exige la secuencia completa. |
| Puertos y limpieza | Automático para PIDs propios, sin navegador. | Repetir en el grupo completo, incluido cierre del navegador/procesos propios. |
| UI y negativos de navegador | Pending por plataforma; no exigidos para éxito del grupo local. | Obligatorios en entorno oficialmente compatible; nunca skipped como equivalente a passed. |

No exigir que otro componente replique la función del detenido: se comprueba su propia
independencia técnica, no fallback funcional ni alta disponibilidad del producto.

## Negativos mínimos

- APP_MODE/HOST/PORT requeridos ausentes y valores inválidos; VITE_APP_MODE ausente/inválido.
- Puerto ocupado por un listener de prueba propio: detectar colisión, no cambiarlo ni
  terminar un proceso que no inició el supervisor de ese escenario.
- Endpoint con identidad/estado incorrecto o que no responde: debe fallar el control,
  incluso si existe un PID. Fixture de prueba local, no un servicio externo.
- Pantalla sin marcador visible/error de montaje/recurso requerido fallido: control fallido.
- Chromium no preparado: prerrequisito no satisfecho del grupo completo y controles de
  navegador pending; nunca descarga automática durante suite. No bloquea el grupo local.
- Parada de un componente y continuidad de los otros; limpieza interrumpida/fallida.
- Integraciones futuras ausentes: arranque técnico sigue posible sin simularlas saludables.

## Tiempos y reportes

Límites propuestos: inicio 60 s/componente, HTTP 5 s/petición, DOM 10 s/aserción y
limpieza 10 s/proceso. Alcanzar el límite es fallo registrable con componente y etapa.
No se fija un p95 del producto ni un tiempo total de instalación; red/equipo pueden
variar durante preparación, y AC01 pertenece a futuras búsquedas.

Reporte por ejecución en artifacts/f00/<run-id>, identificado con A o B, incluye
comandos exactos sin secretos, versiones, revisión/hashes, fecha UTC, expectativas,
resultados, errores o none explícito, PIDs propios, cierre y enlaces a captura técnica.
JSON/texto pueden complementar reportes de herramientas; nunca inventar capturas verdes.
Se registra además ámbito local/completo y resultado por control. Las capturas y versiones
de navegador se marcan pendientes cuando no se ejecutó Playwright; no se inventan para
rellenar campos. Los errores locales se conservan aunque la aceptación esté pendiente.

verify:local devuelve 0 únicamente por sus controles locales y limpieza satisfactorios;
el reporte distingue `scope: local`, `local: passed`, `overall: pending` y `acceptance: pending`.
Un fallo local devuelve 1 con local failed y overall failed; acceptance individual
permanece pending. Ninguno de esos resultados acredita F00 completa.
verify:bootstrap, con scope complete, devuelve 0 de ejecución completa solo si overall
es passed: pasan todas las condiciones obligatorias y
limpieza; falla o devuelve no cero con prerrequisito pendiente si no puede ejecutarlas.
Un control no ejecutado tiene estado pending, no passed. Sin evidencia completa de A y B,
no se cierra F00 aunque una ejecución o el grupo parcial tenga salida 0.

La [tabla común de estados y agregación](../data-model.md#contrato-común-de-estados-y-agregación)
define todos los campos y combinaciones válidas. local agrega el subconjunto sin navegador;
overall agrega todos los controles obligatorios de esa ejecución, incluida UI. En ambos
se aplica failed > pending > passed: un fallo real no se degrada a pending porque otro
control no se haya ejecutado. Un prerrequisito UI ausente sin otros fallos deja overall
pending, no passed. Una limpieza fallida afecta al conjunto de procesos correspondiente.
Un PID activo nunca determina por sí mismo ninguno de estos estados.

acceptance individual siempre es pending, incluso con overall passed. El resumen separado
del par A/B referencia reportes complete de revisión común e independencia acreditada;
con ese par, acceptance es failed si algún overall falla, pending si falta completar
controles/evidencia y passed solo si ambos overall y toda la evidencia son satisfactorios.
Sin par comparable es pending, sin ocultar los fallos de sus reportes. No se reescriben
reportes históricos para sustituir un fallo por el estado de una repetición posterior.

Cada preparación A/B parte de una copia limpia e independiente de la misma revisión,
con configuración, dependencias instaladas y reportes propios. Puede hacerlas una misma
persona. Registrar comandos, versiones, resultados esperados y obtenidos, errores o none.
No reutilizar node_modules, dist, .env.local o reportes entre preparaciones; se permite
compartir prerrequisitos/caché de descarga. Completar después la aceptación en dos copias
limpias de la revisión común en entorno compatible, sin sumar éxitos de distintas revisiones
o una prueba UI aislada a reportes locales para declarar cerrado todo el incremento.

## Sin servicios externos

Ambos grupos usan únicamente loopback. El grupo Windows 10 sin navegador no carga
Playwright ni requiere instalar Chromium. En el grupo completo compatible, interceptar
solicitudes del navegador y rechazar
destinos no locales, deshabilitar service workers y no usar CDN/fonts externas.
Los procesos Node no contienen clientes ni ejecución activa de integraciones en F00;
revisar imports y configuración. Este control no se presenta como firewall de red ni
como prueba de seguridad exhaustiva del SO. No se requieren credenciales reales,
permisos de administrador, contenedores o cuentas AWS.

Playwright solo verifica UI técnica en esta feature; no se declara completado el criterio
docente de E2E de negocio. Los controles de imports no acreditan RLS o aislamiento real
de datos. Su implementación y tests llegarán con las funcionalidades correspondientes.
Docker continúa obligatorio en etapas posteriores previstas, aunque esté fuera de F00.
No se elimina la arquitectura AWS ni PostgreSQL/RLS, Redis Cache-Aside o UoW/Outbox por
postergar su implementación; ningún endpoint técnico acredita que ya estén operativos.
