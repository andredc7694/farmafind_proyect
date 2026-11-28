# F02.5 — Matriz para revisión de aceptación TEST/DEMO

> **Cambio de prioridad, 2026-11-22:** el responsable solicitó iniciar F02.1 (MEJ-001 y la parte de importación de MEJ-002). F02.5 queda suspendida como funcionalidad activa, sin cierre ni aceptación. T046 y T057 requieren demostración humana, T063 requiere aceptación expresa y F025-RF23 sigue bloqueado por decisión funcional. Se conservan íntegros los resultados técnicos y datos TEST/DEMO existentes; la suspensión no equivale a aprobarlos ni a eliminar pendientes.

## Decisión de Andre · 2026-11-27: **ACEPTO CON OBSERVACIONES** F02.5 (alcance TEST/DEMO)

> «ACEPTO CON OBSERVACIONES F02.5 (alcance TEST/DEMO).» (T063, tras su recorrido T057.)

**Observaciones:**
- (a) Las cinco importaciones excluyeron entre **523 y 615 filas** cada una (HUAMANFAR 583, STUART-FAR 523, RHFARMA 550, FARMAPIO 615, FARMAPOINT 535), por «mismo producto con distinto laboratorio u otros motivos». Detalle por motivo en `evidence.md`. La explicación del laboratorio es de Andre; no se comprobó en la base. Queda para la **spec 020, que pasa a ser prioritaria**.
- (b) Andre enviará detalles de mejora, que se registrarán como pendientes.

**Límites:** aceptación solo TEST/DEMO; no autoriza producción ni datos reales de terceros. F025-RF23 (suspensión/desactivación) sigue bloqueado por decisión funcional (T060). La matriz de abajo es la revisión técnica del 2026-11-22: sus «recorrido humano pendiente» quedan cubiertos por T057.

**Matriz técnica previa (2026-11-22), anterior a la decisión.** Compara [spec.md](spec.md), [tasks.md](tasks.md), [task-audit.md](task-audit.md), [evidence.md](evidence.md) y los 16 criterios docentes de [traceability.md](traceability.md). «Parcial» indica evidencia técnica existente que aún no satisface todo el criterio.

La [adenda técnica detallada](technical-unblock-proposal.md) delimita T031, T036–T037 y la recuperación segura de las dos suites F06.1. Su especificación y plan quedaron aprobados expresamente el 2026-11-21; contratos, permisos, migraciones y fixtures se implementaron y verificaron únicamente en PostgreSQL TEST efímero; la aceptación final sigue pendiente. Esta aprobación SDD no es aceptación F02.5.

## Requisitos FR y evidencia

| FR | Prueba/evidencia localizable | Estado de aceptación |
|---|---|---|
| 001 | Búsqueda pública HTTP y Playwright Linux 9/9, diez ofertas depuradas; comparación de dos. | Parcial: recorrido humano pendiente. |
| 002 | HTTP 401/403, sesión F01, CSRF y cinco solicitudes E2E TEST. | TEST verificado; recorrido humano pendiente. |
| 003 | `verify-http.mjs` 16/16, formulario React y cinco solicitudes E2E TEST. | Parcial: cinco solicitudes humanas pendientes. |
| 004 | Dominio/test de campos ficticios; sin validación legal real. | TEST verificado; legal fuera de alcance. |
| 005 | SQL 33/33 y HTTP 16/16 para borrador, envío, observación, reenvío y revisión. | TEST verificado; recorrido humano pendiente. |
| 006 | RLS 39/39, HTTP B→A 404 y pool 18/18. | TEST verificado; recorrido humano pendiente. |
| 007 | Matriz/grants F02.5 y pruebas 401/403. | Parcial: revocación y permisos por objeto exhaustivos pendientes. |
| 008 | SQL 39/39, T026 14 aserciones de concurrencia y Outbox/F05 7/7. | TEST verificado; recorrido humano pendiente. |
| 009 | Guarda `test-env.mjs`; clúster/DB TEST comprobados. | TEST verificado; persistente bloqueado. |
| 010 | SQL 46/46, matriz de 40 denegaciones SQL, HTTP 58 denegaciones y T040 18 aserciones de pool. | TEST verificado; revisión humana pendiente. |
| 011 | RLS 46/46 y T040 18/18: misma conexión reutilizada, contexto limpio, cambio Alfa→Beta y revocación revertida. | TEST verificado; revisión humana pendiente. |
| 012 | Revisor TEST con grants explícitos y sin membresía; HTTP niega inventario y reservas de cinco farmacias. | TEST verificado; no hay acceso global privado. |
| 013 | Panel reutiliza F01/F02; GET/PATCH del perfil privado con RLS, versión y auditoría TEST, SQL 12/12, HTTP 5/5. El arranque TEST del 2026-11-22 aplicó 014–015 al slot manual. | TEST verificado; perfil aún sin recorrido personal en el slot manual. |
| 014 | CSV de cinco farmacias TEST, XLSX y errores por fila previos; unitarias 5/5, denegaciones HTTP cruzadas y rollback 10 controles. | Parcial: T046 importación humana pendiente. |
| 015 | Redis real invalidado tras activación; fallback HTTP previo y SQL 39/39 excluye farmacia inactiva. | TEST verificado para proyección pública; recorrido humano pendiente. |
| 016 | Retorno búsqueda→login→reserva previo; reserva E2E actual y rechazo SQL de farmacia inactiva. | TEST verificado; recorrido humano pendiente. |
| 017 | F04 18/18 tras reserva E2E y Outbox/F05 de solicitudes 7/7 con reintento e idempotencia. | TEST verificado; entrega externa fuera de alcance. |
| 018 | Adjuntos sintéticos HTTP 6/6; SQL documental/roles dentro de 46/46; sin RUC obligatorio TEST. | TEST verificado; revisión humana pendiente. |
| 019 | SQL 33/33 verificó actor, motivo, fecha y ausencia de huella de sesión; slot manual conserva revisiones históricas. | TEST verificado; revisión humana pendiente. |
| 020 | SQL 46/46, HTTP 58 denegaciones, importación inválida 10 controles, F04 18/18, concurrencia T026 y Playwright Linux actual. | TEST verificado; revisión humana pendiente. |
| 021 | Bases técnica/manual separadas; cinco altas/importaciones técnicas verificadas; F01 persistente intacta por lectura. | Parcial: cinco altas/importaciones humanas en slot manual. |
| 022 | Rutas React y navegación F08/F02.5; E2E Linux actual 61/61 y recorrido público 9/9. | TEST verificado; revisión humana pendiente. |
| 023 | BORRADOR/EN_REVISION/reenviar SQL; duplicados controlados en esquema. | Parcial: prueba dedicada de duplicados/reenvío. |
| 024 | Panel React visible con grant; API 401/403 y cinco aprobaciones E2E actuales. | TEST verificado; revisión humana pendiente. |
| 025 | CSRF/sesión/validación HTTP y dominio. | Parcial: abuso/archivos/operaciones administrativas exhaustivas. |
| 026 | No existe operación de suspensión/desactivación. | **Bloqueado**: F025-RF23 requiere decisión aparte. |
| 027 | Formularios y paneles React, 43/43 suite. | Parcial: E2E accesibilidad/móvil actual. |
| 028 | Datos ficticios TEST, sin afirmación de habilitación legal. | TEST verificado; revisión legal real fuera de alcance. |

## Escenarios de éxito y criterios F025-AC

| Código | Evidencia verificable | Pendiente |
|---|---|---|
| SC-001 | Cinco altas y aprobaciones técnicas Playwright Linux actuales, 61 comprobaciones; slot manual conserva una aprobada. | Cinco altas y decisiones humanas en navegador, conteo final. |
| SC-002 | SQL 46/46; HTTP 20 pares dirigidos, 58 denegaciones; pool 18/18. | Revisión humana del aislamiento en el slot manual. |
| SC-003 | HTTP 401/403 y RLS; autoaprobación prohibida. | Matriz de todas las identidades sin grant, resultados actuales. |
| SC-004 | T026: dos aprobaciones simultáneas, una activación/DUENO/Outbox, replay incompatible 23505 y rollback; 14 aserciones. | Revisión humana y cobertura de error HTTP final pendientes. |
| SC-005 | Cinco inventarios CSV técnicos verificados; XLSX/error por fila previos; importación cruzada HTTP denegada y rollback 10 controles. | Cinco importaciones personales en slot manual. |
| SC-006 | Playwright público 9/9, diez ofertas depuradas; comparación de dos y búsqueda vacía. | Comparación humana de cinco farmacias. |
| SC-007 | Retorno login→reserva previo; reserva nueva E2E y F04 18/18; farmacia inactiva SQL denegada. | Recorrido humano. |
| SC-008 | Revisiones SQL/HTTP registradas; 3 revisiones en slot manual. | Auditoría completa de cinco decisiones y minimización de salida. |
| AC01–AC02 | SC-006 y SC-003; E2E público y cinco solicitudes actuales. | Revisión humana. |
| AC03–AC04 | SC-008/004; SQL/HTTP de revisión y activación; T026 concurrente 14 aserciones. | Auditoría completa y aceptación humana. |
| AC05–AC06 | SC-005/002; cinco inventarios técnicos, RLS 46/46, HTTP 58 denegaciones y rollback de importación. | Cinco importaciones humanas. |
| AC07–AC08 | SC-003/006; permisos y proyección pública; SQL excluye farmacia inactiva y E2E público 9/9. | Revisión humana. |
| AC09–AC10 | SC-001/002; Playwright Linux actual, RLS 46/46 y T040 18/18 de pool. | Recorrido humano de cinco farmacias. |
| AC11–AC12 | SC-007 y SC-001–008; retorno tras login, reserva y E2E Linux actual; regresión 499 pasaron, 102 omitidas. | Accesibilidad humana y aceptación expresa. |

La [matriz de trazabilidad](traceability.md) contiene la relación individual F025-AC01–12 con FR/SC y los **16 criterios docentes** con sus nombres. El aporte de F02.5 a esos criterios es parcial o queda fuera del alcance de este incremento; no se asignan puntajes ni se declara la rúbrica satisfecha por estas pruebas.

## Bloqueos y decisión humana

**F025-RF23 / FR-026:** suspensión/desactivación no está autorizada para implementación. No se encontró endpoint F02.5 ni migración operativa que la habilite. Antes de diseñarla o ejecutarla se requiere decidir actor, permisos, efectos sobre ofertas, reservas, sesiones/membresías, caché y auditoría; mantener la política de aislamiento. T060 queda satisfecho por registrar el bloqueo; **el bloqueo funcional permanece**.

**T063:** no se solicita ni presume una aceptación final todavía. Las verificaciones técnicas T035/T042/T054/T059/T062 ya tienen evidencia TEST; Playwright Linux se ejecutó con montajes mínimos individuales, sin montar el repositorio ni `.cache`. Faltan T046/T057 (importación y recorrido humanos de cinco farmacias) y la decisión humana expresa de T063. F025-RF23 continúa bloqueada. **F02.5 no está aceptada**. El arranque TEST del 2026-11-22 aplicó las migraciones 014/015 al slot manual sin borrar HUAMANFAR; su uso visual aún requiere comprobación personal.

**Decisiones técnicas para revisión antes de cambiar contratos o SQL:**

1. **T031:** implementación TEST del contrato interno F02.5/F05, cuatro tipos de evento, Outbox separado de F04, recepción local, reintento e idempotencia. HTTP focalizado 4/4 y PostgreSQL efímero 7/7; falta demostración humana, no aceptación final.
2. **T036–T037:** GET/PATCH de perfil privado, solo contacto editable, versión, sesión, CSRF, membresía, delegaciones, auditoría y RLS. HTTP focalizado 5/5 y PostgreSQL efímero 12/12, incluidos Alfa/Beta, revocación, conflicto y columnas protegidas. La base manual conserva su estado anterior.
3. **Suites F06.1 / T064:** madre TEST exclusiva marcada, guardas de destino y limpieza de hijos y roles propios; dos suites de integración 5/5. No se usó la base persistente.

**F025-RF23** necesita una decisión funcional independiente para suspensión/desactivación; no se infiere de esta adenda. T063 permanece pendiente de demostración y aceptación humana.

### Matriz técnica Alfa/Beta de cinco farmacias (sin aceptación humana)

`node scripts/f025/verify-sql-matrix.mjs` verificó las cinco membresías DUENO de la base técnica TEST: cada propietario tuvo inventario propio visible y permiso propio de lectura de reservas (10 controles positivos). Para cada uno de los 20 pares ordenados propietario→farmacia ajena, un `app.farmacia_id` manipulado no permitió leer el inventario privado ni obtener `reservation.read` (40 denegaciones SQL, transacción revertida). El verificador HTTP previo registró los mismos 20 pares y 45 denegaciones de inventario/reservas y revisor global sin inventario. Esta matriz acredita T055 en TEST, no sustituye la demostración personal de T057 ni la aceptación T063.

## 2026-11-25 · T046 — ACEPTADA («A: T046 ACEPTO», Andre)
- Andre verificó en su DEMO: `farma.xlsx` importado con exclusión explícita de las 583 filas por revisar (517 importadas, 0 errores); inventario e historial detallado correctos; la búsqueda pública de «Aciclovir» muestra ofertas de HUAMANFAR; el menú por rol funciona; el mapa abre desde Buscar medicamentos.
- **Salvedad:** las 583 filas excluidas quedan pendientes hasta implementar la spec 020.
- Sustituye al «NO APROBADA» anterior del mismo día. **F02.5 sigue SIN ACEPTAR:** T057 y T063 pendientes (solo Andre); F025-RF23 aplazada.
- Esto **no** es la aceptación final de F02.5 (T063).
