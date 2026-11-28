# Aceptación F03.2 — Búsqueda con texto completo

**Decisión de Andre (2026-11-27): ACEPTO.**

> «ACEPTO F03.2 (búsqueda con texto completo, v2 optimizada). Lo revisé en la copia temporal.»

- **Alcance aceptado:**
  - La búsqueda entiende textos que juntan nombre, concentración y presentación («paracetamol 500 mg tabletas x 10», «paracetamol 500», «amoxicilina capsulas», «ibuprofeno 400mg»), con los más parecidos primero.
  - No importan tildes, mayúsculas ni el espacio entre número y unidad.
  - Si no hay coincidencia exacta, se muestran las otras presentaciones con el aviso «No encontramos esa presentación exacta; estas son otras disponibles».
  - Si solo se escribe presentación o concentración, aparece la ayuda «Escribe también el nombre del medicamento, por ejemplo: paracetamol 500 mg» (FR-013).
  - Ninguna sugerencia lleva a una búsqueda vacía (prueba automática en memoria y con PostgreSQL real).
  - Migraciones `f03/003` y `f07/010` en su **v2 optimizada** (hashes `FDCBBD7F…E5BB` y `005D52E1…3F6D`), contrato 0.3.0 (`coincidencia`) y caché `v2`.
- **Probado por Andre** en la copia temporal (3001/5174) con datos ficticios.
- **Medición:** p95 ≤ 10 ms con 518 ofertas y ≤ 19 ms con 5180 (meta ≤ 100 ms). Con 518 ofertas queda un costo fijo de unos 6 ms frente a la búsqueda anterior; con 5180 ya es más rápida que la anterior.
- **Pendiente tras la aceptación:** PR y merge a `main`; luego, con aviso previo y copia de seguridad, reiniciar la DEMO para aplicar `f03/003` y `f07/010`.
- **Mejora futura (sin empezar):** opción C, guardar el texto limpio en el catálogo, para evaluar con la spec 020.
- F02.5 sigue sin aceptar (T057 y T063 sin marcar) y la spec 020 sigue en opción A.
