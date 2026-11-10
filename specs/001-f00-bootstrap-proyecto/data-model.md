# F00 — Modelo de información técnica

Estado: diseño técnico aprobado documentalmente con el plan el 2026-11-10;
registro de aprobación en [plan.md](plan.md). No implementado ni validado.
Este documento describe configuración, estados técnicos y evidencia; no contiene un
modelo relacional de negocio, migraciones ni entidades clínicas o de inventario.

## Componente base

| Campo | Tipo conceptual | Regla |
|---|---|---|
| componentId | Enumeración | frontend, farmafind-api o farmafind-notifications; único dentro de una preparación. |
| role | Enumeración | SPA estática, núcleo modular o proceso independiente. |
| host | Dirección local | 127.0.0.1 para aceptación F00. |
| port | Entero | 1–65535, distinto para cada proceso y libre al iniciar. |
| mode | Enumeración | Solo bootstrap; no modo producción o negocio en F00. |
| lifecycle | Estado de proceso | not_started, starting, running, stopping, stopped o failed. |
| observableCheck | Estado de comprobación | pending, passed o failed; no derivado solamente de lifecycle. |
| processOwnership | Referencia técnica | PID y proceso lanzado por el supervisor; nunca un PID ajeno usado por nombre. |

Transiciones: not_started → starting → running → stopping → stopped. Error de inicio,
respuesta o limpieza conduce a failed en el control correspondiente. Un proceso running
no implica observableCheck passed. Se conserva el resultado del fallo aunque luego se
limpien procesos. No se definen transiciones de reservas aquí: ADR-10 sigue preservada.

El frontend no debe necesitar API para presentar su pantalla bootstrap. API y Notificaciones
no comparten instancia Express, configuración mutable ni proceso. Un controlador técnico
no invoca casos de uso de negocio ni repositorios.

## Perfil de configuración

| Campo | Tipo conceptual | Regla |
|---|---|---|
| profileId | Identificador técnico | Preparación + componente; no identidad personal. |
| variables | Lista de definiciones | Nombre, tipo, obligatoriedad, visibilidad y validación. |
| visibility | Enumeración por variable | public, private o future_disabled. |
| source | Referencia local | Ejemplo versionado o archivo local privado; nunca se registra contenido secreto. |
| validation | Resultado | valid o rejected; errores incluyen nombre y causa, no valor privado. |

APP_MODE, HOST y PORT son obligatorios en procesos Node. En frontend solo se publica
VITE_APP_MODE=bootstrap; puertos y host del lanzador técnico no son secretos ni se
confunden con configuración privada. No hay credenciales de negocio requeridas en F00.
El catálogo de variables futuras está comentado y deshabilitado; ausencia no bloquea.
No se aceptan interpolaciones de secretos privados en frontend o evidencia.

## Preparación limpia

| Campo | Tipo conceptual | Regla |
|---|---|---|
| preparationId | Enumeración | A o B, dos registros distintos de la misma revisión. |
| sourceRevision | Referencia inmutable | Commit cuando exista; además hash de árbol/manifest y lockfile. Nunca inventar un SHA si no hay commit. |
| workingDirectory | Ruta de preparación | Copia separada del árbol; no contiene secretos o outputs de la otra. Se redacta el usuario de rutas si se publican. |
| platform | Datos de entorno | Windows edición/build/arquitectura, shell, Node, npm, paquetes y navegador. |
| prerequisites | Inventario | Herramientas del grupo local preparadas; navegador solo obligatorio para el grupo completo en entorno oficialmente compatible. Su ausencia no bloquea el grupo Windows 10. |
| actor | Alias ficticio | Puede ser el mismo en A y B; no DNI, correo personal o identificación médica. |
| status | Estado | pending, prepared, validating, passed o failed. |

Restricciones: A y B comparten revisión de código, lockfile e instrucciones, pero no
node_modules, dist, .env.local, procesos ni reportes. Se permite un mismo equipo,
misma persona y caché de descarga/navegador preparado. El registro de B nunca se copia de A.
Configurar una copia nueva y ejecutar toda la preparación es diferente de reejecutar
la suite en A. Si hay fallos, se conserva su historial; después de cambiar código/lockfile
se requiere una pareja A/B de la nueva revisión para afirmar reproducibilidad.

## Registro de verificación

| Campo | Tipo conceptual | Regla |
|---|---|---|
| runId | Identificador único | F00 + preparación + instante UTC; no contiene secretos. |
| preparationId | Referencia | A o B existente. |
| scope | Enumeración | local o complete; distingue verify:local de verify:bootstrap y no altera las obligaciones completas. |
| requirementIds | Lista | Referencias F00-FR, F00-SC y criterios de rúbrica asociados. |
| commands | Lista ordenada | Comando, directorio, inicio/fin, código de salida; no valores secretos como argumentos. |
| versions | Inventario | Herramientas, paquetes, navegador y hashes de manifiestos/lock. |
| expected | Resultado por control | Condición documentada antes de ejecutar. |
| actual | Resultado por control | Valor observado, identificador de componente y duración; no credenciales. |
| errors | Lista redactada | Incidencias reales o declaración explícita none si no ocurrieron. |
| artifacts | Referencias | JSON/texto, resultados HTTP y captura de pantalla técnica con rutas relativas. |
| cleanup | Resultado | PIDs propios cerrados/puertos liberados; pendiente o fallo impide éxito global. |
| local | Enumeración | pending, passed o failed para los controles obligatorios del subconjunto local de esa ejecución. |
| overall | Enumeración | pending, passed o failed para todos los controles obligatorios de esa ejecución completa, incluidos UI y limpieza. |
| acceptance | Enumeración | pending en el registro individual; se determina para F00 en un resumen del par A/B con las reglas siguientes. |

Una preparación tiene registros de verificación identificados por runId y un resumen
de comandos. El resumen del par referencia los runId candidatos A y B, revisión/hashes,
comprobación de independencia y evidencia asociada; no mezcla ejecuciones para fabricar
un resultado. Esta información es un contrato conceptual, no un archivo de resultados
creado ni un esquema de base de datos implementado.

## Contrato común de estados y agregación

Esta sección es la referencia común de los contratos, guía, plan y trazabilidad.
No añade pruebas ni reduce los 20 requisitos, escenarios o siete criterios de éxito.
Windows 10 sigue siendo el entorno principal de desarrollo. Playwright permanece obligatorio
para aceptación completa, pendiente de un Windows oficialmente compatible.

### Vocabulario y niveles

| Nivel / campo | Valores y obligatoriedad | Significado |
|---|---|---|
| Resultado de cada control | pending, passed o failed; obligatorio por control previsto. | pending: sin resultado concluyente o sin prerrequisito; passed: expectativa satisfecha con evidencia; failed: expectativa incumplida o error real. Un error esperado del escenario negativo es passed solo si satisface esa expectativa. |
| Ejecución / scope | local o complete; obligatorio junto con runId, preparationId y revisión. | local solo incluye el subconjunto Windows 10 sin navegador; complete pretende todos los controles, incluido Playwright. |
| Ejecución / local | pending, passed o failed; obligatorio en ambos ámbitos. | Agrega configuración, sintaxis/tipos/imports, build, HTTP técnico, separación local y limpieza de sus procesos. No acredita UI real. |
| Ejecución / overall | pending, passed o failed; obligatorio en ambos ámbitos. | Agrega todos los controles obligatorios completos de esa ejecución. El ámbito local nunca puede producir overall passed. |
| Ejecución / acceptance | Siempre pending; obligatorio. | Una ejecución individual no decide la aceptación de la pareja A/B, aunque overall sea passed. No es un alias de overall. |
| Resumen del par / acceptance | pending, passed o failed; obligatorio con referencias de A/B y revisión/hashes. | Único resultado técnico consolidado de aceptación; se determina por la tabla de elegibilidad y agregación inferior. No sustituye aprobación humana del plan ni del checklist. |

El resumen del par conserva los valores local/overall de cada ejecución referenciada;
no los sustituye por un único local/overall sin identificar la preparación. Los reportes
individuales ya emitidos no se reescriben retrospectivamente para cambiar su acceptance:
el resumen separado contiene el resultado del par y las referencias correspondientes.

### Reglas deterministas

1. Para local y overall se aplica prioridad de evidencia: **failed > pending > passed**.
   Si cualquier control obligatorio del conjunto agregado falla, el resultado es failed,
   aunque otros estén pendientes. Sin fallos, si falta un control o evidencia, es pending.
   Solo todos los controles obligatorios con evidencia satisfactoria permiten passed.
2. Los controles fuera del subconjunto local, incluida UI, siguen perteneciendo al
   conjunto completo y quedan pending en una ejecución local; nunca se eliminan o se
   convierten en passed por un skip. Por eso local passed implica overall pending
   cuando no hay fallos completos conocidos; local failed implica overall failed.
3. Un prerrequisito de navegador ausente deja UI pending, no failed automáticamente.
   Si además existe un fallo real de configuración, HTTP, proceso o limpieza, overall
   es failed y el motivo pendiente de UI también se conserva. No se sobrescribe el fallo.
4. Un fallo de limpieza impide passed en el conjunto al que pertenece: procesos locales
   afectan local y overall; navegador/procesos exclusivos del grupo completo afectan
   overall. Interrupción sin resultado concluyente deja controles pending y nunca éxito;
   un incumplimiento observado permanece failed.
5. verify:local retorna 0 solo por local passed; en ese caso overall y acceptance siguen
   pending. verify:bootstrap retorna 0 solo por overall passed, con scope complete;
   su acceptance individual también sigue pending. En ambos comandos una condición
   distinta de éxito devuelve 1, acompañada del estado y causa, sin confundirlo con HTTP.

### Combinaciones ilustrativas por ejecución

Ejemplos de estados futuros, no pruebas realizadas:

| Situación | scope | local | overall | acceptance individual | Salida del comando |
|---|---|---|---|---|---|
| Grupo local satisfactorio, UI sin ejecutar | local | passed | pending | pending | 0, solo éxito local. |
| Fallo local y UI pendiente | local | failed | failed | pending | 1. |
| Grupo completo sin navegador, detenido antes de controles locales | complete | pending | pending | pending | 1 por prerrequisito. |
| Grupo completo con locales satisfactorios pero UI pendiente | complete | passed | pending | pending | 1, no éxito completo. |
| Grupo completo con locales satisfactorios y fallo real UI | complete | passed | failed | pending | 1. |
| Todos los controles completos y limpieza satisfactorios | complete | passed | passed | pending | 0, éxito de esa ejecución; aún falta consolidar A/B. |

Las combinaciones con overall passed y scope local, o con algún control obligatorio
failed/pending agregado, son inválidas. También es inválido un acceptance passed decidido
por un único reporte o por dos reportes solo locales.

### Elegibilidad y aceptación del par A/B

| Situación del resumen | acceptance | Regla |
|---|---|---|
| Faltan referencias A/B, solo hay ámbito local, revisiones distintas o independencia sin acreditar | pending | No existe un par completo comparable; registrar el defecto y preservar todos los fallos observados en sus reportes. No afirmar aceptación. |
| Par candidato de ámbito complete, revisión común e independencia acreditadas; algún overall failed | failed | Prevalece el fallo aunque el otro reporte o algunos controles estén pendientes. |
| Par comparable sin fallos observados, pero algún overall pending o evidencia obligatoria ausente | pending | No ocultar los motivos; no hay aceptación completa. |
| Par comparable con ambos overall passed y toda la evidencia obligatoria completa | passed | Permite informar satisfacción técnica de los criterios aplicables a F00; no aprueba por sí solo plan, checklist, gastos o funcionalidades posteriores. |

Un intento fallido no se borra al repetir. Cada intento tiene runId propio; el resumen
identifica qué dos preparaciones completas se proponen para aceptación y conserva los
antecedentes fallidos. Un cambio de código/lockfile exige A/B de una misma revisión nueva;
no se combinan resultados entre revisiones o un control UI aislado con ejecuciones locales.
Sin ejecución real todos los resultados runtime siguen pendientes. La corrección de
estos documentos no crea reportes ni acredita ninguno de los ejemplos.

## Límite de datos futuros

No se crean tablas usuarios, usuario_farmacia, inventario, movimientos, reservas,
Outbox o métricas IA. El modelo pooled futuro conservará farmacia_id, pertenencia,
propiedad del cliente, contexto tenant local a la transacción y proyección pública segura.
Notificaciones reconocerá eventos idempotentes en una funcionalidad posterior;
su salud técnica de F00 no acredita ese contrato.

La futura disponibilidad digital y las transiciones terminales de reservas permanecen
en la Constitución y el histórico. Este modelo no los sustituye ni introduce otro ciclo
de vida para reservas usando los estados técnicos de procesos.
