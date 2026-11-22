# F04 — Investigación y decisiones

**Fecha:** 2026-11-13. **Estado:** propuestas del plan pendientes de aprobación concreta antes de código.

## Compatibilidad de F04-TIME-01

**Decisión:** rango entero 1–8 horas, default 4, calculado desde confirmación e inmutable por reserva.

**Motivo:** maestro y Constitution exigían configuración y trataban 24 horas como propuesta. La decisión humana posterior la sustituye. **Descartado:** recalcular reservas existentes.

## Concurrencia

**Decisión:** bloqueo pesimista de inventario y reserva dentro de una transacción, con orden estable.

**Motivo:** PostgreSQL es autoridad y AC05 exige exactitud. **Descartado:** Redis como coordinador; optimismo con reintentos añade complejidad innecesaria al primer incremento.

## Idempotencia

**Decisión:** `Idempotency-Key` obligatoria, almacenada como hash junto con actor, operación y huella canónica.

**Motivo:** distingue reintento de reutilización conflictiva sin guardar clave cruda. **Descartado:** confiar solo en estado, porque no evita doble creación.

## Autorización

**Decisión:** capacidades `reservation.read`, `reservation.accept`, `reservation.deliver` y `reservation.settings`, vinculadas a delegación F01. Clientes se autorizan por propiedad.

**Motivo:** las fuentes exigen delegación expresa y reservas propias. Los nombres son contratos técnicos, no roles globales. **Descartado:** autorizar por `TRABAJADOR` o `farmacia_id`.

## RLS y expiración

**Decisión:** RLS propietario/tenant y worker `NOLOGIN`, sin `BYPASSRLS`, con acceso mínimo. Expiración revalida estado y vencimiento.

**Motivo:** evita cron privilegiado, carreras y fuga de pool. **Descartado:** migrador o superusuario para negocio.

## Outbox y herramientas

**Decisión:** F04 persiste payload mínimo y no publica. Reutiliza `pg`, Vitest, Supertest, Playwright y k6; no añade ORM.

**Motivo:** atomicidad pertenece a F04 y entrega/reintentos a F05; SQL visible facilita RLS y concurrencia.
