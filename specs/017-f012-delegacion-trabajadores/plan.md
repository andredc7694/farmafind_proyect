# Plan: F01.2 — Delegación efectiva a trabajadores
**Spec**: [spec.md](spec.md) · Sin servicios nuevos, US$0.

## Enfoque
Un solo cambio de regla en cuatro puntos, con la misma condición: `rol ∈ {DUENO, ADMINISTRADOR, TRABAJADOR}` **y** delegación ACTIVA de la capacidad pedida **y** el resto de condiciones intactas. El permiso lo da la delegación; el rol solo dice quién es elegible.

| Punto | Cambio |
|---|---|
| `backend/migrations/f02/006_worker_delegation.sql` | `CREATE OR REPLACE f02.can_inventory_action`: añade `TRABAJADOR` al rol; capacidades limitadas a las 5 de inventario |
| `backend/migrations/f04/009_worker_delegation.sql` | `CREATE OR REPLACE f04.can_reservation_action`: igual, 4 capacidades de reservas |
| `inventario/domain/authorization.ts` | `canUseInventory` acepta TRABAJADOR (la delegación ya se exige por `capabilities`) |
| `reservas/application/authorization.ts` | acepta TRABAJADOR con delegación ACTIVA |

No se tocan: `membership.manage`, funciones de plataforma, F01 (`has_platform_permission`), políticas RLS por `farmacia_id`, ni `farmafind_f01_test`. Ninguna capacidad nueva es delegable (el tope sigue `STAFF_DELEGABLE_CAPABILITIES`).

## Verificación
1. Unitarias de las dos políticas TS (rol × delegación).
2. RLS (TEST efímero): matriz trabajador × capacidad × {delegada, no delegada, revocada, membresía suspendida, farmacia inactiva, sesión cerrada, otra farmacia, conexión reutilizada Alfa→Beta}; intento de `membership.manage` y plataforma denegado.
3. HTTP: trabajador lee resúmenes (`/reservas/resumen`, `/inventario/resumen`) y acepta una reserva; sin delegación → denegado.
4. Regresión F01–F05, F06.1, F08.1 (DUEÑO/ADMIN sin cambios) y E2E del trabajador sobre la DEMO.
5. Revisión de seguridad de las dos migraciones antes del cierre.

## Riesgos
Ampliar autorización → matriz Alfa/Beta obligatoria; el orden de migraciones debe aplicarse tras F01/F02/F04 base (CREATE OR REPLACE sobre funciones existentes).
