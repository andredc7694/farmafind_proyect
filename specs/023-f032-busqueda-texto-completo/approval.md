# Aprobaciones F03.2 — Búsqueda con texto completo

## 2026-11-27 · Pedido de Andre
- Corrección prioritaria: que la búsqueda entienda textos que juntan nombre, concentración y presentación; que no importen tildes, mayúsculas ni espacios entre número y unidad; que ninguna sugerencia lleve a una búsqueda vacía (con prueba automática); y que, sin coincidencia exacta, se muestren otras presentaciones con un aviso.
- Rama propia desde `main` `288d72a`, con SDD. Pasar a `ESTADO.md` las notas de `.cache/estado-pendiente.md` (hecho en esta rama).
- Reglas: revisar specs F03 y F03.1, Constitution y ADR antes de programar. Si cambia SQL, índices, contrato o caché: enmienda, plan y SQL para aprobar; no aplicar nada antes. No cambiar qué se publica. US$0, sin servicios ni librerías nuevas sin consultar. Medir con los 518 productos de HUAMANFAR. Mostrar en la copia 3001/5174 con datos ficticios. No tocar la DEMO, su base ni su Redis.

## Pendiente (resuelto el 2026-11-27)
- Aprobación de `spec.md` y de las decisiones D-01 a D-05.

## 2026-11-27 · Spec aprobada
- Andre: «Apruebo la spec de la búsqueda con texto completo (commit e4c6116) con las cinco decisiones en A (D-01 a D-05)».
- Condiciones:
  - D-01: presentar el SQL de la función nueva antes de aplicarlo; migración nueva, sin editar SQL aprobado y sin extensiones.
  - D-04: la base restaurada desde la copia de seguridad de la DEMO va solo en el servidor de pruebas, sin publicar puertos nuevos ni copiar sus datos fuera de `.cache`. Se borra al terminar y se le confirma. La DEMO no se toca.
  - Agregar a la spec: si se busca solo una presentación o concentración sin nombre («tabletas», «500 mg»), mostrar la ayuda «Escribe también el nombre del medicamento, por ejemplo: paracetamol 500 mg». Hecho como **F032-FR-013**; no exige enmendar otra spec (es un estado vacío explícito, compatible con F03-FR-002, y viaja en el campo `coincidencia` ya aprobado en D-03).
- Siguiente: plan, tasks y SQL para su aprobación antes de aplicar nada.

## Pendiente
- Aprobación de `plan.md`, `tasks.md` y del SQL de `sql/`.
