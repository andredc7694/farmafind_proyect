# F07 — Matriz de aceptación humana TEST/DEMO

**Fecha:** 2026-11-18. **Entorno demostrado:** Windows 10, Node.js 24.17.0, PostgreSQL/Redis locales y Playwright en contenedor Linux oficialmente compatible. **Estado:** F07 aceptada expresamente por el responsable del proyecto solo en alcance TEST/DEMO. **Fuente de aprobación:** mensaje «FARMAFIND — APROBACIÓN HUMANA FINAL DE F07» de esta conversación, 2026-11-18. No se han aplicado migraciones F07 ni concedido capacidades GEO en bases persistentes.

| Requisitos | Evidencia TEST/DEMO | Límite pendiente |
| --- | --- | --- |
| F07-FR-001, F07-FR-010 | Propuesta, revisión independiente, auditoría, control de versión y publicación RLS; `check.mjs api`, `rls` y `http-private-smoke.mjs`. | Concesión persistente de capacidades requiere autorización específica; no se ha hecho. |
| F07-FR-002, F07-FR-004, F07-FR-007, F07-FR-008 | Validación de coordenadas/radio, distancia lineal, consentimiento puntual, ciudad/manual, borrado; `check.mjs unit`, `ui`, Playwright 5/5. | No se prueba un dispositivo físico ni un proxy de producción. |
| F07-FR-003, F07-FR-005 | Proyección PostgreSQL de farmacias activas/verificadas, listado alternativo y ofertas F03 referenciales; `check.mjs api`, `rls`, Playwright. | Filas de farmacia TEST no acreditan ubicaciones reales. |
| F07-FR-006 | Revisión documental del proveedor, atribución y clic informado; prueba con teselas bloqueadas, lista disponible. | Cobertura, condiciones finales y disponibilidad real de teselas para uso productivo requieren revisión humana. |
| F07-FR-009 | Sesión/CSRF, capacidades F01 explícitas, contexto por transacción, FORCE RLS y denegación Alfa/Beta; `check.mjs unit`, `api`, `rls`, HTTP real. | No hay concesiones de capacidad fuera de TEST. |
| F07-FR-011, F07-FR-012 | Cinco posiciones ficticias, radios, vacío, rechazo, p95 con 200 candidatas; `test:base` y regresión específica satisfactorios. | No se probó infraestructura productiva. |

| Criterio de éxito | Resultado observado | Estado de aceptación |
| --- | --- | --- |
| F07-SC-001 | Cinco posiciones ficticias, distancias y radios en pruebas unitarias y API. | Aceptado TEST/DEMO. |
| F07-SC-002 | Permiso denegado/revocado y continuidad manual/ciudad en UI y Playwright. | Aceptado TEST/DEMO. |
| F07-SC-003 | Solo marcadores verificados; lista persiste con teselas bloqueadas. | Aceptado TEST/DEMO; disponibilidad real de teselas pendiente para uso productivo. |
| F07-SC-004 | Ofertas F03 existentes con precio, disponibilidad referencial y fecha. | Aceptado TEST/DEMO. |
| F07-SC-005 | Denegación de sesión/CSRF, capacidad insuficiente, autoaprobación y tenant cruzado; RLS real. | Aceptado TEST/DEMO; capacidades persistentes bloqueadas. |
| F07-SC-006 | POST sin coordenadas en URL, `no-store`, sin historial/almacenamiento local observado. | Aceptado TEST/DEMO; proxy productivo no evaluado. |
| F07-SC-007 | Navegador Linux oficial: escritorio, móvil, teclado y lista accesible 5/5. | Aceptado TEST/DEMO. |
| F07-SC-008 | p95 9,77 ms / umbral 2000 ms, 200 candidatas TEST; revisión de licencia/privacidad documentada. | Aceptado TEST/DEMO; proveedor de mapa productivo no aprobado. |

**Cierre técnico del 2026-11-18:** `test:base` ejecutó 420 pruebas generales satisfactorias y, por separado mediante el lanzador de bases efímeras F06.1, otras 5/5; 103 casos generales quedaron omitidos por sus propias condiciones de entorno. Las suites F07 específicas de API, RLS, caché, migración, unidad e interfaz pasaron; Playwright Linux pasó 5/5. `npm audit` y `npm audit --omit=dev` informaron cero vulnerabilidades en esta ejecución. Los comandos, resultados y límites figuran en [implementation-evidence.md](implementation-evidence.md).

**Decisión humana formal:** el responsable del proyecto aprueba los 12 requisitos F07-FR-001–012, los 8 criterios F07-SC-001–008 y las 56 tareas ya verificadas **únicamente para TEST/DEMO**. Esta aprobación no habilita capacidades geográficas en bases persistentes, mapas públicos/productivos, servicios externos, facturación ni despliegue; tampoco acredita aptitud para producción. Se conservan la propuesta de [provisión de permisos](permission-provisioning.md) y la [revisión del mapa](map-provider-review.md) como pendientes de autorización productiva separada.
