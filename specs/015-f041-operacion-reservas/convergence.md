# F04.1 — Convergencia contra la spec (analyze + converge)

Fecha: 2026-11-24. Sin puntajes. No equivale a aceptación.

| Requisito | Evidencia |
|---|---|
| FR-001–003 cola, actualización automática, filtros | `f041-ops.rls` (cola/filtros/Alfa-Beta), `f041-center.test.jsx` (sondeo, reconexión), E2E 1–2 |
| FR-004–005 historial y exportación | `f041-ops.rls`, `f041-http`, CSV, E2E 3 |
| FR-006–008 preferencia | `f041-pickup-preference`, `f041-ops.rls`, `f041-http`, E2E 1 |
| FR-009 RLS/farmacia_id | migración 008, `f041-ops.rls` (políticas, privilegios, conexión única) |
| FR-010–011 reglas F04 y concurrencia | F04 rls 26/26 (incluye AC05 con y sin preferencia), regresión completa |
| FR-012 interfaz en español | pruebas jsdom y E2E |
| FR-013 pruebas requeridas | cubiertas (ver evidence.md) |
| FR-014 alcance | sin pagos, notificaciones, búsqueda ni inventario nuevos; solo TEST |

## Diferencias respecto a la spec/plan (registradas)
1. Farmacia ajena o sin capacidad responde **403** (no 404 como decía el borrador del contrato); el contrato se corrigió para igualar a F04.
2. Pruebas RLS agrupadas en un archivo (`f041-ops.rls.test.ts`).
3. La interfaz no bloquea acciones en reservas vencidas: las marca y decide el servidor (preserva F08).
4. El historial usa solo la capacidad existente `reservation.read`; `can_reservation_action` exige rol DUENO/ADMINISTRADOR con la delegación (regla previa de F04 que no se modificó).

## Límites abiertos
- Sin horario semanal (D-01 = A): la preferencia se valida contra el plazo de la farmacia, no contra un horario de atención.
- Sin eventos en tiempo real (D-03 = A): retraso máximo de 30 s.
- `f05:rls` no se reejecutó (guardia con otra base; sin cambios en F05).
- La aceptación humana es solo de Andre.
