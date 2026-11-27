# Aceptación F03.1 — Búsqueda simplificada y mapa interactivo

**Decisión de Andre (2026-11-26): ACEPTO CON OBSERVACIONES.**

> «ACEPTO CON OBSERVACIONES F03.1 (búsqueda simplificada, mapa interactivo y enmienda E-01 opción A con los 16 distritos de Huamanga). Lo revisé en la copia temporal.»

- **Alcance aceptado:**
  - Buscador simplificado, línea de ubicación y diálogo «¿Dónde buscas?».
  - «Más barato» y «Más cercano», y el panel «Filtros».
  - Tarjetas con el horario de hoy y «Reservar».
  - Interruptor Lista | Mapa, con marcadores propios conectados a la lista.
  - `farmacia.ubicacion` en la API (solo farmacias verificadas y con F07 activo).
  - Enmienda E-01, opción A: 16 distritos de Huamanga por defecto y el resto del Perú desactivado por configuración.
- **Probado por Andre** en la copia temporal (3001/5174), con datos ficticios.
- **Observación (no bloquea, fuera de F03.1):**
  - Las sugerencias marcadas «presentación» (por ejemplo, «paracetamol 500 mg tabletas x 10») llevan a una búsqueda con 0 resultados, porque la búsqueda compara el texto completo.
  - Queda registrada como **corrección pendiente prioritaria**, sin empezar:
    - que la búsqueda encuentre resultados cuando el texto junta nombre, concentración y presentación;
    - que ninguna sugerencia del propio buscador lleve a una búsqueda vacía.
- **Para F09 (antes de cualquier despliegue real):** revisar `geolocationTest`, `VITE_SEARCH_PLACES_SCOPE` y el uso de imágenes de OpenStreetMap.
- F02.5 sigue sin aceptar (T057 y T063 sin marcar) y la spec 020 sigue en opción A.
