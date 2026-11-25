# Feature Specification: F01.2 — Los trabajadores usan los permisos que se les delegan

**Feature Branch**: `feat/f012-delegacion-trabajadores`
**Created**: 2026-11-24
**Status**: Borrador, **espera aprobación de Andre**.
**Origen**: hallazgo H-1 de F08.1 (`specs/016-f081-experiencia-integrada/convergence.md`). Andre eligió la opción A el 2026-11-24.

## Problema (lenguaje sencillo)
F01.1 permite que el dueño delegue a un trabajador permisos de inventario y reservas. Pero F02 (inventario) y F04 (reservas) solo aceptan a personas con rol DUEÑO o ADMINISTRADOR, aunque el trabajador tenga la delegación vigente. Resultado: el trabajador ve el menú, pero el servidor le niega las cifras y acciones.

## Qué se construye
Un trabajador (rol TRABAJADOR) con membresía ACTIVA, farmacia ACTIVA y **delegación explícita y vigente** de una capacidad puede ejecutar **solo esa capacidad**, **solo en esa farmacia**.

## User Story 1 — Trabajador opera con lo delegado (P1)
- Dado un trabajador con `inventory.read` delegado en Alfa, ve el resumen y lista de inventario de Alfa.
- Dado un trabajador con `reservation.read` + `reservation.accept`, ve y acepta reservas de Alfa.
- Sin la capacidad concreta, el servidor la niega aunque tenga otras.

## User Story 2 — Revocar corta de inmediato (P1)
Al revocar la delegación, suspender la membresía, desactivar la farmacia o cerrar la sesión, la siguiente petición se niega (sin esperar caché).

## User Story 3 — Aislamiento y no escalada (P1)
Un trabajador de Alfa nunca accede a Beta; no puede gestionar personal, delegar ni ver capacidades de plataforma; el rol no se amplía por delegar.

## Requisitos
- **F012-FR-001**: Las decisiones de F02 (`f02.can_inventory_action`), F04 (`f04` autorización) y su equivalente en TypeScript (`canUseInventory`, `authorizeReservationContext`) DEBEN aceptar rol `TRABAJADOR` además de DUENO/ADMINISTRADOR **solo con delegación ACTIVA de la capacidad pedida**.
- **F012-FR-002**: Se mantienen todas las demás condiciones (sesión vigente, usuario activo, membresía activa, farmacia activa, misma farmacia, tenant por RLS).
- **F012-FR-003**: Capacidades que sigue **sin** poder usar un trabajador, aunque se intentara delegar: gestión de personal (`membership.manage`), cualquier capacidad de plataforma y de solicitud de farmacia. Se prueba que no se puede delegar ni usar.
- **F012-FR-004**: Cero `BYPASSRLS`; la política de filas por `farmacia_id` no se relaja; no se añaden permisos globales.
- **F012-FR-005**: Auditoría de denegaciones y de acciones del trabajador conserva el actor y la farmacia (como en F02/F04).
- **F012-FR-006**: La interfaz de F08.1 pasa a mostrar las cifras del trabajador sin cambios de diseño; el mensaje «sin acceso» solo aparece si el servidor deniega.
- **F012-FR-007**: Migración **aditiva** (reemplazo de funciones/políticas), sin tocar `farmafind_f01_test`; pruebas en bases TEST efímeras.
- **F012-FR-008**: US$0, sin servicios nuevos.

## Criterios de éxito
- **SC-001**: matriz trabajador × capacidad × (con/sin delegación, revocada, membresía suspendida, farmacia inactiva, sesión cerrada, otra farmacia) pasa al 100 %, con conexión reutilizada Alfa→Beta.
- **SC-002**: cero accesos cruzados Alfa/Beta; cero escalada a gestión de personal/plataforma.
- **SC-003**: regresión F01–F05, F06.1, F01.1, F02.1, F04.1 y F08.1 sin cambios de comportamiento para DUEÑO/ADMINISTRADOR.
- **SC-004**: E2E: el trabajador de la DEMO ve las cifras de Alfa y acepta una reserva; sin delegación, no.

## Decisiones abiertas (recomendación primero)
- **D-01 · Alcance de capacidades del trabajador**: (A, recomendada) solo las ya delegables en F01.1 (inventario y reservas); (B) restringir además a solo lectura por defecto; (C) incluir más capacidades.
- **D-02 · Historial/auditoría de reservas para trabajador**: (A, recomendada) hereda la capacidad `reservation.read`; (B) capacidad aparte.

## Fuera de alcance
Cambiar qué capacidades son delegables (F01.1), nuevas pantallas, MEJ-011, F02.5.

## Riesgos
Ampliar la autorización es un cambio de seguridad: por eso va con matriz de pruebas Alfa/Beta y revisión de las dos migraciones (F02 y F04) y del código TS.
