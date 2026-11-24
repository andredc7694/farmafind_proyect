# Implementation Plan: F04.1 — Operación de reservas

**Branch**: `feat/f041-operacion-reservas` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md) (aprobada 2026-11-24; D-01/D-02/D-03 = A, ver [approval.md](approval.md))

## Summary

Extender F04 sin tocar sus reglas: (1) un **centro de atención** de solo lectura con filtros que el navegador consulta cada 30 s y fusiona por identificador (sin duplicados, tolerante a cortes); (2) **historial paginado** y **exportación CSV** de la farmacia activa, sin datos personales del cliente; (3) una **preferencia de recogida** opcional (30/60/120 min o franja) guardada en una tabla propia, de solo inserción, que **nunca** participa en `recogida_expira_en`, en la reserva de stock ni en las transiciones.

## Technical Context

**Language/Version**: TypeScript 5 / Node 24.17 (backend), React + Vite JSX (frontend). **Dependencias nuevas**: ninguna.
**Storage**: PostgreSQL; migración aditiva `backend/migrations/f04/008_pickup_preference.sql` (tabla `f04.preferencia_recogida` con RLS/FORCE RLS). Sin Redis nuevo; sin cambios en `f04.reserve_stock`, `close_reservation_stock` ni en el worker de expiración.
**Testing**: Vitest (dominio, router con fakes), PostgreSQL TEST efímero con RLS Alfa/Beta (clúster F02.5 identificado, como F04), concurrencia 10/100 con y sin preferencia, jsdom, y E2E Playwright Linux al final.
**Constraints**: US$0; solo bases TEST efímeras; nunca `farmafind_f01_test`; ADR-F04-SEC-001 y F04-TIME-01 intactos; el rol runtime sin `BYPASSRLS`.

## Constitution Check

| Principio | Cumplimiento |
|---|---|
| Multi-tenant / RLS | Tabla nueva con `farmacia_id` y políticas por actor/capacidad; lecturas y exportación por el contexto transaccional existente (`authorizeReservationContext`). |
| Clean Architecture / UoW | Casos de uso en `application/`, SQL en `infrastructure/`, rutas en `presentation/`; el módulo `reservas` no importa de otros módulos salvo `usuarios/contracts`. |
| Outbox | Sin eventos nuevos: la preferencia no es una transición. Los eventos de F04 no cambian. |
| Costos | Nada de pago ni externo. |
| Pruebas según riesgo | Matriz de aislamiento, concurrencia, vencimiento fijo antes/después, reconexión, exportación. |

## Architecture decisions

1. **Preferencia en tabla propia** (`preferencia_recogida`, 1:1 con la reserva, inmutable): no se altera `f04.reserva`, que tiene restricciones delicadas de coherencia y un trabajador de expiración con permisos mínimos. Se inserta en la **misma transacción** que `reserve_stock`; si falla, se revierte toda la creación (FR-004 de F04).
2. **Validación (D-01 = A)** en dominio: minutos ∈ {30,60,120} o franja con `inicio ≥ ahora`, `fin ≤ ahora + plazo_recogida_horas`, duración 15–120 min; además `minutos ≤ plazo×60`. El plazo es el configurado de la farmacia al crear. Se rechaza con 422 (no se recorta en silencio). El vencimiento real (`confirmación + plazo`) ≥ `creación + plazo`, por lo que la preferencia siempre cabe.
3. **Centro de atención** = `GET …/reservas/centro` (instantánea con `generatedAt`); el cliente HTTP la repite cada 30 s (pausa con la pestaña oculta, reintento con espera creciente tras fallos) y fusiona por `id`; nunca ejecuta acciones. No se toca el `GET …/reservas` existente.
4. **Historial** = `GET …/reservas/historial` con paginación por cursor (`creado_en`,`id`), estados cerrados solamente, límite ≤ 100.
5. **Exportación** = `GET …/reservas/historial/exportar` (CSV UTF-8, ≤ 5000 filas, cabecera `X-Export-Truncated`), protegida contra inyección de fórmulas, sin datos del cliente (solo código corto de la reserva). Misma capacidad `reservation.read` que la cola (no se inventa un permiso nuevo).
6. **Idempotencia de creación**: la huella incluye la preferencia; reintentar con otra preferencia bajo la misma clave es conflicto (igual que una cantidad distinta).

## Project Structure

```text
specs/015-f041-operacion-reservas/   spec, plan, research, data-model, contracts/, quickstart, tasks, evidence, ...
backend/migrations/f04/008_pickup_preference.sql
backend/src/modules/reservas/
├── domain/pickup-preference.ts            # validación pura
├── application/{ports.ts, create-reservation.ts, attention-center.ts}
├── infrastructure/reservation-repository.ts  # preferencia, centro, historial, exportación
└── presentation/{customer-,pharmacy-}reservations-router.ts
frontend/src/reservations/{CreateReservation,OwnReservations,PharmacyReservations,AttentionCenter?}.jsx, reservations-client.js, polling.js
backend/tests/reservations/f041-*.test.ts · frontend/tests/reservations/f041-*.test.jsx · frontend/e2e/f041-reservations.spec.js
scripts/f04/check.mjs (se registran las pruebas nuevas) · scripts/f041/ (E2E y DEMO)
```

## Fases de entrega (lotes)

1. **Base**: migración 008 + RLS + dominio de preferencia + pruebas unitarias y RLS Alfa/Beta.
2. **Preferencia (US3)**: creación con preferencia, idempotencia, vencimiento fijo, concurrencia 10/100; UI de creación y vista del cliente.
3. **Centro, historial y exportación (US1–US2)**: casos de uso, rutas, pruebas HTTP/RLS; UI con sondeo, filtros, historial y descarga.
4. **No regresión (US4)** y cierre: regresión F04/F01/F02/F03/F05, contratos, E2E Linux, medición, DEMO, trazabilidad, analyze/converge y `acceptance.md`.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| La preferencia altera el vencimiento | Tabla separada, sin lectura en transiciones; prueba antes/después y comparación de `recogida_expira_en`. |
| Sondeo masivo o duplicados | Intervalo fijo, fusión por `id`, cursor estable; prueba de reconexión. |
| Exportación filtra otra farmacia o datos personales | Contexto transaccional + RLS; columnas fijas sin cliente; prueba Alfa/Beta con conexión reutilizada. |
| Inyección de fórmulas en CSV | Neutralización de celdas que empiezan por `= + - @` y prueba. |
| Pruebas F04 exigen el clúster F02.5 | Usar el contenedor `farmafind-f025-postgres` autorizado; nunca la base persistente. |
