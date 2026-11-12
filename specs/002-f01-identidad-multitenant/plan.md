# Implementation Plan: F01 — Identidad y seguridad multi-tenant

**Branch**: `feat/f01-identidad-multitenant` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)
**Status**: Plan aprobado para F01, con implementación local parcial verificada. EXC-01/ROL-01 autorizan y limitan la concesión/revocación local de `TRABAJADOR`, ya probada con PostgreSQL ficticio. GLO-01 mantiene bloqueadas las concesiones globales y BOOT-01 autoriza únicamente el diseño del alta inicial; Playwright y aceptación F01 pendientes. Los estados de planificación originales de este documento se contrastan con la evidencia vigente en [implementation-evidence.md](implementation-evidence.md).
**Constitution**: v1.1.0 ratificada. **Base**: F00 local en `bb972e9`, con aceptación Playwright/A-B final pendiente.

## Summary

Diseñar el módulo **Usuarios y roles** del monolito modular para registro de clientes, autenticación propia por correo/contraseña, sesión revocable, roles, permisos y membresías usuario–farmacia. La API debe verificar identidad y autorización sobre cada recurso; PostgreSQL pooled y RLS protegen filas privadas. El frontend React muestra sesión y farmacia activa sin asumir autoridad. La administración delegada se limita al ámbito validado. No se implementan otros módulos ni servicios nuevos.

Decisiones **aprobadas**: alcance F01 y sus 20 FR/siete SC, stack F00, Clean Architecture, PostgreSQL oficial, RLS pooled, no autoelevación, permisos de plataforma explícitos, auditoría, datos ficticios y arquitectura AWS futura. También se aprobaron la matriz de concesión restringida y `argon2` como primera opción para Argon2id, sujeta a comprobación local. Los parámetros de abuso US1 constan en ABUSE-01. La decisión nueva EXC-01 conserva la contradicción literal del capítulo 27 y permite una excepción controlada solo para trabajadores de la farmacia propia; ROL-01 limita el rol concedible/revocable a `TRABAJADOR`. GLO-01 no permite concesiones globales en este incremento. BOOT-01 permite redactar un procedimiento separado y auditado, sin alta inicial real. [authorization-decisions.md](authorization-decisions.md) distingue cada puerta; ningún contrato adicional se infiere automáticamente.

## Technical Context

**Language/Version**: Node.js 24.17.0, Express 5.2.1 y TypeScript 5.9.3 en backend; React 19.2.7, Vite 7.3.8 y JavaScript/JSX en frontend; npm 11.13.0 workspaces y lockfile raíz. Son versiones observadas en F00, sujetas a revisión de seguridad al instalar futuras dependencias.
**Primary Dependencies**: reutilizar Express, React, Vitest 4.1.12 y Supertest 7.1.4. `pg@8.23.1` y `argon2@0.45.2` quedaron fijados en el backend/lockfile durante T003. La prueba aislada T002 verificó instalación, hash y verificación Argon2id en este Windows 10 x64/Node.js 24.17.0; no acredita soporte oficial de Windows 10. La autenticación local posterior tiene pruebas registradas. La auditoría npm reportó 0 vulnerabilidades el 2026-11-12. Playwright 1.65.0 permanece requisito de navegador en entorno oficialmente compatible, no se declara soportado en Windows 10.
**Storage**: PostgreSQL oficial, tablas globales de identidad/sesión y tablas privadas de membresía/auditoría sujetas a políticas explícitas. No Redis para sesiones ni caché de identidad. Sin SQLite como sustituto de pruebas RLS.
**Testing**: unitarias de dominio/autorización/contraseñas/sesiones con Vitest; contratos HTTP con Supertest; integración real PostgreSQL para migraciones, roles, RLS, transacciones y pool; seguridad negativa/positiva AC04; E2E React/Playwright en SO oficialmente compatible cuando esté disponible; verificación de logs/secretos. Carga ligera para abuso/concurrencia de autorización según riesgo; k6 de producto queda en otra fase.
**Target Platform**: desarrollo Windows 10, PowerShell 5.1, `npm.cmd`; PostgreSQL de pruebas local aislado mediante Docker Compose autorizado y verificado. Destino AWS conservado: SPA S3 privado + CloudFront y API Lightsail, sin recursos creados.
**Project Type**: aplicación web en npm workspaces; monolito modular API más servicio Notificaciones ya independiente.
**Performance Goals**: no hay SLA F01 aprobado. Registrar latencias de autenticación/autorización y costo de hashing para fijar umbrales tras medición; no inventar p95 cumplido.
**Constraints**: sin credenciales personales reales; no secretos en `VITE_*`, Git, logs o evidencias; validación backend + RLS; no confiar en `farmacia_id` del cliente; sin superusuario/BYPASSRLS en rol de negocio; sin cambios a F00, main o módulos de negocio.
**Scale/Scope**: cuatro historias, 20 FR, siete SC; casos con al menos dos farmacias y usuarios de cero/una/varias membresías. No se atribuye volumen de producción no medido.

## Constitution Check

*Gate inicial y posterior al diseño: sin violaciones propuestas; pendientes explícitos no equivalen a conformidad probada.*

| Principios | Comprobación de diseño | Estado |
|---|---|---|
| I, XVII, XVIII | Solo F01; spec y plan aprobados. `tasks.md` se generó como borrador documental antes de aprobar el plan; requiere revalidación tras esa aprobación. | Aprobación registrada; revalidación de tareas pendiente antes de código. |
| II–VI | Usuarios y roles dentro de siete módulos; React/JSX, Express/TS, capas Clean Architecture; Notificaciones no absorbida. | Pasa documentalmente. |
| VII–VIII | PostgreSQL oficial, modelo pooled, membresías y RLS `USING`/`WITH CHECK`, contexto validado por transacción; sin bypass implícito. | Diseño definido; integración real pendiente. |
| IX–XII | Redis/Outbox/Notificaciones/AWS conservados para su alcance futuro; sin recursos, pago ni despliegue. | Pasa por exclusión de F01. |
| XIII–XIV | Pruebas unitarias/integración/E2E/seguridad según riesgo y matriz docente sin resultados inventados. | Diseño definido; ejecución pendiente. |
| XV–XVI, XIX–XX | HU/RF/AC/RC/DA/ADR históricos preservados, main intacta, datos sintéticos y cero IA clínica. RC04/ADR complementaria pendientes. | Pasa documentalmente. |

**Gate posterior a Phase 1**: [data-model.md](data-model.md) y [contracts/](contracts/) separan identidad global de filas por farmacia; el contrato API niega acceso por ID, RLS aplica fail-closed y la guía exige pruebas reales. No se propone excepción constitucional. `tasks.md` se revalidará frente al plan aprobado antes de ejecutar código; su creación anticipada no equivalía a cumplir el orden SDD de la Constitution. ABUSE-01 quedó aprobado después; las puertas de autorizaciones privilegiadas conservan sus decisiones pendientes.

## Architecture and Authorization Flow

El módulo `backend/src/modules/usuarios/` tendrá `domain` (entidades, estados y reglas sin Express/SQL), `application` (casos de uso, puertos de repositorio/sesión/auditoría, política de permisos), `infrastructure` (adaptadores PostgreSQL y hashing) y `presentation` (controladores, validación, DTO y contrato OpenAPI). La composición se ubica fuera del dominio. `Farmacias` conserva su módulo histórico: F01 almacena únicamente referencias mínimas de farmacia y estado para validar membresías; su gestión de negocio corresponde a otra funcionalidad. `Administración` conserva límites propios; no se crea microservicio de identidad.

Secuencia de una operación privada: validar sesión contra estado vigente → cargar actor/rol de plataforma → iniciar transacción con un cliente del pool → fijar identidad de actor verificada en esa transacción → consultar **solo membresías propias** mediante política RLS de lectura limitada al actor → validar farmacia activa, estado, rol, delegación, recurso y acción → fijar `app.farmacia_id` local a esa misma transacción → ejecutar repositorio protegido con RLS y restricciones → registrar auditoría mínima → commit/rollback → devolver conexión. Si falta contexto, permiso o política, denegar sin fila privada. Una comprobación solo por filtro Express o por el ID del cliente nunca basta.

La identidad y búsqueda de sesión son globales, anteriores a la selección de farmacia; requieren privilegios de BD restringidos a la autenticación y salidas mínimas. La política de membresías propias permite verificar pertenencia sin fijar un tenant no comprobado; no concede modificación ni lectura ajena. La mutación local autorizada por EXC-01/ROL-01 solo puede conceder o revocar `TRABAJADOR` a otra persona dentro de la farmacia validada, tras comprobar permiso explícito, membresía activa y recurso; debe auditarse y limitarse también por RLS. Las operaciones de administración global siguen prohibidas en este incremento por GLO-01; una futura operación requerirá rol/permiso transversal expresamente otorgado y política SQL específica, sin `USING true` genérico ni bypass del rol de aplicación. BOOT-01 permite solo diseñar el alta inicial; no se inventa una acción administrativa universal.

La aplicación usa parametrización y rechaza intentos de autoasignación. En cada cambio de permisos, invalida o rota las sesiones afectadas según política propuesta y revalida membresía en la siguiente operación; no confía en claims de rol persistidos en el navegador. La propiedad de recursos de cliente se comprueba aparte. Errores de unicidad/FK se traducen sin confirmar existencia de filas ajenas. Ver [research.md](research.md) para alternativas y riesgos.

## Data, Migrations and Security Design

Ver [data-model.md](data-model.md). Orden previsto: roles y privilegios mínimos → identidades/sesiones → referencia de farmacias ficticias para F01 → membresías, delegaciones y auditoría → políticas RLS `ENABLE` y `FORCE` según tabla → constraints, índices, grants y tests de rollback/reaplicación. `usuarios` es identidad global, no se etiqueta artificialmente como tenant; `usuario_farmacia` y registros privados sí llevan `farmacia_id`. Seed solo sintético de A/B, propietario y admin global de prueba; ningún rol privilegiado se crea por autorregistro. Migraciones pertenecen a una fase implementadora posterior y su ejecución requerirá base de pruebas autorizada.

Usar roles separados de propietario/migración, autenticación acotada y runtime de negocio no propietario, `NOSUPERUSER NOBYPASSRLS`. Diseñar políticas SELECT/INSERT/UPDATE/DELETE con `USING` y `WITH CHECK`; `WITH CHECK` rechaza cambiar `farmacia_id` a otro tenant. Restringir permisos de `TRUNCATE`, DDL y secuencias. Revisar consultas de política sobre otras tablas por carreras y errores indirectos de UNIQUE/FK; pruebas SQL directas y API deben coincidir. La conexión del pool se adquiere y libera dentro de `finally`, con `ROLLBACK` en error; `SET LOCAL` sin transacción explícita no es válido para este contrato.

## Session, Frontend and API Design

Argon2id con sal individual y revisión de parámetros OWASP es la opción de seguridad; el paquete `argon2` superó la comprobación local T002 y quedó fijado por T003, con adaptador de contraseñas F01 implementado y probado localmente. El diseño aprobado prevé sesión opaca aleatoria con huella almacenada en PostgreSQL, expiración de inactividad/absoluta y revocación inmediata. Cookie HttpOnly de host, `Secure` en HTTPS y SameSite ajustado a topología; CSRF/Origin para mutaciones. Solo para loopback HTTP de desarrollo se admite cookie sin `Secure`, con bandera de entorno estricta y prueba que impida usarla fuera de loopback. Los plazos iniciales del plan son 30 min de inactividad y 8 h absolutas, implementados y probados en F01 local; no se configuran en F00. Nunca `localStorage` para sesiones. Controles de intentos de login/registro y errores indistinguibles. ABUSE-01, aprobado el 2026-11-11 y registrado en authorization-decisions.md: login, cinco intentos fallidos por cuenta y por IP en ventana móvil de 15 minutos; registro, cinco intentos por IP en ventana móvil de 15 minutos; al exceder, HTTP 429 genérico con Retry-After, sin bloqueo permanente ni revelar existencia de cuentas. Implementación y pruebas locales registradas en implementation-evidence.md. Recuperación de cuenta no incluida.

El frontend React incorporará vistas de registro, acceso, sesión y selector de farmacia permitida, con estados de carga/denegación/expiración y accesibilidad básica. Pedirá al backend la identidad y membresías vigentes; nunca calcula permisos como autoridad. En desarrollo se propone proxy local de `/api` para mismo origen, sin secretos en bundle. En AWS, CloudFront/S3 y Lightsail requieren HTTPS, CORS explícito y revisión de dominio/cookie; si resultan sitios distintos, `SameSite=None; Secure` y CSRF reforzado requieren decisión de despliegue separada. No se crea DNS/CDN ahora.

Interfaces propuestas en [contracts/identity.openapi.yaml](contracts/identity.openapi.yaml) y [contracts/security.md](contracts/security.md): registro/login/logout/sesión, membresías propias y selección activa, gestión local autorizada. No se expone una ruta universal para otorgar permisos globales hasta aprobar la matriz específica. `GET /health` F00 permanece técnico y separado.

## Testing and Evidence Gates

1. **Estática y unitarias**: tipos/imports, reglas de dominio, roles, denegación por defecto, hash/verificación, expiración y revocación con reloj controlado, límites de entrada y cero dependencias SQL/Express en dominio.
2. **API**: Supertest para registro/login/logout/sesión, CSRF/Origin, cookies, errores 400/401/403/404/409/429 y DTO sin secretos; positivos equivalentes a cada rechazo. Contratos OpenAPI revisados.
3. **PostgreSQL real**: migraciones desde base limpia, grants, no BYPASSRLS, `ENABLE/FORCE`, `USING/WITH CHECK`; SQL directo como rol app y API sobre A/B. Probar SELECT/INSERT/UPDATE/DELETE, sin contexto, ID manipulado, membresía revocada/inactiva, autoelevación, transacción fallida, conexión reutilizada, concurrencia A/B y errores indirectos FK/UNIQUE.
4. **Frontend/E2E**: recorrido de registro, login, selector, denegación B, cierre/expiración, teclado y mensajes; Playwright solo en sistema oficialmente compatible. Windows 10 permite desarrollar y ejecutar controles API/BD si PostgreSQL está disponible, pero no acredita E2E de navegador por sí solo.
5. **Seguridad y carga acotada**: inspección de evidencias/logs por secretos, pruebas de abuso/limitación y concurrencia de permisos/sesiones. Definir volumen de carga al planificar tareas; no atribuir rendimiento no medido. Evidencias por comando, versión, revisión, entorno, esperado/obtenido y errores.

La aceptación F01 exige los siete SC con evidencia real, incluida AC04 al 100 %, y revisión humana. Un mock de BD o filtro API no acredita RLS. La aceptación pendiente de F00 conserva su propio estado y no se fusiona con F01.

| Requisitos F01 | Entregable diseñado | Verificación futura / criterio |
|---|---|---|
| FR001–004 | Registro, login/logout, sesión y perfil propio; API/React. | Unitarias y contratos positivos/negativos; SC001–002. |
| FR005–011 | Identidad ≠ rol ≠ membresía ≠ recurso; selector y gestión delegada. | Matriz A/B, autoelevación y revocación; SC003–004, SC006. |
| FR012–014 | DTO públicos/privados, secreto protegido y auditoría. | Inspección de respuestas/logs, CSRF/abuso y correlación; SC002, SC005–006. |
| FR015–017 | Modelo PostgreSQL pooled, constraints, grants, contexto local y RLS. | Migración + SQL directo con rol app + pool/concurrencia; SC003–004. |
| FR018–020 | Batería de seguridad, contrato API y exclusión de otros módulos. | Evidencia trazable de siete SC, AC04 y revisión de alcance; SC004–007. |

## Project Structure

### Documentation (this feature)

```text
specs/002-f01-identidad-multitenant/
  spec.md                     # aprobada
  plan.md                     # este diseño propuesto
  research.md                 # decisiones, alternativas y fuentes
  data-model.md               # entidades, constraints y RLS
  quickstart.md               # guía de validación futura
  contracts/identity.openapi.yaml
  contracts/security.md
  checklists/requirements.md  # calidad de spec, no ejecución
  tasks.md                    # borrador posterior de speckit-tasks; revalidación pendiente tras aprobar el plan
```

### Source Code (repository root; rutas propuestas, sin crearlas ahora)

```text
backend/src/
  bootstrap/health.ts          # F00 existente
  modules/
    README.md                  # inventario de siete módulos F00
    usuarios/
      domain/                  # reglas y entidades independientes
      application/             # casos de uso, puertos y permisos
      infrastructure/          # repositorios PostgreSQL, hashing, sesión
      presentation/            # HTTP, validación y DTO
  composition/                 # cableado del módulo, sin lógica de dominio
backend/tests/identity/        # unitarias, HTTP, seguridad y RLS
frontend/src/
  Bootstrap.jsx               # F00 existente; preservar hasta transición aprobada
  identity/                    # registro, acceso, sesión y selector
frontend/tests/identity/       # UI cuando entorno compatible
notifications/                # proceso F00 independiente, sin cambios F01
```

**Structure Decision**: extender los workspaces F00, sin añadir microservicios ni alterar sus controles. Las rutas son propuesta de implementación futura; no existe aún el módulo F01.

## Traceability to the 16 Teaching Criteria

| Criterio | Aporte planificado de F01 | Estado real |
|---|---|---|
| 1 Problema y requerimientos | FR001–020, actores y fuentes históricas. | Diseño, evidencia futura. |
| 2 Análisis y diseño | Entidades, membresías, estados, matriz de acceso. | Diseño, revisión pendiente. |
| 3 Arquitectura baja/alta | Módulo Clean Architecture, dos procesos conservados, RLS pooled. | Diseño, sin despliegue. |
| 4 SDD | Spec, plan y tareas aprobados; trazabilidad del incremento F01. | Evidencia local registrada; aceptación final pendiente. |
| 5 Unitarias e integración | Auth/roles/API y PostgreSQL RLS real. | Pruebas locales ejecutadas; ver implementation-evidence.md. |
| 6 E2E | Registro, sesión, selector y denegación cruzada. | Playwright pendiente de entorno compatible. |
| 7 UI/UX | Flujos React accesibles de identidad y farmacia activa. | UI local implementada; Playwright pendiente. |
| 8 Escalabilidad front/backend | Sesiones compartidas en PostgreSQL y API sin estado local exclusivo. | Sin medición ni réplicas. |
| 9 Escalabilidad BD | Índices, pool y pruebas de fuga de contexto. | Sin EXPLAIN ni carga real. |
| 10 DNS/CDN | Compatibilidad de cookie/CORS con CloudFront/Lightsail. | DNS/CDN fuera F01. |
| 11 Caché | Redis reservado para búsquedas, no sesiones F01. | Sin caché F01. |
| 12 CI/CD | Checks locales reutilizables, integración DB propuesta. | Sin workflow nuevo ni ejecución remota. |
| 13 Carga k6 | Riesgos de abuso/concurrencia identificados. | Ensayo k6 global posterior. |
| 14 Código/BD en GitHub | Migraciones y pruebas sintéticas versionables en fase autorizada. | Incremento local preparado para versionar; no acredita evaluación docente. |
| 15 Informe final | Matriz de evidencia por revisión, comandos y resultados. | Informe final posterior. |
| 16 Presentación | Explicar identidad, autorización y segunda barrera RLS con pruebas A/B. | Defensa posterior. |

La rúbrica no asigna puntajes; esta matriz no declara ninguno cumplido. Trazabilidad detallada FR→escenario→prueba se completará en tareas sin alterar HU01–HU06, RF01–RF13, AC01–AC09, RC01–RC11, DA01–DA09 ni ADR-01–12.

## Risks and Approval Boundaries

| Riesgo | Mitigación prevista / puerta de aprobación |
|---|---|
| Política RLS permisiva, rol propietario o fuga de pool | Políticas por acción, grants mínimos, `FORCE`, pruebas SQL directas y rollback/concurrencia antes de aceptación. ADR complementaria de RLS pendiente. |
| Ciclo identidad → membresía → tenant | Separar lookup global restringido y lectura RLS de membresías propias; jamás fijar tenant desde parámetro sin verificar. Revisar diseño SQL en plan aprobado y pruebas. |
| Autoelevación o administración global excesiva | Denegar por defecto y comprobar objetivo distinto, farmacia propia y permiso local; GLO-01 prohíbe toda concesión global operativa en este incremento. |
| Discrepancia del maestro capítulo 27 sobre membresías de terceros | Mantener la frase histórica sin reescribirla y registrar EXC-01 ratificada el 2026-11-12 como excepción nueva y limitada. ROL-01 solo permite `TRABAJADOR`; BOOT-01 permite diseñar sin ejecutar; GLO-01 mantiene bloqueadas las concesiones globales. |
| Robo/fijación de sesión, CSRF, fuerza bruta | Token opaco revocable, cookie protegida, rotación, CSRF/Origin, throttling y auditoría. `argon2` superó T002 y quedó fijado; parámetros ABUSE-01 aprobados y pruebas locales registradas. |
| Incompatibilidad Windows 10 con librería/Playwright/PostgreSQL | Revisar paquetes antes de instalación; separar controles API/BD locales de E2E en entorno compatible; Docker Compose local autorizado y utilizado para PostgreSQL F01. |
| Dominio AWS distinto para frontend/API | Revisar cookies, CORS y CSRF según topología real antes de despliegue; no crear recursos en esta fase. |

## Complexity Tracking

No se solicitan excepciones a la Constitución. EXC-01 es una discrepancia con la frase histórica del maestro, no una excepción constitucional, y quedó ratificada de manera limitada el 2026-11-12. La implementación y las pruebas locales se acreditan únicamente con los resultados de implementation-evidence.md; no se acreditan aceptación completa, gastos AWS ni despliegues.
