# F02.5 — Trazabilidad documental propuesta

**Estado:** diseño aprobado para TEST/DEMO, con pruebas parciales registradas en [evidence.md](evidence.md) y [acceptance.md](acceptance.md), **sin aceptación final**. Maestro v3.1 §A4 bis aporta el alcance específico; la adopción documental de v3.2 no ratifica Constitution 1.4.0. Los códigos F025-RF/AC son del anexo v3.1 y no renombran FR/SC de [spec.md](spec.md). Las etiquetas «Planificado TEST» y «Pendiente» de las tablas indican que el criterio completo no está aceptado; no niegan las pruebas parciales actuales.

### Adenda de trazabilidad aprobada para diseño SDD el 2026-11-21

| Pendiente | Historia / requisito / éxito | Contrato y prueba previstos | Puerta actual |
|---|---|---|---|
| T031 | US2; F025-FR-008/017/019; F025-SC-004/008; F025-RF21, F025-AC04/11 | Evento interno mínimo F02.5 → F05; cuatro tipos, HMAC, recepción por usuario, deduplicación, reintentos, fallo F05 sin mutación de solicitud; regresión F04/F05 y ausencia de PII. | Diseño SDD y retención configurable 30 días TEST aprobados; implementación y pruebas pendientes. |
| T036 | US3; F025-FR-010/011/013; F025-SC-002; F025-RF14/17, F025-AC05/06/10 | GET del perfil privado, capacidad tenant explícita, HTTP/SQL Alfa–Beta, miembro revocado y administrador global sin membresía. | Diseño SDD aprobado; implementación y pruebas pendientes. |
| T037 | US3; F025-FR-010/011/013/019/020; F025-SC-002/008; F025-RF14/17, F025-AC06/10 | PATCH solo `contacto` con versión, CSRF, auditoría, `FORCE RLS`, `USING/WITH CHECK`, 409 concurrente y pool Alfa→Beta. | Diseño SDD aprobado; implementación y pruebas pendientes. |
| T064 y regresión F06.1 | F061-FR-010/014/020/023/024; F061-SC-004/005/009; F025 T050/T058/T059 | Dos suites PostgreSQL/Redis reales en hijos efímeros F06.1, aislamiento y fallback sin tocar persistente/DEMO. | Diseño SDD aprobado; fixture, ejecución y evidencia pendientes. |

Esta adenda no marca tareas ni criterios como verificados. El diseño completo está en [technical-unblock-proposal.md](technical-unblock-proposal.md); T063 y F025-RF23 conservan sus bloqueos.

## Requisitos v3.1 → especificación F02.5

| Código maestro propuesto | Especificación | Estado |
|---|---|---|
| F025-RF01 | FR-001 | Planificado TEST |
| F025-RF02 | FR-016 | Planificado TEST |
| F025-RF03 | FR-002, FR-003 | Planificado TEST |
| F025-RF04 | FR-004 | Mínimos ficticios TEST; legal pendiente |
| F025-RF05 | FR-018 | Adjuntos opcionales TEST; documentación real pendiente |
| F025-RF06 | FR-023 | Planificado TEST |
| F025-RF07 | FR-005 | Planificado TEST |
| F025-RF08 | FR-006 | Planificado TEST |
| F025-RF09 | FR-007, FR-024 | DEC-01; catálogo GLO-01 no basta |
| F025-RF10 | FR-007, FR-019 | DEC-01; planificado TEST |
| F025-RF11 | FR-003, FR-008 | Planificado TEST |
| F025-RF12 | FR-008 | DEC-02; planificado TEST |
| F025-RF13 | FR-009 | BOOT-01/GLO-01 solo TEST |
| F025-RF14 | FR-010, FR-013 | Planificado TEST |
| F025-RF15 | FR-014 | CSV/XLSX ya existen en F02; reutilizar |
| F025-RF16 | FR-010, FR-014 | Planificado TEST |
| F025-RF17 | FR-011, FR-012 | Planificado TEST |
| F025-RF18 | FR-015 | Planificado TEST |
| F025-RF19 | FR-015 | Activación/invalidez TEST; desactivación bloqueada |
| F025-RF20 | FR-017 | Reutiliza F04 |
| F025-RF21 | FR-017 | Outbox F02.5 propuesto; F05 consume |
| F025-RF22 | FR-013 | Reutiliza F07 TEST; GEO persistente bloqueado |
| F025-RF23 | FR-026 | **Pendiente de autorización del procedimiento de suspensión** |
| F025-RF24 | FR-027 | Planificado TEST |
| F025-RF25 | FR-014 | Reutiliza F02/F08 |
| F025-RF26 | FR-021 | Demostración TEST pendiente |
| F025-RF27 | FR-019 | Planificado TEST |
| F025-RF28 | FR-028 | Verificación legal futura, no se afirma |

## Criterios v3.1 → historias y resultados esperados

| Código | Historia | FR / SC que lo verifican | Estado |
|---|---|---|---|
| F025-AC01 | US5 | FR-001, SC-006 | Pendiente |
| F025-AC02 | US1 | FR-002/003, SC-003 | Pendiente |
| F025-AC03 | US2 | FR-005/007/019, SC-008 | Pendiente |
| F025-AC04 | US2 | FR-008, SC-004 | Pendiente |
| F025-AC05 | US3/US4 | FR-013/014, SC-005 | Pendiente |
| F025-AC06 | US3 | FR-010/011/020, SC-002 | Pendiente |
| F025-AC07 | US2/US3 | FR-007/012, SC-003 | Pendiente |
| F025-AC08 | US5 | FR-015, SC-006 | Pendiente |
| F025-AC09 | US6 | FR-021, SC-001/005 | Pendiente |
| F025-AC10 | US3 | FR-010/020, SC-002 | Pendiente |
| F025-AC11 | US5 | FR-016/017, SC-007 | Pendiente |
| F025-AC12 | US1–US6 | FR-020/027, SC-001–008 | Pendiente |

## Relación con los 16 criterios docentes

Los nombres se toman literalmente de la matriz de `.specify/memory/constitution.md` basada en `RUBRICA.png`. Esta tabla solo indica aporte documental F02.5; **no asigna puntajes ni declara el criterio cumplido**.

| N.º | Criterio | Aporte F02.5 / evidencia futura | Estado |
|---|---|---|---|
| 1 | Identificación del problema y requerimientos | Brecha del alta por navegador, FR/AC y trazabilidad | Pendiente |
| 2 | Análisis y diseño del sistema | Modelo de solicitud/tenant, matriz de permisos, OpenAPI | Pendiente |
| 3 | Arquitectura de Bajo y alto nivel | ADR F02.5, UoW, Outbox y límites Clean Architecture | Pendiente |
| 4 | Desarrollo basado en SDD | Spec/plan/tasks/análisis y aprobaciones humanas | Pendiente |
| 5 | Pruebas unitarias e integración | Estados, permisos, RLS, transacción y rollback reales | Pendiente |
| 6 | Pruebas End to End | Cinco farmacias, importación, aislamiento y reservas en navegador | Pendiente |
| 7 | Interfaz y experiencia de usuario | Formularios/paneles accesibles y estados F08 | Pendiente |
| 8 | Escalabilidad del Frontend y backend | Sin nueva promesa; medir impacto local, F10 conserva alcance | Pendiente |
| 9 | Escalabilidad de Base de datos | Índices de solicitudes/tenant, concurrencia y pool sin fuga | Pendiente |
| 10 | Configuración de dominio y/o subdominio DNS y CDN | F09/AWS fuera de F02.5; no se genera evidencia | Pendiente fuera de F02.5 |
| 11 | Implementación Cache | Invalidación F03 por activación y ofertas, fallback | Pendiente |
| 12 | CI/CD | Checks F02.5 previstos sin despliegue automático | Pendiente |
| 13 | Pruebas de Carga k6 | Aprobaciones/importaciones concurrentes y latencias bajo TEST | Pendiente |
| 14 | Codigo fuente y base de datos en Github | Migraciones/fixtures sintéticos y revisión de secretos tras implementación | Pendiente |
| 15 | Informe Final | Registrar resultados reales y límites TEST en entrega futura | Pendiente |
| 16 | Presentación y dominio del Tema | Demo cinco farmacias y acceso cruzado rechazado, sin AWS | Pendiente |

## Puertas de aceptación

DEC-01–03, la especificación, el plan y la inserción F02.5 antes de F09 fueron aprobados para TEST/DEMO y constan en [approval.md](approval.md). La suspensión F025-RF23 y la provisión persistente/productiva siguen pendientes de autorización; Constitution 1.4.0 tampoco está ratificada. La [matriz actual de FR/SC/AC](acceptance.md) separa resultados técnicos de aceptación humana. No se inventan resultados ni se reabren aceptaciones F00–F08.
