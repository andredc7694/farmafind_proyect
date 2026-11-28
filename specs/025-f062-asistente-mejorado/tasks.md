# Tasks: F06.2 — Asistente FarmaFind AI mejorado

**Estado**: **Aprobadas por Andre el 2026-11-27** (commit `0767cbd`) con condiciones (ver `approval.md`). Sin SQL.
Formato: `T000: descripción (requisitos)`. Una casilla se marca solo con evidencia real en `evidence.md`.

## Fase 1 · Dominio
- [x] T001: `assistant-language.ts` (limpieza F03.2, palabras de pregunta, intenciones PRECIO/CERCANÍA/HORARIO/ALTERNATIVA/SEGUIMIENTO, distrito y variante en la frase) y `places.ts` con prueba de paridad. Pruebas con las frases del pedido. (FR-003, FR-004, FR-009)
- [x] T002: `dosage-form.ts` (formas conocidas; «caja x N» y «frasco» → desconocida) y regla de alternativa (mismo principio activo, concentración y forma; etiqueta y aviso; sin «equivalente» ni «reemplazar»). Pruebas. (D-04)
- [x] T003: `edit-distance.ts` y reglas de «¿Quisiste decir…?». Pruebas («ibuprofemo», «amoxisilina», límites). (FR-008)
- [x] T004: `emergency.ts` (106/116/105, fuente y fecha) y prioridad absoluta de la urgencia sin tarjetas. Pruebas. (FR-012, D-08)

## Fase 2 · Contrato, herramientas y caso de uso
- [x] T005: Contrato 2.0: petición con `contexto` estructurado (sin texto libre: intención, medicamento, concentración, forma, distrito/punto; ≤ 1 KB); el servidor descarta lo que no reconoce y no lo registra; respuesta con `tarjetas`, `opciones`, `sugerencia`, `verTodas`, `emergencia`, `contexto`. Pruebas de validación, **de contexto manipulado y de contexto demasiado largo**, y de que el contexto no aparece en los registros. (D-01, D-05, condición de Andre)
- [x] T006: Herramientas públicas de solo lectura: búsqueda con orden y lugar, farmacias públicas por distrito y horario público; composición. Pruebas. (FR-013)
- [x] T007: Caso de uso sin almacén: seguridad → intención → medicamento → datos → aclaración → tarjetas; ruta de descarte compatible (204). Pruebas con herramientas falsas. (FR-003 a FR-012)
- [x] T008: Regresión F06.1 adaptada (clínica, inyección, límites, búsqueda) y contrato `conversation.openapi.yaml` 2.0.0 con `check-openapi-routes.mjs`. (F061-FR-020, SC-004)

## Fase 3 · Pantalla
- [x] T009: Panel lateral (≥ 1280 px corre el contenido; 1024–1279 px encima con minimizar recordado en la visita) y hoja inferior en celular sin tapar botones. Pruebas. (FR-001, D-06)
- [x] T010: Preguntas rápidas, tarjetas, opciones, sugerencia, «Ver todas» y bloque de emergencia (con `tel:`). Pruebas. (FR-002, FR-005 a FR-008, FR-011, FR-012)
- [x] T011: Contexto en memoria de la página (nada al recargar) y propuesta por pantalla desde «Buscar medicamentos». Pruebas. (FR-009, FR-010)
- [x] T012: Accesibilidad: teclado completo, Enter envía, Escape minimiza, `aria-live`, textos de botones. Pruebas. (FR-015)

## Fase 4 · Base real, regresión, copia y aceptación
- [x] T013: `scripts/f06/verify-f062.mjs` con PostgreSQL real (base efímera marcada, borrada al final): las 4 frases, alternativa por forma, horario real y farmacias inactivas/sin stock fuera. (SC-001, FR-013)
- [x] T014: Regresión completa (backend, frontend, `check`, contratos, verificaciones F03.2 y F07.2) con resultados reales.
- [x] T015: Copia temporal 3001/5174 con datos ficticios; E2E con Chrome, axe y 0 llamadas externas; Andre la revisa. (FR-016, SC-005)
- [x] T016: Revisión de seguridad (clínica, inyección, privacidad, sin escrituras) y converge contra la spec. (FR-012 a FR-014)
- [x] T017: Aceptación de Andre en `acceptance.md` (**solo Andre decide**). Después: apagar la copia, PR y merge; actualizar la DEMO con aviso y copia de seguridad (sin migraciones).
