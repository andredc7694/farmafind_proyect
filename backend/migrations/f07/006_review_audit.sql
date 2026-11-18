-- Persist review evidence and allow tenant-scoped proposal version capture.
ALTER TABLE f07.ubicacion_auditoria
  ADD COLUMN evidencia_confirmada boolean,
  ADD COLUMN motivo text CHECK (motivo IS NULL OR char_length(motivo) BETWEEN 1 AND 500),
  ADD CONSTRAINT ubicacion_auditoria_evidencia CHECK (
    (accion='PROPUESTA' AND evidencia_confirmada IS NULL) OR
    (accion='APROBACION' AND evidencia_confirmada IS TRUE) OR
    (accion='RECHAZO' AND evidencia_confirmada IS NOT NULL));
GRANT INSERT (base_public_version) ON f07.ubicacion_propuesta TO f01_runtime;
GRANT INSERT (evidencia_confirmada,motivo) ON f07.ubicacion_auditoria TO f01_runtime;
