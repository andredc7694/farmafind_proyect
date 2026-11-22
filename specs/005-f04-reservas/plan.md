# Implementation Plan: F04 — Reservas y concurrencia

**Branch**: `feat/f04-reservas` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Status**: Plan generado a partir de la especificación aprobada y F04-TIME-01. La Constitution exige aprobación humana del plan concreto antes de generar código.

## Summary

F04 añadirá el módulo `reservas` al monolito modular. Un cliente autenticado podrá crear una PENDIENTE contra inventario F02, consultar y cancelar sus reservas. Personal de una farmacia podrá revisar, confirmar tras comprobación física, registrar falta física y entregar solo con autorización efectiva. PostgreSQL coordinará reserva, compromiso o consumo de inventario y Outbox en una transacción; RLS protegerá propiedad y tenant. Un ejecutor local idempotente expirará vencidas. Cada farmacia configurará entre 1 y 8 horas, con 4 por defecto; al confirmar se copiará el vencimiento exacto a la reserva y nunca se recalculará.

## Technical Context

**Language/Version**: Node.js 24.17.0, TypeScript 5.9.3, Express 5.2.1; React 19.2.7 + Vite 7.3.8 + JavaScript/JSX; npm 11.13.0.

**Primary Dependencies**: reutilizar `pg`, Express, React, Vitest, Supertest y Playwright. No se requiere dependencia nueva para dominio, transacciones ni idempotencia.

**Storage**: PostgreSQL 18.6 local de pruebas. Esquema aditivo `f04` para reservas, configuración por farmacia, incidencias, Outbox e idempotencia. F02 conserva inventario oficial.

**Testing**: Vitest, Supertest, PostgreSQL/RLS real, Playwright Linux oficial y k6 para AC05. Pruebas de estado, autorización, rollback, reintento, pool reutilizado y 100 solicitudes/10 unidades.

**Target Platform**: Windows 10 para desarrollo; Docker Desktop local ya aprobado para PostgreSQL aislado; navegador Linux oficial para Playwright. Sin AWS.

**Project Type**: aplicación web con frontend React, API Express y monolito modular en npm workspaces.

**Performance Goals**: consistencia antes que latencia; AC05 debe producir exactamente 10 PENDIENTES sobre 10 unidades ante 100 solicitudes válidas. Registrar p95/p99, throughput, conflictos y errores sin fijar una mejora no medida.

**Constraints**: PostgreSQL oficial; Redis fuera de decisiones de reserva; RLS obligatoria; UoW y Outbox atómicos; F05 no se procesa; sin pagos, GLO-01, BOOT-01, AWS, IA ni rediseño; datos ficticios; rango 1–8 y default 4 inmutables por reserva confirmada.

**Scale/Scope**: cinco historias, 26 requisitos y nueve criterios. Contratos para cliente, farmacia, configuración y ejecutor de expiración; un módulo backend y una vista React funcional mínima.

## Constitution Check

| Principio | Aplicación F04 | Gate |
|---|---|---|
| I, XVI–XVIII | Spec aprobada, rama independiente y plan concreto. La implementación espera aprobación expresa de este plan. | **Pendiente de aprobación humana del plan**. |
| II–VI | `reservas` conserva dominio/aplicación/infraestructura/presentación; usa contratos de Usuarios e Inventario. | Pasa. |
| VII–VIII | PostgreSQL oficial, roles sin `BYPASSRLS`, `FORCE RLS`, actor/tenant locales a transacción y pruebas A/B. | Diseño pasa; evidencia pendiente. |
| IX | Redis no participa en reservas, stock, vencimientos ni idempotencia. | Pasa. |
| X | Reserva, inventario y Outbox comparten UoW; F05 publicará después. | Pasa. |
| XI–XII | Solo PostgreSQL local; ningún recurso AWS o costo. | Pasa. |
| XIII–XV | Unitarias, HTTP, RLS, E2E, concurrencia/k6 y trazabilidad HU03–04/RF05–09/AC04–09. | Diseño pasa; evidencia pendiente. |
| XIX–XX | Sin IA clínica; fixtures sintéticos y secretos locales ignorados. | Pasa. |

**Post-design:** [research.md](research.md), [data-model.md](data-model.md), [reservations.openapi.yaml](contracts/reservations.openapi.yaml) y [quickstart.md](quickstart.md) no introducen excepciones. F04-TIME-01 reemplaza una propuesta histórica no ratificada y no contradice una norma constitucional.

## Design

### Límites y casos de uso

El dominio define la máquina de estados y las reglas `create`, `cancel`, `confirm`, `rejectForPhysicalShortage`, `deliver` y `expire`. Aplicación coordina `CreateReservation`, `ListOwnReservations`, `CancelOwnReservation`, `ListPharmacyReservations`, `ConfirmReservation`, `ReportPhysicalShortage`, `DeliverReservation`, `UpdatePickupWindow` y `ExpireReservations`. Infraestructura implementa repositorios PostgreSQL en un mismo cliente transaccional; presentación valida HTTP y nunca decide permisos.

### Persistencia, concurrencia e idempotencia

Las migraciones `backend/migrations/f04/` crearán el esquema y roles/políticas de F04. La creación bloquea la fila exacta de `f02.inventario`, vuelve a calcular `cantidad_fisica - cantidad_comprometida`, incrementa el compromiso, inserta PENDIENTE con vencimiento de respuesta e inserta Outbox. Cualquier fallo revierte todo.

Cada mutación exige `Idempotency-Key`; se almacena hash, actor, operación y huella canónica de parámetros. Repetir la misma solicitud devuelve el resultado previo; reutilizar la clave con otra huella produce conflicto. Las transiciones bloquean reserva e inventario. Restricciones y estado previo garantizan liberación o consumo único.

### Tiempo y configuración F04-TIME-01

`f04.configuracion_farmacia` mantiene `plazo_recogida_horas` entero con `CHECK BETWEEN 1 AND 8` y default 4. Solo `reservation.settings` de la farmacia propia puede modificarlo. Confirmar lee el valor dentro de la transacción y escribe `recogida_expira_en = confirmado_en + plazo`; ese timestamp no cambia después. Entrega exige vigencia; si ya venció, no entrega. PENDIENTE usa 20 minutos configurables desde configuración segura del servidor.

### Autorización y RLS

Cliente: sesión vigente y actor coincidente con `reserva.usuario_id`. Farmacia: sesión, membresía activa, farmacia activa, contexto tenant y capacidad `reservation.read`, `reservation.accept`, `reservation.deliver` o `reservation.settings`. `TRABAJADOR` no obtiene capacidades por rol. Dueño/admin también requieren permiso explícito.

Tablas privadas usan `ENABLE/FORCE RLS`, `USING/WITH CHECK`, FK por farmacia y grants mínimos. Runtime no es propietario, superusuario ni `BYPASSRLS`. El ejecutor de expiración usa rol local `NOLOGIN` y políticas limitadas; no concede privilegios globales.

### Outbox, incidencias y F05

F04 registra eventos mínimos de creación y transición. No publica, reintenta ni llama a Notificaciones. La falta física inserta incidencia y movimiento F02, libera el compromiso y cancela en una transacción; la conciliación posterior sigue en Inventario.

### API e interfaz

El contrato define rutas de cliente, farmacia y configuración. Expiración se ejecuta por comando interno local, no por ruta pública. React añade `/reservations`: creación, listado/estado/vencimiento/cancelación propia, panel de farmacia, configuración 1–8, confirmar, falta física y entregar. La API conserva autoridad.

### Pruebas

Unitarias: estados, terminales, reloj, configuración, snapshot de vencimiento e idempotencia. HTTP: contrato, CSRF, 401/403/404/409/422. PostgreSQL: migraciones, grants, RLS A/B, rollback, pool, Outbox e incidencia. Concurrencia: crear 100/10 y carreras de transición. E2E: cliente y farmacia con vencimiento visible. Regresión F00–F03.

## Project Structure

```text
specs/005-f04-reservas/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/reservations.openapi.yaml
  checklists/requirements.md
  tasks.md
backend/
  migrations/f04/
  src/modules/reservas/{domain,application,infrastructure,presentation}/
  tests/reservations/
frontend/
  src/reservations/
  tests/reservations/
scripts/f04/
```

**Structure Decision:** conserva workspaces y composición existente. No crea servicio adicional; Notificaciones sigue independiente y sin lógica F05.

## Risks and gates

| Riesgo | Control | Puerta |
|---|---|---|
| Sobreasignación | Bloqueo de inventario y AC05 real. | Fallo bloquea cierre. |
| Doble liberación/consumo | Estado bloqueado, versión e idempotencia. | Fallo bloquea cierre. |
| Fuga tenant/propiedad | RLS, contexto, capacidades y pruebas A/B. | Fallo bloquea implementación afectada. |
| Delegaciones | Fixtures sintéticos; sin ruta para autoasignarlas. | No habilitar GLO-01/BOOT-01. |
| Worker excesivo | Rol sin login/bypass y políticas mínimas. | Grants inseguros bloquean ejecución. |
| Vencimiento mutable | Timestamp copiado y prueba tras reconfigurar. | Fallo bloquea aceptación. |

## Traceability to teaching criteria

F04 aporta a 1–7, 9, 12–16 mediante requisitos, arquitectura, API/UI, seguridad, concurrencia, migraciones y evidencias. Los criterios 8, 10 y despliegues transversales continúan pendientes. No se asignan puntajes.

## Complexity Tracking

No hay violaciones constitucionales. El rol de expiración separado reduce privilegios frente a un cron con migrador o superusuario. El Outbox local es obligatorio aunque F05 procese después.
