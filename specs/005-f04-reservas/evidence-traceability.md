# F04 — Trazabilidad de evidencias

| Alcance | Evidencia principal |
|---|---|
| F04-FR-001–006 / US1 | dominio, CreateReservation, contrato cliente y PostgreSQL/AC05 |
| F04-FR-007–011 / US2 | lista/detalle/cancelacion propia, idempotencia y carrera cancelar/expirar |
| F04-FR-012–017,026 / US3–US5 | capacidades exactas, RLS, configuracion 1–8, entrega y worker minimo |
| F04-FR-018–021 | repositorio transaccional, Inventario F02, incidencias y Outbox |
| F04-FR-022 | `/reservations`, vistas cliente/farmacia y E2E preparado |
| F04-FR-023–024 | unitarias, HTTP, PostgreSQL/RLS y AC05 10/100 |
| F04-FR-025 | sin pagos, F05 operativo, AWS, GLO-01 ni BOOT-01 |
| F04-SC-001–006,008–009 | suites, build, regresion y auditoria npm |
| F04-SC-007 | Playwright Linux: recorrido React cliente/farmacia satisfactorio con API ficticia; autorizacion y aislamiento cubiertos por pruebas API/PostgreSQL reales |

## Rubrica docente (16 criterios)

1. Repositorio/SDD: spec, plan, tasks y evidencia F04.
2. Requisitos: F04-FR-001–026 trazados.
3. Historias: US1–US5 con pruebas independientes.
4. Arquitectura: modulo Clean Architecture `reservas`.
5. Frontend: React/Vite `/reservations`.
6. Backend: Express/TypeScript y contrato versionado.
7. Datos: PostgreSQL, FK tenant, indices y restricciones.
8. Multi-tenant: contexto transaccional y FORCE RLS.
9. Seguridad: sesion, CSRF, capacidades y errores minimizados.
10. Concurrencia: bloqueos, idempotencia y AC05.
11. Integridad: UoW reserva/inventario/Outbox.
12. Pruebas: unitarias, API, RLS, carga y regresion.
13. Rendimiento: p95/p99 local, sin extrapolar a produccion.
14. UX/accesibilidad: estados/vencimiento visibles y recorrido Playwright Linux satisfactorio.
15. Despliegue: compatibilidad futura; cero recursos AWS creados.
16. Evidencias: comandos/resultados reales; revision humana pendiente.
