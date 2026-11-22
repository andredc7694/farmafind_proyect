# F05 — Trazabilidad de requisitos, resultados y rúbrica

| Requisitos | Escenarios / criterios | Evidencia verificable |
|---|---|---|
| F05-FR-001–003 | US1.1–1.3; SC-001 | proceso `notifications`, Outbox posterior al commit y caída real controlada sin alterar Reserva |
| F05-FR-004–006 | US1.1, US4.2; SC-005, SC-007 | contrato OpenAPI, HMAC, loopback, esquema estricto y límites 401/413/422 |
| F05-FR-007–008 | US2.1–2.3; SC-003 | 100 reenvíos, una entrega, replay estable y conflicto de huella auditado |
| F05-FR-009–010 | US1/US3; SC-001, SC-004 | `SKIP LOCKED`, lease recuperable y publicación solo tras 2xx durable |
| F05-FR-011–013 | US3.1–3.3; SC-002 | clasificación, backoff acotado, bloqueo durable y cinco tipos F04 permitidos |
| F05-FR-014–016 | US4.1; SC-004–005 | roles mínimos, `FORCE RLS`, Alfa/Beta y denegación de modificación F04 |
| F05-FR-017–018 | US3/US4; SC-006 | errores genéricos, métricas técnicas y conflicto sin payload privado |
| F05-FR-019–020 | Todos; SC-001–008 | suites unitarias, HTTP, recuperación, PostgreSQL/RLS, Redis y datos ficticios |
| F05-FR-021–022 | F05-DEC-01 A | entrega local; ausencia verificada de proveedor, AWS, pagos, UI o IA |

Los **22 requisitos**, los escenarios de las cuatro historias y los **8 criterios de éxito**
quedan vinculados. Los resultados detallados están en `implementation-evidence.md`; la
trazabilidad no sustituye la revisión humana.

## Rúbrica docente — 16 criterios

1. **Repositorio/SDD:** `spec.md`, `plan.md`, `tasks.md`, contratos y evidencia F05.
2. **Requisitos:** F05-FR-001–022 trazados sin atribuir resultados externos.
3. **Historias:** US1–US4 con pruebas independientes.
4. **Arquitectura:** publicador modular y servicio independiente con Clean Architecture.
5. **Frontend:** fuera del alcance F05; el frontend existente compila sin cambios funcionales.
6. **Backend:** Express/TypeScript y contrato interno versionado.
7. **Datos:** PostgreSQL, migraciones, restricciones e índices.
8. **Multi-tenant:** contexto por transacción, roles sin bypass y `FORCE RLS`.
9. **Seguridad:** HMAC, anti-replay, mínimo privilegio, límites y errores minimizados.
10. **Concurrencia:** leases, `SKIP LOCKED`, dos publicadores e idempotencia.
11. **Integridad:** Transactional Outbox; el envío queda fuera de la transacción F04.
12. **Pruebas:** unitarias, HTTP, integración, recuperación, RLS y regresión.
13. **Rendimiento:** p95/p99 local y lote de 100, sin extrapolar a producción.
14. **UX/accesibilidad:** no aplica al adaptador local sin UI; no se inventa evidencia.
15. **Despliegue:** compatibilidad HTTPS/AWS futura; cero recursos creados.
16. **Evidencias:** comandos y resultados reales; aprobación humana aún pendiente.
