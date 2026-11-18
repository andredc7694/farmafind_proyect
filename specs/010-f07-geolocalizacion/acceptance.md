# F07 — Matriz de aceptación provisional

**Fecha:** 2026-11-18. **Entorno demostrado:** Windows 10, Node.js 24.17.0, PostgreSQL/Redis locales y Playwright en contenedor Linux oficialmente compatible. **Estado:** implementación y verificaciones TEST/DEMO; aceptación humana F07 pendiente. No se han aplicado migraciones F07 ni concedido capacidades GEO en bases persistentes.

| Requisitos | Evidencia TEST/DEMO | Límite pendiente |
| --- | --- | --- |
| F07-FR-001, F07-FR-010 | Propuesta, revisión independiente, auditoría, control de versión y publicación RLS; `check.mjs api`, `rls` y `http-private-smoke.mjs`. | Concesión persistente de capacidades requiere autorización específica; no se ha hecho. |
| F07-FR-002, F07-FR-004, F07-FR-007, F07-FR-008 | Validación de coordenadas/radio, distancia lineal, consentimiento puntual, ciudad/manual, borrado; `check.mjs unit`, `ui`, Playwright 5/5. | No se prueba un dispositivo físico ni un proxy de producción. |
| F07-FR-003, F07-FR-005 | Proyección PostgreSQL de farmacias activas/verificadas, listado alternativo y ofertas F03 referenciales; `check.mjs api`, `rls`, Playwright. | Filas de farmacia TEST no acreditan ubicaciones reales. |
| F07-FR-006 | Revisión documental del proveedor, atribución y clic informado; prueba con teselas bloqueadas, lista disponible. | Cobertura, condiciones finales y disponibilidad real de teselas para uso productivo requieren revisión humana. |
| F07-FR-009 | Sesión/CSRF, capacidades F01 explícitas, contexto por transacción, FORCE RLS y denegación Alfa/Beta; `check.mjs unit`, `api`, `rls`, HTTP real. | No hay concesiones de capacidad fuera de TEST. |
| F07-FR-011, F07-FR-012 | Cinco posiciones ficticias, radios, vacío, rechazo, p95 con 200 candidatas; controles de alcance y regresión específica. | Runner global `test:base` quedó atascado; no se declara aprobado. No se probó infraestructura productiva. |

| Criterio de éxito | Resultado observado | Estado de aceptación |
| --- | --- | --- |
| F07-SC-001 | Cinco posiciones ficticias, distancias y radios en pruebas unitarias y API. | Evidencia TEST suficiente; revisión humana pendiente. |
| F07-SC-002 | Permiso denegado/revocado y continuidad manual/ciudad en UI y Playwright. | Evidencia TEST suficiente; revisión humana pendiente. |
| F07-SC-003 | Solo marcadores verificados; lista persiste con teselas bloqueadas. | Evidencia TEST suficiente; disponibilidad real de teselas pendiente. |
| F07-SC-004 | Ofertas F03 existentes con precio, disponibilidad referencial y fecha. | Evidencia TEST suficiente; revisión humana pendiente. |
| F07-SC-005 | Denegación de sesión/CSRF, capacidad insuficiente, autoaprobación y tenant cruzado; RLS real. | Evidencia TEST suficiente; capacidades persistentes pendientes. |
| F07-SC-006 | POST sin coordenadas en URL, `no-store`, sin historial/almacenamiento local observado. | Evidencia TEST suficiente; proxy productivo no evaluado. |
| F07-SC-007 | Navegador Linux oficial: escritorio, móvil, teclado y lista accesible 5/5. | Evidencia TEST suficiente; revisión humana pendiente. |
| F07-SC-008 | p95 8,41 ms / umbral 2000 ms, 200 candidatas TEST; revisión de licencia/privacidad documentada. | Métrica TEST acreditada; decisión de mapa productivo y revisión humana pendientes. |

**Cierre técnico del 2026-11-18:** `test:base` ejecutó 420 pruebas generales satisfactorias y, por separado mediante el lanzador de bases efímeras F06.1, otras 5/5; 103 casos generales quedaron omitidos por sus propias condiciones de entorno. Las suites F07 específicas de API, RLS, caché, migración, unidad e interfaz pasaron; Playwright Linux pasó 5/5. `npm audit` y `npm audit --omit=dev` informaron cero vulnerabilidades en esta ejecución. La aceptación humana F07 **sigue pendiente** y se limita a TEST/DEMO. No se ha autorizado conceder capacidades GEO en la base persistente, desplegar ni usar teselas de producción. Los comandos, resultados y límites figuran en [implementation-evidence.md](implementation-evidence.md).
