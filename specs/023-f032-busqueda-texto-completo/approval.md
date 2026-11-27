# Aprobaciones F03.2 — Búsqueda con texto completo

## 2026-11-27 · Pedido de Andre
- Corrección prioritaria: que la búsqueda entienda textos que juntan nombre, concentración y presentación; que no importen tildes, mayúsculas ni espacios entre número y unidad; que ninguna sugerencia lleve a una búsqueda vacía (con prueba automática); y que, sin coincidencia exacta, se muestren otras presentaciones con un aviso.
- Rama propia desde `main` `288d72a`, con SDD. Pasar a `ESTADO.md` las notas de `.cache/estado-pendiente.md` (hecho en esta rama).
- Reglas: revisar specs F03 y F03.1, Constitution y ADR antes de programar. Si cambia SQL, índices, contrato o caché: enmienda, plan y SQL para aprobar; no aplicar nada antes. No cambiar qué se publica. US$0, sin servicios ni librerías nuevas sin consultar. Medir con los 518 productos de HUAMANFAR. Mostrar en la copia 3001/5174 con datos ficticios. No tocar la DEMO, su base ni su Redis.

## Pendiente
- Aprobación de `spec.md` y de las decisiones D-01 a D-05.
