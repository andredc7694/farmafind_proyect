# Investigación (sobre el código actual, 2026-11-25)
- Unicidad actual: `medicamento_referencia_unica (nombre,concentracion,presentacion,clasificacion)`; texto en minúsculas por restricciones CHECK. La aplicación solo tiene SELECT del catálogo.
- `catalogKey` (`medicamentos/domain/medicamento.ts`) define la identidad que usan importación y revisión manual.
- La búsqueda pública usa `f03.search_public_offers` con columnas fijas: añadir columnas exige una función nueva.
- Reservas arman el nombre como `nombre concentracion presentacion` (`reservation-repository.ts`).
- Las capacidades delegables están repetidas en TypeScript (`staff-policy.ts`) y en SQL (`f01/012`, `f01/013`).
- `f025.has_capability` **no** exige segundo factor y vive en el esquema TEST de F02.5; por eso `CATALOG_REVIEW` se define en `f02` y exige `mfa_verificada_at`.
- Los hashes de F02.5 están fijados por revisión humana: solo se añade un archivo nuevo, nunca se edita uno existente.
