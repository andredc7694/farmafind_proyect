# Preparación de aceptación F02.1

**Estado:** pendiente de revisión humana. No es acta de aceptación.

La [evidencia técnica](evidence.md) verifica 37/38 tareas, 21 pruebas focales, las suites PostgreSQL/HTTP y cuatro recorridos Playwright Linux. La [matriz](traceability.md) relaciona FR-001–014, SC-001–007 y la rúbrica sin puntajes.

T033, T036 y T037 tienen evidencia técnica TEST/DEMO registrada. Solo T038 registrará la decisión humana expresa tras revisar el alcance, resultados y límites. La aprobación de spec/plan no anticipa esta decisión. No se declara aptitud productiva.

MEJ-001 queda técnicamente avanzada pero sin aceptación final. MEJ-002 conserva únicamente cobertura de errores de importación; sus errores de autenticación, reservas, permisos y geolocalización siguen pendientes de incrementos posteriores.

## Decisión humana final (T038) — 2026-11-23

**Decisión: ACEPTO.** Registrada tal cual desde el mensaje del responsable del proyecto (Andre) en esta conversación, el 2026-11-23 (America/Lima), tras recibir la guía de prueba manual de la DEMO local TEST (Alfa/Beta ficticias) y el resumen de pruebas. El responsable no detalló qué pasos de la guía ejecutó; no se afirma más que la decisión expresa.

**Alcance aceptado:** F02.1 en TEST/DEMO — MEJ-001 (importación adaptativa CSV/XLSX con hoja, encabezado y perfiles por farmacia) y la parte de importación de MEJ-002 (errores de importación). No declara aptitud productiva, datos reales, AWS ni bases persistentes.

**Límites y pendientes que se conservan (no los cierra esta aceptación):**
- MEJ-002 fuera de importación (errores de autenticación, reservas, permisos y geolocalización) sigue pendiente de incrementos posteriores.
- Las suites `test:f02:rls`, `test:f03:rls`, `f021-rls` y `test:f04:rls` no se repitieron el 2026-11-23 (ver «Pendientes de esta verificación» en [evidence.md](evidence.md)); rige la evidencia RLS del 2026-11-22 y queda pendiente la decisión sobre su reejecución.
- Observación registrada para el responsable: la interfaz no tiene botón «Cancelar»; F021-FR-009 se cumple por abandono de la vista previa.
- El cambio de rendimiento de `file-parser.ts` (commit `c4c5f4e`) está aprobado por el responsable como cambio fuera de las tareas originales.
- F02.5 (T046, T057, T063), F08 y F06.1 siguen **sin aceptar**; esta decisión no los afecta.
- La aceptación no implica integración a `main`: push, PR o merge requieren confirmación aparte (Constitution XVI).

## 2026-11-25 · T046 — ACEPTADA («A: T046 ACEPTO», Andre)
- Andre verificó en su DEMO: `farma.xlsx` importado con exclusión explícita de las 583 filas por revisar (517 importadas, 0 errores); inventario e historial detallado correctos; la búsqueda pública de «Aciclovir» muestra ofertas de HUAMANFAR; el menú por rol funciona; el mapa abre desde Buscar medicamentos.
- **Salvedad:** las 583 filas excluidas quedan pendientes hasta implementar la spec 020.
- Sustituye al «NO APROBADA» anterior del mismo día. **F02.5 sigue SIN ACEPTAR:** T057 y T063 pendientes (solo Andre); F025-RF23 aplazada.
- Cubre la enmienda F02.1 (importación en un paso, pantallas del panel, exclusión explícita e historial).
