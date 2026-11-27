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


## 2026-11-27 · Plan y tasks aprobados; SQL aprobado con correcciones
- Andre: «Apruebo el plan y las tareas de F03.2 (commit 6d90f9d)». El SQL, con dos correcciones en el borrador antes de aplicarlo:
  1. `hay_nombre` y `hay_todo` con `concat_ws(' ', …)` en lugar de `||`, para que una concentración o presentación en NULL no anule el texto. Con prueba de un producto sin presentación y otro sin concentración.
  2. En `normalize_search_text`, también las mayúsculas con tilde en el `translate` (o demostrar que `lower()` las convierte). Prueba de «ÁCIDO», «Ácido» y «acido» en la base real.
  - Prueba adicional: palabras de una sola letra o muy cortas no devuelven todo el catálogo.
- Hecho en el borrador (commit `1b2e100`); además, la función ignora palabras de menos de 2 letras. Nuevos SHA-256 (texto con LF):
  - `sql/f03_003_search_terms.sql`: `374AEED785DA2AFB2C73A82406857D2C5F3B28B6E730C13F782707B6058BD922`
  - `sql/f07_010_search_terms_location.sql`: `C5F0D8F990767E2DC37DCB3C0A02665B946533DF449DAB48E572882256BB873B`
- Autoriza encender el contenedor del servidor de pruebas para T011, y encender la DEMO con `demo-run.ps1` sin borrar datos, verificando en solo lectura que siguen intactos. **Nada de F03.2 se aplica en la base de la DEMO.**
- Siguiente: mostrarle el SQL corregido y su hash **antes** de copiarlo a `backend/migrations`.


## 2026-11-27 · Visto bueno al SQL
- Andre: «Doy visto bueno a los dos SQL de F03.2 con estos hashes: f03_003_search_terms.sql 374AEED785DA2AFB2C73A82406857D2C5F3B28B6E730C13F782707B6058BD922 y f07_010_search_terms_location.sql C5F0D8F990767E2DC37DCB3C0A02665B946533DF449DAB48E572882256BB873B (commit 1b2e100)».
- Instrucciones: copiarlos sin cambios a `backend/migrations` y registrarlos en las listas cerradas de hashes; probarlos primero en una base efímera y, si hay error, detenerse y mostrar la corrección con hash nuevo sin editar los aprobados; seguir con T002, T003, la medición T011 (base temporal restaurada desde la copia y borrada al terminar) y la copia 3001/5174 para su revisión.
- **Nada se aplica en la base de la DEMO hasta su aceptación.** El reinicio será al final, con copia de seguridad antes y aviso previo.

## 2026-11-27 · Velocidad: opción A (SQL optimizado)
- Andre: «Opción A: muéstrame el SQL optimizado con su hash». Prefiere corregir los mismos `f03/003` y `f07/010` (aún no están en `main` ni en la DEMO) si la Constitution lo permite, registrando el cambio de hash y el motivo; pide demostrar resultados idénticos (mismas filas y mismo orden) sobre la base restaurada, incluidas las 15 sugerencias, «ÁCIDO», «paracetamol 500 mg tabletas x 10» y palabras cortas, repetir la medición con unas 5000 ofertas sintéticas y anotar la opción C como mejora futura junto con la spec 020.
- Respuesta: la Constitution lo permite (ver `evidence.md`). **Cambio de hash propuesto** (motivo: rendimiento; mismos resultados):
  - `f03_003_search_terms.sql`: `374AEED785DA2AFB2C73A82406857D2C5F3B28B6E730C13F782707B6058BD922` → `FDCBBD7F0A7381D7C9A8700406C3A0D4C4CF84384E85B50C10AC4736E003E5BB`
  - `f07_010_search_terms_location.sql`: `C5F0D8F990767E2DC37DCB3C0A02665B946533DF449DAB48E572882256BB873B` → `005D52E14820CEA02DC431AE9B8CFD1240B5BB8305D753B39A43CF5F5E1A3F6D`


## 2026-11-27 · Visto bueno a la v2
- Andre: «Doy visto bueno a los hashes v2 de F03.2: f03_003_search_terms.sql FDCBBD7F0A7381D7C9A8700406C3A0D4C4CF84384E85B50C10AC4736E003E5BB y f07_010_search_terms_location.sql 005D52E14820CEA02DC431AE9B8CFD1240B5BB8305D753B39A43CF5F5E1A3F6D (commit d588b8f)».
- Se reemplazaron los archivos de `backend/migrations` y las listas cerradas. **La v1 se reemplazó porque nunca llegó a `main` ni a la DEMO.**
- Instrucciones: repetir en base efímera las pruebas de PostgreSQL real, la comparación v1/v2 y la regresión completa (si algo falla, detenerse); actualizar la copia temporal a la v2 y avisar. Nada en la base de la DEMO hasta su aceptación; el reinicio será al final, con copia de seguridad y aviso previo.
