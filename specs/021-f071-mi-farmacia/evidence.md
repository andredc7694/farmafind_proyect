# Evidencia F07.1

## T001–T002 · 2026-11-26
- Borradores en `sql-review/` (no se aplican solos): `007_platform_location_review.sql` (`6D7E0C11…3BB0F9`) y `008_opening_hours.sql` (`0A6EB089…26D2EBF`), con la matriz de 21 casos en `sql-review/README.md`. No se ejecutó nada: es una entrega de redacción para la revisión de Andre (T003).
- Comprobado leyendo el código: las coordenadas de las pruebas F07 están dentro de los límites del Perú; las tablas F01 usadas por `f071_policy` (`usuario`, `platform_role_assignment`) no tienen RLS; `sesion` y `usuario_farmacia` sí, de ahí sus dos políticas nuevas de solo lectura.
