# Propuesta (NO aplicada) — resolver o renovar SEC-EXC-DEV-2026-001 antes del 2026-12-17

**Fecha de la propuesta:** 2026-11-25. No modifica la excepción vigente ni ninguna dependencia; requiere decisión de Andre.

## Hallazgo de hoy
- `npm audit` (completo): **0 vulnerabilidades**; `npm audit --omit=dev --audit-level=high`: **0**.
- `picomatch` sigue en `4.0.7` (última versión publicada en el registro npm); el árbol de producción no contiene Vite/Vitest/picomatch (según la revisión del 2026-11-17).
- Por tanto el aviso `GHSA-fc5q-39xc-vjpf` ya **no aparece** en la auditoría actual (pudo retirarse o reclasificarse). Falta confirmarlo leyendo el aviso oficial en GitHub Advisory Database.

## Opciones (recomendación primero)
- **A (recomendada) — Cerrar la excepción:** si la lectura del aviso oficial confirma que fue retirado o corregido y `npm audit` sigue en 0, registrar el cierre con fecha y evidencia (`npm audit`, `npm ls`) y marcarla «resuelta». Costo cero, sin cambios de código.
- **B — Renovar 30 días:** si el aviso sigue vigente pero sin parche, renovarla hasta 2027-01-17 con la misma evaluación de riesgo (solo desarrollo, Vite fijado a 127.0.0.1).
- **C — Mitigar:** si aparece parche, actualizar Vite/Vitest en un incremento pequeño con regresión completa.

## Qué haré si apruebas A
1. Leer el aviso oficial; 2. repetir `npm audit` y `npm ls` el día del cierre; 3. actualizar `security-exception-dev-dependencies.md` y ESTADO.md; 4. dejarlo en un commit aparte.
