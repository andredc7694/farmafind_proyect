-- F02.2 (spec 020) · PROPUESTA para revisión de Andre (NO aplicada). Destino tras la aprobación:
--   backend/migrations/f02/007_product_identity.sql (copia literal, verificada por SHA-256).
-- Identidad del producto con forma farmacéutica, laboratorio y marca (D-01 A, D-07 A).
-- No reescribe filas: las tres columnas nuevas entran vacías ('') en los productos existentes.
-- Única operación no aditiva: la unicidad (nombre,concentracion,presentacion,clasificacion) se
-- reemplaza por la identidad completa. El índice nuevo se crea ANTES de retirar el anterior, en la
-- misma transacción del migrador; con todas las filas en '' la identidad nueva sigue siendo única.

ALTER TABLE f02.medicamento
  ADD COLUMN forma_farmaceutica text NOT NULL DEFAULT ''
    CONSTRAINT medicamento_forma_lista CHECK (forma_farmaceutica IN ('', 'tableta', 'capsula', 'jarabe',
      'suspension', 'solucion', 'gotas', 'crema', 'gel', 'unguento', 'inyectable', 'supositorio', 'ovulo',
      'sobre', 'parche', 'spray', 'inhalador')),
  ADD COLUMN laboratorio text NOT NULL DEFAULT ''
    CONSTRAINT medicamento_laboratorio_normalizado CHECK (char_length(laboratorio) <= 120
      AND laboratorio = regexp_replace(lower(btrim(laboratorio)), '\s+', ' ', 'g')),
  ADD COLUMN marca text NOT NULL DEFAULT ''
    CONSTRAINT medicamento_marca_normalizada CHECK (char_length(marca) <= 120
      AND marca = regexp_replace(lower(btrim(marca)), '\s+', ' ', 'g'));

ALTER TABLE f02.medicamento ADD CONSTRAINT medicamento_identidad_unica
  UNIQUE (nombre, concentracion, presentacion, forma_farmaceutica, clasificacion, laboratorio, marca);
ALTER TABLE f02.medicamento DROP CONSTRAINT medicamento_referencia_unica;

-- Búsqueda del producto «sin laboratorio» equivalente al reemplazar inventario (D-08 A).
CREATE INDEX medicamento_generico_idx ON f02.medicamento (nombre, concentracion, presentacion, clasificacion);

-- La aplicación solo LEE el catálogo; nadie de la aplicación obtiene escritura.
GRANT SELECT (forma_farmaceutica, laboratorio, marca) ON f02.medicamento TO f01_runtime;

-- Columnas opcionales del archivo que pueden tener incidencias (D-02 A: código repetido = FILA_DUPLICADA).
ALTER TABLE f02.importacion_incidencia DROP CONSTRAINT importacion_incidencia_campo_destino_check;
ALTER TABLE f02.importacion_incidencia ADD CONSTRAINT importacion_incidencia_campo_destino_check
  CHECK (campo_destino IN ('nombre', 'concentracion', 'presentacion', 'clasificacion', 'precioReferencial',
    'cantidadFisica', 'farmaciaId', 'codigo', 'laboratorio', 'marca', 'formaFarmaceutica', 'principioActivo'));
