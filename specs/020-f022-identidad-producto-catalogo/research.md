# Investigación (sobre el código actual, 2026-11-25)
- Unicidad actual: `medicamento_referencia_unica (nombre,concentracion,presentacion,clasificacion)`; texto en minúsculas por restricciones CHECK. La aplicación solo tiene SELECT del catálogo.
- `catalogKey` (`medicamentos/domain/medicamento.ts`) define la identidad que usan importación y revisión manual.
- La búsqueda pública usa `f03.search_public_offers` con columnas fijas: añadir columnas exige una función nueva.
- Reservas arman el nombre como `nombre concentracion presentacion` (`reservation-repository.ts`).
- Las capacidades delegables están repetidas en TypeScript (`staff-policy.ts`) y en SQL (`f01/012`, `f01/013`).
- `f025.has_capability` **no** exige segundo factor y vive en el esquema TEST de F02.5; por eso `CATALOG_REVIEW` se define en `f02` y exige `mfa_verificada_at`.
- Los hashes de F02.5 están fijados por revisión humana: solo se añade un archivo nuevo, nunca se edita uno existente.

# Investigación (sobre `main` `b0557d5`, 2026-11-27)
- La confirmación de importación (`ConfirmImport`) ya corre en **una transacción** con RLS y bloquea cada fila de inventario (`FOR UPDATE`); los conflictos se traducen en «importación no confirmable» sin cambios. El reemplazo D-08 cabe ahí sin SQL nuevo (el rol de la aplicación ya puede cambiar `cantidad_fisica` y registrar movimientos).
- `f02.inventario`: `cantidad_fisica >= cantidad_comprometida`; una fila con reservas abiertas no puede bajar a 0.
- Reservas y movimientos apuntan a (inventario, farmacia, producto): el inventario no puede cambiar de producto.
- Re-subir el mismo archivo funciona: `importacion_archivo_unico_idx` existe, pero la vista previa renueva la huella si la anterior no es reutilizable.
- Las incidencias guardan solo campo y código; no el texto de la fila.
- `can_inventory_action` admite DUENO, ADMINISTRADOR y TRABAJADOR con delegación; las capacidades delegables están repetidas en `f01/012`, `f01/013` y `staff-policy.ts` (motivo de P-01 A).
- `f01.sesion.mfa_verificada_at` (F01.2) permite exigir segundo factor en la base.
- `f03_projection_owner` tiene permiso por columnas sobre `f02.medicamento`: las columnas nuevas se le conceden en `f03/004` (las migraciones de F02 corren antes de que exista ese rol).
- `principio_activo` lo añade `f03/001`; las funciones PL/pgSQL de `f02/008` lo usan solo al ejecutarse, cuando ya existe.
- `scripts/f025/load-demo-catalog.mjs` usa `ON CONFLICT (nombre,concentracion,presentacion,clasificacion)`: hay que ajustarlo.
- El migrador F02 no verifica hashes (F03, F07 y F02.5 sí): se agrega para 007 y 008.
