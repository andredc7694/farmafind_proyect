# Implementation Plan: F02.5 — Incorporación y administración de farmacias

**Branch**: `feat/f025-incorporacion-farmacias` | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)
**Status**: plan aprobado expresamente el 2026-11-19 para implementación TEST/DEMO aislada; ejecución y aceptación final pendientes. Ver [approval.md](approval.md).
**Input**: DEC-01–03 aprobadas con límites TEST/DEMO; Documento Maestro v3.1 §A4 bis como fuente específica de alcance, Constitution 1.3.0 y maestro v3.0 vigentes.

## Summary

Añadir al módulo Farmacias existente una solicitud de incorporación y una revisión de plataforma, separadas del alta de cuenta F01. Una aprobación autorizada en TEST activa un establecimiento, asigna una única membresía DUENO al solicitante y registra auditoría/evento en una transacción idempotente. El portal reutiliza identidad, inventario CSV/XLSX, búsqueda pública, reservas, notificaciones locales, ubicación y diseño F08. Ninguna operación de plataforma adquiere acceso general a datos privados de tenant. No se ejecuta provisión ni activación persistente/productiva.

## Technical Context

**Language/Version**: React + Vite + JavaScript/JSX en frontend; Node.js 24.17.0 de referencia, Express + TypeScript en backend; npm 11.13.0 de referencia.
**Primary Dependencies**: npm workspaces existentes, `pg`, Redis, F01 sesiones opacas/CSRF, F02 parser CSV/XLSX, F05 consumidor local; no se presupone dependencia nueva.
**Storage**: PostgreSQL fuente oficial, esquema F02.5 nuevo solo en base TEST efímera; archivos sintéticos opcionales en almacenamiento privado local TEST; Redis solo caché pública.
**Testing**: Vitest, Supertest, PostgreSQL RLS real, Redis/fallback, Playwright en entorno oficialmente compatible; pruebas manuales de cinco farmacias en navegador.
**Target Platform**: desarrollo Windows 10; pruebas de navegador en entorno compatible ya utilizado por el proyecto; ninguna migración sobre `farmafind_f01_test`.
**Project Type**: extensión del monolito modular y de la única SPA React; servicio Notificaciones independiente.
**Performance Goals**: aprobación concurrente de una solicitud produce una sola activación; importación mantiene límites F02 de 5 MiB/5 000 filas; comparar tiempos con línea base antes de fijar nuevos SLO.
**Constraints**: no AWS, Gemini, proveedor externo ni credenciales reales; BOOT-01/GLO-01 solo TEST efímero; no tocar main, Constitution o aceptaciones históricas.
**Scale/Scope**: cinco farmacias ficticias demostrables desde navegador; 28 requisitos de spec y 28 códigos fuente F025-RF de v3.1 trazados; operación productiva diferida.

## Constitution Check

| Principio | Resultado y puerta |
|---|---|
| I, XVII, XVIII — SDD, una funcionalidad y aprobación | F02.5 única fase SDD activa; F08 espera aceptación humana. Spec/plan se presentan para aprobación antes de código. |
| II–VI — módulos, stack y Clean Architecture | Farmacias conserva alta/estado; F01 identidad y F02 inventario permanecen separados. React/JSX y Express/TS existentes. |
| VII–VIII — PostgreSQL y RLS | PostgreSQL conserva autoridad; solicitudes previas al tenant se aíslan por solicitante/revisor, datos activados por farmacia. Runtime sin SUPERUSER/BYPASSRLS. |
| IX–X — Redis, Outbox, Notificaciones | Invalidación posterior al commit; un nuevo evento F02.5 mínimo se procesa por el servicio independiente. El Outbox F04 no se reutiliza físicamente porque exige `reserva_id`. |
| XI–XII — AWS | Ningún recurso ni cambio de despliegue. |
| XIII–XV — pruebas, rúbrica, historia | API, RLS, concurrencia, E2E y regresión; trazabilidad v3.1 y 16 criterios sin inventar resultados. **Puerta normativa resuelta:** Constitution 1.3.0 inserta F02.5 entre F08 y F09; ADR-ROADMAP-V3-001 conserva la secuencia anterior como antecedente. |
| XVI, XIX–XX — main, IA, privacidad | Rama propia; Gemini inactivo; datos sintéticos y secretos fuera de Git. |

**Gate inicial resuelto**: la aprobación expresa del 2026-11-19 ratificó Constitution 1.3.0 y aprobó spec/plan TEST/DEMO; véase [approval.md](approval.md). V3.1 no es referencia principal ratificada ni modificó el roadmap por sí mismo. DEC-02 resuelve de forma expresa y limitada la discrepancia del capítulo 27 sobre membresías de terceros. La ejecución de SQL aún exige revisión humana específica conforme a T006–T014.

## Arquitectura y orden de construcción

1. **Fundación TEST**: preservar la base persistente; verificar que las migraciones F01–F07 y roles existentes están presentes en una nueva base efímera. Añadir migraciones F02.5 únicamente allí, con chequeos fail-closed del nombre de base, roles y RLS. Revisar SQL antes de ejecutarlo.
2. **Dominio Farmacias**: entidades Solicitud, Revisión y Perfil aprobado; máquina de estados y política de duplicados; ninguna dependencia del dominio hacia Express, `pg` o Redis.
3. **Aplicación**: casos de uso `CreateDraft`, `SubmitApplication`, `ListMyApplications`, `ResubmitObserved`, `ReviewApplication`, `ActivatePharmacy`; puertos para repositorio, permisos, activación, auditoría y evento. Una misma unidad de trabajo abarca decisión, farmacia, dueño y Outbox.
4. **Infraestructura y seguridad**: repositorios PostgreSQL y políticas RLS; usar `PgIdentityUnitOfWork.runWithClient` para verificar sesión en la misma transacción y `SET LOCAL` del actor. La creación de farmacia y DUENO pasa por una función/rol de activación estrecho, `NOLOGIN NOSUPERUSER NOBYPASSRLS`, con políticas explícitas; nunca por GRANT general de escritura a `f01_runtime`.
5. **Presentación**: routers `/api/v1/pharmacy-applications` y `/api/v1/platform/pharmacy-applications`, con contratos [OpenAPI](contracts/f025.openapi.yaml). Misma SPA en `/farmacias/solicitar`, `/farmacias/mis-solicitudes` y `/admin/farmacias/solicitudes`; rutas finales requieren revisión de contratos, no se activan por el plan.
6. **Integración**: extender la composición local `backend/src/identity-app.ts` solo para TEST F02.5; F02 importación y F03 búsqueda permanecen sus autoridades. Incorporar evento mínimo F02.5 en Outbox propio y adaptador del consumidor F05, sin modificar la FK ni semántica de `f04.outbox_evento`.
7. **Verificación**: unitarias de transiciones/duplicados, API positiva/negativa, PostgreSQL Alfa/Beta, concurrencia, importación CSV/XLSX, Redis e invalidación, contratos, regresión F00–F08, Playwright y recorrido manual de cinco establecimientos. Solo marcar tareas con evidencia real.

## Seguridad y matriz de permisos

La [matriz](contracts/authorization-matrix.md) propone capacidades cerradas `F025_APPLICATION_READ`, `F025_APPLICATION_REVIEW`, `F025_DOCUMENT_READ`, `F025_APPLICATION_DECIDE` y `F025_PHARMACY_ACTIVATE`. Se almacenan en asignaciones F02.5 independientes del catálogo GLO-01 y se conceden al revisor TEST únicamente por un expediente offline explícito y auditable después de BOOT-01 TEST; no hay endpoint de concesión ni concesión automática por rol. `F025_PHARMACY_ACTIVATE` se verifica además de `F025_APPLICATION_DECIDE`. La provisión persistente/productiva no está diseñada como operación ejecutable.

La solicitud aún no tiene `farmacia_id`: su RLS protege por `solicitante_id` o por capacidad F02.5 verificada con sesión vigente, nunca por un tenant inventado. Después de aprobar, `f01.usuario_farmacia`, F02/F04/F07 y nuevas tablas privadas se aíslan por farmacia con políticas `USING`/`WITH CHECK` y `FORCE RLS` donde proceda. El revisor no recibe membresía de la farmacia ni consulta inventario. Las funciones definidoras deben fijar `search_path`, verificar actor/sesión/capacidad y limitar escritura a la solicitud aprobada; roles de ejecución no pueden omitir RLS.

## Modelo, contratos y datos

- [data-model.md](data-model.md): tablas nuevas y relaciones con `f01.farmacia_referencia`, `f01.usuario_farmacia`, `f03.farmacia_publica`; estados y unicidad de aprobación.
- [contracts/f025.openapi.yaml](contracts/f025.openapi.yaml): endpoints propuestos, respuestas, CSRF, `Idempotency-Key`, conflictos y cuerpos mínimos sin datos privados.
- [contracts/authorization-matrix.md](contracts/authorization-matrix.md): permisos y denegaciones; [contracts/rls-strategy.md](contracts/rls-strategy.md): políticas y pruebas RLS.
- [research.md](research.md): diferencias comprobadas del código y fuentes; [traceability.md](traceability.md): F025-RF01–28, F025-AC01–12 y 16 criterios docentes; [quickstart.md](quickstart.md): guía de validación futura, no comandos que escriban hoy.

## Dependencias y puertas de implementación

Primero autorización TEST explícita de permisos F02.5, después solicitudes, revisión, activación y portal. Las historias de importación/público pueden aprovechar F02/F03 mientras se prepara el flujo, pero no se declaran F02.5 terminadas sin cinco farmacias. La carga de documentos opcionales se limita a archivos sintéticos; requisitos legales definitivos y suspensión/desactivación quedan bloqueados para decisión aparte. El uso de v3.1 como nuevo maestro principal requeriría ratificación documental/constitucional; este plan no la realiza.

## Project Structure

### Documentation (this feature)

```text
specs/012-f025-incorporacion-farmacias/
  spec.md  plan.md  research.md  data-model.md  quickstart.md  traceability.md
  contracts/f025.openapi.yaml  contracts/authorization-matrix.md
  contracts/rls-strategy.md  tasks.md  checklists/requirements.md
docs/adr/ADR-F025-001-incorporacion-farmacias-propuesta.md
```

### Source Code (planned, not created)

```text
backend/src/modules/farmacias/domain/                # solicitud y transiciones
backend/src/modules/farmacias/application/           # casos de uso y puertos
backend/src/modules/farmacias/infrastructure/        # repositorios, UoW, Outbox
backend/src/modules/farmacias/presentation/          # routers HTTP F02.5
backend/migrations/f025/                             # migraciones TEST revisadas
backend/src/identity-app.ts                          # composición TEST integrada
backend/tests/pharmacies/                            # unitarias, API, RLS, concurrencia
frontend/src/pharmacies/                             # solicitud, seguimiento, portal, panel
frontend/src/app/                                    # rutas y navegación
frontend/tests/pharmacies/                           # componentes y E2E
```

**Structure Decision**: se extiende el módulo Farmacias y la SPA existentes, sin nuevo servicio ni aplicación. F01 conserva identidad y membresías; F02 inventario, F03 proyección pública, F04 reservas y F05 entrega local.

## Complexity Tracking

| Restricción de diseño | Justificación | Alternativa descartada |
|---|---|---|
| Tabla/capacidad F02.5 separada de GLO-01 | GLO-01 tiene catálogo cerrado y no concede Farmacias; autorización explícita por módulo. | Añadir acceso implícito a todo administrador global violaría el mínimo privilegio. |
| Outbox F02.5 propio con consumidor F05 | `f04.outbox_evento` exige `reserva_id` y `farmacia_id`; una solicitud aún no tiene reserva ni tenant. | Insertar eventos falsos en F04 rompería su contrato. |
| Función estrecha de activación con rol específico | `f01_runtime` no tiene INSERT general en Farmacias ni DUENO; DEC-02 exige una excepción acotada. | Otorgar INSERT amplio o BYPASSRLS debilitaría F01. |

**Gate posterior al diseño original:** DEC-01–03 siguen limitadas a TEST. La especificación, el plan y la inserción normativa F02.5 fueron aprobados el 2026-11-19 y se registran en [approval.md](approval.md). Las migraciones y pruebas ejecutadas posteriormente constan en [evidence.md](evidence.md); cada operación debe cumplir sus tareas y controles antes de declararse verificada.

## Adenda técnica T031/T036–T037 y regresión F06.1 — aprobada 2026-11-21

**Estado:** el responsable aprobó expresamente esta revisión de `spec.md` y `plan.md` el 2026-11-21, solo para T031, T036–T037 y fixtures de integración F06.1. La aprobación SDD queda registrada en [approval.md](approval.md); no autoriza implementar ni ejecutar migraciones o pruebas en esta ejecución. El plan original del 2026-11-19 conserva su aprobación para el alcance previo. El detalle verificable y la matriz de impacto están en [technical-unblock-proposal.md](technical-unblock-proposal.md); esta adenda no altera F04/F05 ni F06.1 históricos.

1. **T031, mismo servicio F05:** conservar `f04.outbox_evento` y `/internal/v1/events`; publicar los cuatro tipos de `f025.outbox_evento` por adaptador propio del publicador existente hacia una ruta interna versionada para solicitudes. Usar firma HMAC, payload cerrado sin datos personales, recepción durable por destinatario usuario, huella de contenido, unicidad por ID y clave lógica, arrendamiento de reclamo, backoff y fallo terminal auditable. El evento se registra en la transacción F02.5; la entrega sucede después del commit. F05 indisponible no revierte ni muta la solicitud. Migraciones **aditivas TEST**: token de reclamo y estado terminal en Outbox F02.5, tablas de recepción/entrega local por usuario con RLS y permisos mínimos; retención configurable de 30 días en TEST para recepciones y entregas locales F02.5, con limpieza acotada a esos registros y trazable, sin purgar Outbox F04 ni auditoría. El contrato y esta retención están aprobados para implementación posterior.
2. **T036–T037, módulo Farmacias:** añadir caso de uso de lectura/edición y router `GET/PATCH /api/v1/farmacias/{farmaciaId}/perfil`, coherente con las rutas `/farmacias/:farmaciaId/ubicacion/...` existentes; no duplicar `/me/memberships` ni MEJ-019. GET devuelve el perfil privado del establecimiento al DUENO con `pharmacy.profile.read`; PATCH solo `contacto` al DUENO con **ambas** delegaciones `read/write`, sesión, CSRF, tenant autorizado y versión esperada. Denegar por defecto a trabajador y administrador general sin membresía y grants propios. Usar unidad de trabajo F01 con `SET LOCAL` y `FORCE RLS`. Sustituir la política SELECT actual por otra que exija `read` en PostgreSQL; una política adicional permisiva sería insuficiente. Añadir política `UPDATE USING/WITH CHECK` con `write` y función SQL acotada para contacto/versión/fecha/auditoría, sin `UPDATE` general para runtime. Las delegaciones TEST de dueños ya activados exigen concesión específica y auditada, sin tocar persistente. La actualización de dirección/ubicación sigue pendiente de un flujo de revisión, sin publicación F03/F07 por PATCH.
3. **F06.1, solo infraestructura de pruebas:** cambiar `scripts/f061/check.mjs` y `conversation-real-fixture.ts` para aceptar exclusivamente una madre F06.1 TEST identificada por host/puerto, nombre allowlisted y marcador de propiedad, sin construir URL de `farmafind_f01_test`. Migrar y cargar únicamente bases hijas creadas por la ejecución. Cerrar conexiones y limpiar exclusivamente hijos/roles propios, comprobando identidad y evitando `CASCADE`; no tocar madre, DEMO, persistente, volúmenes ni contenedores. Redis TEST utiliza namespace exclusivo. Sin base madre verificable, ambas suites quedan pendientes.

**Orden SDD y pruebas posteriores:** aprobación expresa de esta adenda de spec/plan y de los contratos/permisos/retención (registrada) → preparar tareas y analizar consistencia documental → en la siguiente ejecución autorizada, revisar migraciones y ajustar OpenAPI → implementar en TEST → unitarias/HTTP/SQL Alfa–Beta, reintentos/idempotencia, pool y revocación → regresión F04/F05/F06.1 → E2E y demostración humana. T063 y F025-RF23 no se desbloquean por esta adenda. No se ejecuta ninguna etapa de implementación en esta revisión.
