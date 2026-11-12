# F01 — Trazabilidad de requisitos y evidencia

**Fecha de revisión:** 2026-11-12. **Estado:** parcial; ninguna fila equivale por sí sola a aceptación de F01 ni a puntaje de la rúbrica. Fuente normativa: [spec.md](spec.md), [plan.md](plan.md), [Constitution v1.1.0](../../.specify/memory/constitution.md) y la rúbrica `docs/referencias/RUBRICA.png`. Los comandos y resultados reales se registran en [implementation-evidence.md](implementation-evidence.md). EXC-01/ROL-01 fueron ratificadas para `TRABAJADOR` local; GLO-01 mantiene bloqueadas concesiones globales y BOOT-01 solo permite diseño, según [authorization-decisions.md](authorization-decisions.md).

Las referencias `unit`, `http` y `rls` identifican archivos de prueba bajo `backend/tests/identity/`; `ui` refiere a `frontend/tests/identity/`. **Ejecutado** significa que existe una ejecución real registrada, no que el requisito de aceptación completo esté cumplido. **Parcial** indica escenarios obligatorios aún faltantes. **Bloqueado** indica una puerta humana expresa.

## Requisitos F01-FR-001–020

| Requisito | Escenarios y SC | Tareas / evidencia concreta | Estado de aceptación |
|---|---|---|---|
| F01-FR-001 registro ordinario único | US1.1; SC001 | T017, T022–T023, T025; `registration.unit.test.ts`, `identity-repository.rls.test.ts`, `auth.http.test.ts` | Parcial: falta recorrido navegador y cierre de batería. |
| F01-FR-002 login y abuso | US1.2, US1.4; SC002 | T020–T025; `identity-use-cases.unit.test.ts`, `abuse.unit.test.ts`, `auth.http.test.ts`, `identity-repository.rls.test.ts` | Parcial: T020/T024 y navegador pendientes. |
| F01-FR-003 sesión, expiración y revocación | US1.3–4; SC002 | T019, T022–T027; `session.unit.test.ts`, `identity-repository.rls.test.ts`, `auth.http.test.ts` | Parcial: composición ejecutable y E2E pendientes. |
| F01-FR-004 perfil propio y salida pública | US1.2, US1.5; SC002, SC005 | T023, T025, T053, T056; `auth.http.test.ts`, `data-minimization.test.ts` | Parcial: consulta pública de producto pertenece a otra fase. |
| F01-FR-005 identidad, rol y membresía distintos | US2.1–5; SC003 | T014–T015, T030, T033–T034; `membership.unit.test.ts`, `membership.rls.test.ts` | Parcial: derechos administrativos bloqueados. |
| F01-FR-006 listado y selección propia | US2.1–5; SC003 | T031–T038; `membership.http.test.ts`, `membership-isolation.test.ts`, `membership.rls.test.ts` | Parcial: navegador compatible pendiente. |
| F01-FR-007 estados de membresía | US2.3–4; SC003–004 | T010, T014, T030–T034, T038; `membership.rls.test.ts`, `membership-isolation.test.ts` | Parcial: casos completos de aceptación pendientes. |
| F01-FR-008 gestión restringida y auditada | US3.1, US3.4–5; SC006 | T040–T051 | EXC-01/ROL-01 documentadas; operación local `TRABAJADOR` T042–T049 sin implementar/probar; global T050–T051 bloqueada. |
| F01-FR-009 no autoelevación ni acceso ajeno | US3.2, US3.5; SC004, SC006 | T040–T049; denegación de rutas no montadas en `membership.http.test.ts` | Negativa básica parcial; mutación local pendiente de pruebas A/B y autoelevación. |
| F01-FR-010 autorización por acción/recurso | US3.1–5, US4.1–2; SC004 | T034, T038, T042, T045; `membership-isolation.test.ts` | Parcial; matriz local `TRABAJADOR` pendiente, global bloqueada. |
| F01-FR-011 permiso global explícito | US3.4; SC006 | T050–T051 | Bloqueado: GLO-01/BOOT-01. |
| F01-FR-012 privacidad y proyección | US1.5, US4.5; SC005 | T025, T053, T056; `data-minimization.test.ts` | Parcial: inspección global de respuestas pendiente. |
| F01-FR-013 contraseñas, sesión y abuso | US1.1–4; SC001–002 | T002, T018–T024, T027; `password.unit.test.ts`, `session.unit.test.ts`, `identity-repository.rls.test.ts` | Parcial: T020/T024 y E2E pendientes. |
| F01-FR-014 auditoría minimizada | US1.1–4, US3.1–5, US4.2; SC005–006 | T028, T053, T057; `identity-repository.rls.test.ts`, `data-minimization.test.ts` | Parcial: denegaciones US4/US3 y correlación HTTP pendientes. |
| F01-FR-015 PostgreSQL oficial | US1.1–4, US2.1–5; SC001–004 | T007–T011, T022, T038; `migrations.test.ts`, `identity-repository.rls.test.ts` | Parcial: mutaciones bloqueadas. |
| F01-FR-016 RLS pooled | US2.2–5, US4.1–4; SC003–004 | T011, T032, T038, T052, T055, T059; `rls-direct.test.ts`, `membership-isolation.test.ts` | Parcial: AC04 completo pendiente. |
| F01-FR-017 contexto local transaccional | US2.1–5, US4.1–4; SC003–004 | T012–T013, T038, T054–T055; `tenant-transaction.test.ts`, `pool-isolation.test.ts` | Parcial: pruebas AC04 finales pendientes. |
| F01-FR-018 pruebas positivas y negativas | US1–US4; SC001–007 | T005, T029, T038, T052–T065; suites unit/http/rls ejecutadas | Parcial: US3 bloqueada y Playwright pendiente. |
| F01-FR-019 contratos protegidos | US1.2–4, US2.1–5, US3.1–5; SC002–006 | T020, T025, T031, T035, T043, T048; `auth.http.test.ts`, `membership.http.test.ts` | Parcial: contrato local limitado actualizado; pruebas/rutas administrativas pendientes y globales bloqueadas. |
| F01-FR-020 límite de alcance | US1–US4; SC007 | T001, T006, T063; `backend/src/modules/README.md` y revisión del árbol | Parcial hasta revisión final humana. |

## Escenarios de aceptación aprobados

| Historia | Escenario | Evidencia actual y límite |
|---|---|---|
| US1 | 1 registro ordinario | `registration.unit.test.ts`, `identity-repository.rls.test.ts`, `auth.http.test.ts`; E2E pendiente. |
| US1 | 2 login y perfil propio | `identity-repository.rls.test.ts`, `auth.http.test.ts`; proceso F01 operativo pendiente. |
| US1 | 3 cierre/revocación/expiración | `session.unit.test.ts`, `identity-repository.rls.test.ts`; navegador pendiente. |
| US1 | 4 credenciales, inactividad y abuso | `identity-use-cases.unit.test.ts`, `identity-repository.rls.test.ts`; T020/T024 pendientes. |
| US1 | 5 consulta pública | `data-minimization.test.ts` prueba proyección; consulta pública completa fuera de F01. |
| US2 | 1 selección A/B propia | `membership.rls.test.ts`, `membership-isolation.test.ts`; navegador pendiente. |
| US2 | 2 identificador B manipulado | `membership.http.test.ts`, `membership-isolation.test.ts`; ruta de terceros no montada. |
| US2 | 3 suspensión/revocación/inactividad | `membership.rls.test.ts`, `membership-isolation.test.ts`; cobertura HTTP positiva/negativa parcial. |
| US2 | 4 cambio posterior de permiso | `membership-isolation.test.ts` prueba revocación en siguiente operación; mutación autorizada bloqueada. |
| US2 | 5 concurrencia A/B | `membership-isolation.test.ts` con pool de una conexión y `Promise.all`; E2E pendiente. |
| US3 | 1 gestión local autorizada | EXC-01/ROL-01 ratificadas para `TRABAJADOR`; pruebas e implementación pendientes. |
| US3 | 2 autoelevación | Negativa de rutas ausentes parcial; mutación y matriz bloqueadas. |
| US3 | 3 delegación para reservas | Evaluación de delegación propia parcial; reserva corresponde a F04 y mutación bloqueada. |
| US3 | 4 administración global | Bloqueado: GLO-01/BOOT-01. |
| US3 | 5 gestión de B por A | Negativa básica parcial; operación administrativa bloqueada. |
| US4 | 1 acceso positivo A | `rls-direct.test.ts`, `membership.rls.test.ts`, `membership-isolation.test.ts`; AC04 completa pendiente. |
| US4 | 2 lectura/escritura B denegadas | `rls-direct.test.ts` y HTTP US2; mutación de terceros bloqueada, auditoría de denegación pendiente. |
| US4 | 3 falta de contexto | `rls-direct.test.ts`, `tenant-transaction.test.ts`; batería final pendiente. |
| US4 | 4 conexión reutilizada | `pool-isolation.test.ts`, `membership-isolation.test.ts`; batería final pendiente. |
| US4 | 5 salida pública | `data-minimization.test.ts`; revisión completa pendiente. |

## Siete criterios de éxito

| SC | Evidencia observada | Estado |
|---|---|---|
| F01-SC-001 | Registro/duplicado con PostgreSQL sintético y HTTP; pruebas unitarias | Parcial, batería de aceptación/E2E pendiente. |
| F01-SC-002 | Sesión/revocación/expiración con PostgreSQL y HTTP | Parcial, proceso F01 y E2E pendientes. |
| F01-SC-003 | A/B y pool concurrente en `membership-isolation.test.ts` | Parcial, E2E pendiente. |
| F01-SC-004 | SQL directo, RLS y HTTP propio negativo | Parcial: AC04 completa y US3 bloqueada. |
| F01-SC-005 | DTO, respuesta y auditoría de identidad minimizados | Parcial: denegaciones US4 y revisión total pendientes. |
| F01-SC-006 | No existen mutaciones de terceros habilitadas | Bloqueado: no se afirma cumplimiento positivo. |
| F01-SC-007 | Revisión de límites del módulo Usuarios y roles | Parcial hasta revisión humana final. |

## Los 16 criterios de la rúbrica docente

Los nombres corresponden a `RUBRICA.png` según la matriz ratificada de la Constitution. No se asignan puntos ni se atribuye a F01 la evidencia de otras funcionalidades.

| N.º | Criterio | Aporte verificable F01 / pendiente |
|---|---|---|
| 1 | Identificación del problema y requerimientos | `spec.md` traza F01-FR-001–020; aprobación documental, evaluación global pendiente. |
| 2 | Análisis y diseño del sistema | `data-model.md`, contratos y migraciones F01; revisión integral pendiente. |
| 3 | Arquitectura de Bajo y alto nivel | `plan.md` y Clean Architecture del módulo; C4/ADR complementarias pendientes. |
| 4 | Desarrollo basado en SDD | Constitution, spec/plan/tasks y evidencias F01; revisión y PR pendientes. |
| 5 | Pruebas unitarias e integración | Vitest/Supertest/PostgreSQL ejecutados en Windows 10; batería final pendiente. |
| 6 | Pruebas End to End | Playwright pendiente de entorno oficialmente compatible. |
| 7 | Interfaz y experiencia de usuario | Vistas React y pruebas de renderizado; usabilidad/navegador pendientes. |
| 8 | Escalabilidad del Frontend y backend | Sin medición ni evidencia F01; criterio global pendiente. |
| 9 | Escalabilidad de Base de datos | Migraciones e índices F01; EXPLAIN/carga y métricas pendientes. |
| 10 | Configuración de dominio y/o subdominio DNS y CDN | Fuera de F01; sin DNS/CDN creados. |
| 11 | Implementación Cache | Fuera de F01; Redis Cache-Aside futuro. |
| 12 | CI/CD | Preparación F00; validación de pipeline F01 pendiente. |
| 13 | Pruebas de Carga k6 | Fuera de F01; sin resultados de carga. |
| 14 | Codigo fuente y base de datos en Github | Código/migraciones locales; sin commit ni publicación F01. |
| 15 | Informe Final | Fuera de F01; no existe informe final aprobado. |
| 16 | Presentación y dominio del Tema | Fuera de F01; sin presentación/demo final verificada. |

**Convergencia local T068–T069 (2026-11-11):** F01-FR-001–007/013/016–019 y escenarios US1/US2 tienen ahora una comprobación HTTP con servidor de loopback, dos pools no privilegiados y PostgreSQL ficticio; `implementation-evidence.md` registra 32 archivos/162 pruebas de regresión, 0 omitidas. Esta evidencia suma una ejecución local al criterio docente de funcionalidad/seguridad, sin asignar puntaje ni cubrir US3, Playwright, AC04 completo o aceptación final.
