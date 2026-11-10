# F00 — Contrato propuesto de configuración y comandos locales

Estado: contrato aprobado documentalmente con el plan el 2026-11-10; registro en
[plan.md](../plan.md). No se crean archivos de configuración ni scripts en esta fase.
Los comandos son contrato de una implementación futura aprobada, no instrucciones ya ejecutadas.

Windows 10 es el entorno principal de desarrollo aprobado, con VS Code, Codex,
Spec Kit, Windows PowerShell 5.1, Node.js 24.17.0 y npm 11.13.0 como referencias
observadas. No se exige Windows 11, Ubuntu, WSL o Docker para desarrollo y controles
locales sin navegador. No se afirma soporte oficial de Playwright en Windows 10:
sus pruebas obligatorias quedan pendientes de un entorno oficialmente compatible,
por ejemplo otro equipo Windows 11 disponible posteriormente y autorizado por separado.

## Configuración por componente

| Componente | Variable / entrada | Ejemplo ficticio | Obligatoria F00 | Visibilidad / validación |
|---|---|---|---|---|
| Frontend | VITE_APP_MODE | bootstrap | Sí | Pública; único valor bootstrap. |
| Lanzador frontend | HOST | 127.0.0.1 | Sí | Local; no 0.0.0.0 en aceptación. |
| Lanzador frontend | DEV_PORT / PREVIEW_PORT | 5173 / 4173 | Sí | Local; enteros válidos y strictPort. |
| API | APP_MODE | bootstrap | Sí | Local; otro valor produce error F00. |
| API | HOST | 127.0.0.1 | Sí | Local; valor permitido en aceptación. |
| API | PORT | 3000 | Sí | Local; entero 1–65535 y distinto de los demás. |
| Notificaciones | APP_MODE | bootstrap | Sí | Configuración propia; bootstrap. |
| Notificaciones | HOST | 127.0.0.1 | Sí | Local. |
| Notificaciones | PORT | 3001 | Sí | Entero válido y libre; proceso separado. |
| Supervisor | preparation / run-id | A o B / identificador sintético | Sí al verificar | Argumentos locales; sin identidad personal. |
| Supervisor | output directory | artifacts/f00/<run-id> | Sí | Local y propio del run; no sobrescribir el reporte de otro. |

Propuesta de archivos futuros: `.env.example` versionado y `.env.local` privado en cada
workspace. El ejemplo frontend solo tiene VITE_APP_MODE; el lanzador de web recibe HOST
y puertos desde configuración local de supervisión, separados del bundle público.
Las pruebas usan fixtures temporales de configuración propia; no editan el .env.local
real del desarrollador. Mantener igualdad entre puertos pasados al servidor y al verificador.

Procesos Node leen configuración mediante el soporte de archivo de entorno de Node 24,
con ruta explícita; no se requiere dotenv ni lectura de secretos desde el navegador.
Variables heredadas del entorno del equipo no deben sobreponerse silenciosamente al
perfil de prueba: el supervisor valida un perfil propio, limita las entradas y registra
nombres de variables, nunca un volcado completo del entorno. Mantener las variables
de sistema mínimas que Windows necesite para crear y cerrar procesos.

Catálogo futuro, solo comentado: DATABASE_URL, REDIS_URL, AI_PROVIDER/AI_API_KEY y
configuración AWS. No se incluyen valores de credenciales reales ni una URL de producción.
No son requeridas ni leídas por bootstrap y no habilitan servicios si aparecen por accidente.
En F00 no hay modo que permita conectar esas integraciones; se declaran no configuradas.
Ningún prefijo VITE_* se utiliza para contraseñas, tokens o claves de proveedor.

Fallo de variable requerida: identificar nombre y motivo, terminar con salida no cero y
no publicar endpoints o pantalla como saludables. PORT vacío, no numérico, fuera de rango,
HOST no permitido y APP_MODE distinto de bootstrap se prueban como rechazos.
Si el puerto está ocupado no se cambia de puerto ni se mata el proceso que lo posee.

## Scripts npm propuestos

| Script raíz futuro | Efecto contractual | Conexiones |
|---|---|---|
| dev:web | Vite local 127.0.0.1:5173, puerto estricto, pantalla bootstrap. | Solo loopback. |
| dev:api | Compilar backend y arrancar su artefacto Node con perfil local. | Sin integración externa. |
| dev:notifications | Compilar y arrancar Notificaciones por separado. | Sin mensajes ni eventos. |
| build | Construir frontend y compilar ambos procesos TS con versiones locales. | Ninguna descarga ni nube. |
| check | Verificar sintaxis de scripts JS, tipos TS e imports que violen límites de F00. | Ninguna. |
| check:config | Casos válido/ausente/inválido por componente, con perfil de prueba. | Ninguna. |
| test:base | Unitarias técnicas y contratos HTTP sin BD/caché; conserva resultados. | Solo procesos/in-memory locales. |
| verify:local | Ejecutar check, check:config, test:base y build, supervisar endpoints y procesos locales, registrar y limpiar sin importar ni lanzar Playwright. | Windows 10; solo loopback, sin navegador ni servicios externos. |
| browser:install | Preparar Chromium con el CLI local de Playwright, posteriormente en un entorno oficialmente compatible. No es prerrequisito del grupo local Windows 10. | Descarga solo en preparación autorizada; no implica actualización de Windows ni instalación de Ubuntu. |
| verify:bootstrap | Ejecutar todos los controles obligatorios, incluidos UI real, negativos de navegador y separación con UI observable, y limpiar. | Entorno oficialmente compatible; solo loopback, sin descargas durante suite. Pendiente de disponibilidad y ejecución. |

`npm.cmd run verify:local -- --preparation A` y equivalente B son las interfaces del
grupo parcial Windows 10. Cada preparación parte de una copia limpia de la misma
revisión y conserva su registro independiente, aunque la realice una misma persona.
La falta de Chromium no bloquea este grupo. La preparación de dependencias puede
necesitar internet, pero los controles locales no instalan ni descargan herramientas.

El grupo local comprueba automáticamente configuración, sintaxis/tipos/imports,
compilación de los tres componentes, contratos y respuestas HTTP técnicas de API y
Notificaciones, disponibilidad HTTP estática del frontend, puertos, separación de
procesos y limpieza. HTTP estático, compilación o PID activo no demuestran montaje
React ni sustituyen la aceptación de pantalla o la separación comprobada con UI visible.

`npm.cmd run verify:bootstrap -- --preparation A` y equivalente B conservan la interfaz
de aceptación completa. Deben ejecutarse posteriormente en dos preparaciones limpias
independientes de una misma revisión sobre un entorno oficialmente compatible con
Playwright. No basta sumar reportes parciales de revisiones distintas ni una prueba UI
aislada a registros locales anteriores para declarar aceptación completa.

La implementación debe propagar preparación, perfil y ámbito local/completo a todos los
subcontroles y reportes. Los scripts individuales son útiles para diagnóstico, pero
no sustituyen ninguna de las dos ejecuciones completas A/B. La elección del grupo local
no vuelve opcionales las verificaciones UI. Este documento define contratos futuros,
no scripts ya creados, pruebas ejecutadas o autorización de implementación.
`check`, `test:base`, `verify:local` y `verify:bootstrap` no deben usar `--if-present` o tolerancia a fallos
que convierta controles ausentes en éxito. Un control inaplicable debe ser explicitado
y revisado, no omitido silenciosamente.

Preparación de dependencias: lockfile raíz único, npm ci y sin gestores paralelos.
El lockfile se creará/versionará en una implementación autorizada antes de aceptar A/B;
no existe en esta entrega de planificación. Nunca ejecutar npm ci como parte del control
que exige no usar servicios externos. No invocar herramientas mediante npx con descarga
implícita; los npm scripts resuelven los binarios locales ya preparados.

## Salidas y seguridad

- La definición común de campos, combinaciones y agregación está en
  [data-model.md §Contrato común de estados y agregación](../data-model.md#contrato-común-de-estados-y-agregación).
  Cada reporte individual incluye scope (local/complete), local, overall y acceptance;
  los tres estados usan pending/passed/failed, pero acceptance individual siempre es pending.
  La aceptación del par se informa en un resumen separado que referencia A y B.
- verify:local devuelve 0 solo si todos sus controles locales y limpieza pasan. Su
  reporte distingue `scope: local`, `local: passed`, `overall: pending` y `acceptance: pending`; ese 0 no
  acredita F00 completa. Ante fallo local devuelve 1 y registra `local: failed` y
  `overall: failed`, manteniendo `acceptance: pending` individual, sin
  ocultar errores porque existan controles de navegador todavía pendientes.
- verify:bootstrap, con scope complete, devuelve 0 de ejecución completa solo si overall
  es passed: todos los controles obligatorios,
  incluidos UI real y separación con UI, y la limpieza pasan. Sin plataforma compatible
  o navegador preparado registra prerrequisito no satisfecho, UI no ejecutada en pending
  y salida no cero; nunca omite UI para devolver éxito global. La aceptación de F00
  necesita ambas preparaciones completas satisfactorias, no el 0 de una sola ejecución.
  Si UI no tiene prerrequisito y no hay fallos observados, overall es pending. Un fallo
  obligatorio real produce overall failed aunque UI siga pending. La regla común para
  local/overall es failed > pending > passed, sin omitir controles o evidencia requerida.
- Incluso una ejecución completa satisfactoria conserva acceptance individual pending.
  El resumen A/B requiere dos reportes complete de la misma revisión e independencia
  acreditada: acceptance failed si algún overall es failed; pending si falta un control
  o evidencia; passed solo con ambos overall passed y evidencia completa. Sin par
  comparable acceptance es pending, preservando los fallos en los reportes originales.
- Salida 1 ante error de configuración, compilación, aserción, proceso o limpieza.
  La causa y el componente figuran en el reporte; no se confunden códigos HTTP con exit codes.
- Ctrl+C/interrupción no produce resultado passed; debe intentar limpiar solo PIDs propios
  y conservar evidencia de interrupción o limpieza fallida.
- No se admite output con .env completo, credenciales, cabeceras de autorización o rutas
  personales sin redactar cuando se publique evidencia. Los logs locales siguen minimización.
- Prohibidos comandos destructivos de limpieza del árbol del usuario. Para dos preparaciones
  se usan directorios nuevos; no se prescribe git clean, reset, borrado de volúmenes ni
  eliminación de archivos no revisados.

## Preparación para etapas posteriores

Estos comandos no crean GitHub Actions. Su interfaz permitirá un futuro job Windows con
checkout, setup de herramientas, npm ci, navegador en entorno oficialmente compatible,
controles y artefactos revisados, si se autoriza ese trabajo posteriormente.
La indisponibilidad de ese entorno deja navegador/aceptación pendientes; no obliga a
cambiar Windows 10, instalar Ubuntu/WSL o utilizar Docker en F00. PostgreSQL con RLS,
Redis Cache-Aside, UoW/Outbox, Docker y AWS siguen siendo obligaciones posteriores de
la arquitectura, no integraciones operativas ni dependencias de estos controles.
No hay deploy tras merge, IAM/OIDC, secrets CI, publicación npm, conexión a servicios
de producción o necesidad de permisos de administrador para verificar F00.
