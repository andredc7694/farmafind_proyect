# F02.5 — Registro de aprobación para implementación TEST/DEMO

**Fecha:** 2026-11-19 (America/Lima).
**Responsable:** responsable del proyecto FarmaFind, mediante aprobación humana expresa en esta conversación.
**Rama:** `feat/f025-incorporacion-farmacias`.
**Estado:** especificación y plan aprobados; implementación y aceptación F02.5 pendientes.

**Nota de control de revisión (2026-11-21):** los hashes de la tabla siguiente identifican exclusivamente las revisiones aprobadas el 2026-11-19. La adenda posterior para T031, T036–T037 y suites F06.1 fue aprobada expresamente en esta conversación el 2026-11-21 y se registra al final de este archivo con hashes propios. Los hashes históricos se conservan sin sustituirlos. Esta aprobación SDD no acredita implementación ni pruebas.

El responsable respondió «APRUEBO» a la solicitud concreta de aprobar la propuesta de enmienda constitucional 1.3.0 y la revisión de `spec.md` y `plan.md` F02.5; después respondió «dale» para continuar con el trabajo. No se infiere ninguna autorización por silencio. La Constitution 1.3.0 ya incorpora F02.5 después de F08 y antes de F09; `ADR-ROADMAP-V3-001` permanece íntegra como antecedente.

| Documento aprobado o ratificado | SHA-256 de la revisión registrada | Alcance |
|---|---|---|
| `.specify/memory/constitution.md` v1.3.0 | `601F93AC45C4015C89C137A8D4899D86EE8F1E2D07EEDB14DF8A5F44AA5131C4` | Solo secuencia F02.5 y trazabilidad; v3.0 sigue siendo maestro principal. |
| `specs/012-f025-incorporacion-farmacias/spec.md` | `C030EEDEE6A716C0BB4B352EF0139DCC2E4010C77AE613D6716D1590DD0C5020` | Requisitos F02.5 TEST/DEMO, DEC-01–03 y límites expresos. |
| `specs/012-f025-incorporacion-farmacias/plan.md` | `95C49BE2923AC467CFA21FA0EE772C44AA85EEF6062C422B05E5E790D1A73691` | Diseño técnico TEST/DEMO, matriz de permisos, RLS y pruebas previstas. |

La aprobación permite implementar y verificar F02.5 **solo** en bases efímeras TEST/DEMO aisladas. No autoriza migraciones, provisión privilegiada ni activación en `farmafind_f01_test` o producción. La suspensión/desactivación `F025-RF23` sigue bloqueada; tampoco se autoriza adoptar v3.1 como nuevo maestro principal, activar AWS/Gemini ni declarar F02.5 aceptada. Cada tarea requiere evidencia real antes de marcarse completa.

Tras la aprobación se actualizaron únicamente estado y trazabilidad de la puerta normativa en spec/plan, sin cambiar los 28 requisitos, los 8 criterios de éxito ni las decisiones de arquitectura. Los hashes anteriores a esas notas eran `5302F7E240BC552285CBFFBB842073C84FAB136A2624B24A0DFFC89CC226333E` (spec) y `676040E8B39115CF44976357FE44F75EB42618483570F081D7BD20982468E894` (plan).

**T001:** puerta documental y normativa satisfecha. Las demás tareas conservan sus dependencias, revisiones SQL y controles de seguridad propios.

## Delegaciones F04 del propietario en TEST/DEMO (2026-11-20)

El responsable aprobó expresamente en esta conversación que la activación F02.5 TEST/DEMO otorgue al nuevo DUENO `reservation.read`, `reservation.accept`, `reservation.deliver` y `reservation.settings`, solo para la farmacia de su membresía válida, activa y autorizada. Son delegaciones revocables y auditables mediante F01; F04 mantiene su autorización backend y PostgreSQL RLS. No se autoriza acceso a reservas de otros tenants ni alterar las reglas transaccionales de F04. Esta aprobación complementa las cinco capacidades de inventario TEST previamente concedidas y no habilita uso persistente o productivo.

## Aprobación SDD de la adenda T031/T036–T037/F06.1 (2026-11-21, America/Lima)

**Responsable:** responsable del proyecto FarmaFind, mediante aprobación humana expresa en esta conversación (mensaje «FARMAFIND — F02.5: APROBACIÓN SDD DE LA ADENDA T031, T036–T037 Y F06.1»). **Rama:** `feat/f025-incorporacion-farmacias`. Aprueba exclusivamente la revisión de especificación y plan para T031, T036, T037 y fixtures de las dos suites F06.1. No modifica las aceptaciones históricas, F025-RF23 ni T063.

| Revisión aprobada | SHA-256 | Alcance |
|---|---|---|
| `spec.md`, adenda 2026-11-21 | `2CEA2C13D409A4A31568CFE1795302AABE352A9D09074404DF0AA7776F25FA27` | Cuatro eventos locales F05 con Outbox, perfil GET/PATCH solo `contacto` y suites F06.1 aisladas. |
| `plan.md`, adenda 2026-11-21 | `0B73B83EDD2BC283A866936E7362AA1114A2D27FB15F7147F91271D90D51557A` | Contrato interno separado F05, 30 días configurables TEST, RLS/capacidades tenant, migraciones TEST propuestas y fixtures efímeros. |

Se preparan T031, T036, T037 y T064 sin marcarlas completas. La ejecución de código, SQL, migraciones, servicios o pruebas queda para la siguiente autorización expresa. Ninguna base persistente, DEMO manual o entorno productivo queda autorizado para estas operaciones. GLO-01/BOOT-01 conservan sus límites y F02.5 no queda aceptada.

## 2026-11-25 · T046 — NO APROBADA (verificación humana de Andre)
Andre cargó `farma.xlsx` (hojas «Precios», «Farmacia», «Léeme»; encabezados `medicamento, nombre_generico, concentracion, presentacion, categoria_terapeutica, precio_regular_sol…`): la pantalla mostró «No se pudo completar la solicitud.» y los campos de mapeo quedaron con los nombres por defecto del importador antiguo. Incumple F021-FR-001–004 y SC-001 (propuesta automática de hoja, encabezado y mapeo) y MEJ-002 (error preciso). **T046 sigue sin marcar. T057 y T063 sin marcar.** Corrección pendiente de aprobación de Andre; no se cambió código.

## 2026-11-25 · T046 — ACEPTADA («A: T046 ACEPTO», Andre)
- Andre verificó en su DEMO: `farma.xlsx` importado con exclusión explícita de las 583 filas por revisar (517 importadas, 0 errores); inventario e historial detallado correctos; la búsqueda pública de «Aciclovir» muestra ofertas de HUAMANFAR; el menú por rol funciona; el mapa abre desde Buscar medicamentos.
- **Salvedad:** las 583 filas excluidas quedan pendientes hasta implementar la spec 020.
- Sustituye al «NO APROBADA» anterior del mismo día. **F02.5 sigue SIN ACEPTAR:** T057 y T063 pendientes (solo Andre); F025-RF23 aplazada.
- Autoriza: PR de `feat/f025-cierre-verificacion` y fusión con merge commit solo si está MERGEABLE y CLEAN, con CI en verde, sin secretos y con la regresión aplicable aprobada; después, rama nueva desde `main`: primero el lote del asistente virtual y luego la spec 020, sin alterar los datos ni el esquema de la DEMO de F02.5 mientras hace T057 y T063 (base TEST separada). Al aprobar productos nuevos del catálogo se exige el principio activo.

## 2026-11-26 · Hallazgo y decisión: el propietario activado no gestiona su personal
- **Hallazgo** (consulta de solo lectura): la activación F02.5 no concede `membership.manage`; el dueño de HUAMANFAR no ve «Personal». La gestión de personal F01.1 existe y está aceptada.
- **Decisión de Andre:** corregirlo como enmienda de F02.5 (F025-FR-029), en una rama propia desde `main`, con SDD abreviado y parada en la aprobación del plan. Migración nueva y aditiva, sin editar la 009 ni los hashes aprobados. Mostrar el SQL antes de ejecutarlo. Reparar las farmacias ya activadas, con auditoría. Tocar RLS solo si es imprescindible y avisar. Pruebas: recorrido completo, aislamiento Alfa/Beta, ni trabajador ni administrador global obtienen el permiso, y regresión F01.1, F02.5 y spec 017.
- Migrar la base de su DEMO queda autorizado **solo después** de que Andre apruebe el SQL. Debe quedar lista antes de su verificación T057.
- T046 aceptada; **T057 y T063 sin marcar; F02.5 sigue SIN ACEPTAR.** Spec 020 en opción A.

## 2026-11-26 · Revisión del SQL 016 por Andre
- **Aprueba el SQL en lo esencial**, con una ampliación: la reparación concede además `pharmacy.profile.read/write` a los propietarios vigentes que no los tengan (mismas reglas, una auditoría por alta, repetible), más una comparación de solo lectura de HUAMANFAR antes de añadir nada más.
- Pide ver el **bloque ampliado** antes de aplicarlo. Pide también confirmar el rol de la reparación y su comportamiento frente a RLS, que no se editan hashes aprobados, registrar el hash final en `migrate-f025.ts` y documentar la atribución al revisor original y a la migración.
- Apagó la DEMO y **autorizó las pruebas de F01.1 y de navegador**. **No aplicar a su DEMO** hasta aprobar el bloque ampliado. Después: reiniciar la DEMO, aplicar, verificar en el navegador «Personal» y el perfil de la farmacia, e informar los permisos antes y después.
- T057 y T063 sin marcar; F02.5 SIN ACEPTAR; spec 020 en opción A.

## 2026-11-26 · Aprobación del bloque ampliado del SQL 016
- **Andre: «Apruebo el bloque ampliado»** de `016_owner_staff_manage_test.sql` (hash `2667F61535861CB30852A3ACE1A867015A7AE68245EF254F9AFEBADCC7DF27AE`), tal como está en `fix/f025-propietario-gestiona-personal` (commit `9d978c2`).
- Autoriza: reiniciar su DEMO, aplicar la migración y verificar en el navegador «Personal» y el perfil de HUAMANFAR; después, PR y fusión con merge commit solo si está MERGEABLE y CLEAN, con CI en verde, sin secretos y con la regresión aplicable aprobada.
- **F02.5 sigue SIN ACEPTAR:** T057 y T063 pendientes (solo Andre). Spec 020 en opción A.
