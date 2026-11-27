# Evidencia F03.1

## T001–T004 · 2026-11-26 (servidor y contrato, sin puertos)
- **T001:** `PgPublicOfferRepository` devuelve `farmacia.ubicacion` con `{latitud, longitud}` solo si:
  - la función de búsqueda trae ambas coordenadas (la versión F07 las devuelve únicamente con `PUBLICADA_VERIFICADA`);
  - la opción `exposeVerifiedLocation` está activa.
  - En cualquier otro caso devuelve `null`. La composición activa esa opción solo con `config.geolocationTest === true`.
  - Se creó el tipo `PublicOfferPharmacy`. La ficha `/farmacias/{id}` no cambia.
- **T002:** `validCached` exige la forma nueva (`ubicacion`: `null` o `{latitud, longitud}` numéricos, sin claves extra).
- **T003:** una entrada vieja de la caché, sin `ubicacion`, se registra como `invalid`, se recalcula una vez y se reescribe con la forma nueva, sin error. Las entradas nuevas (`null` o con coordenadas) cuentan como acierto, y las formas inválidas se descartan.
- **T004:** `check-openapi-routes` y `public-contract.test.ts` leen `specs/022-f031-busqueda-mapa/contracts/public-search.openapi.yaml`, versión 0.2.0. La prueba comprueba `PublicOfferPharmacy`, la `ubicacion` nullable y que la ficha sigue con `PublicPharmacy`. También prohíbe campos internos (estado de ubicación, autores, teléfono, RUC).
- **Pruebas:**
  - `backend/tests/search`: 36 correctas y 12 omitidas por necesitar base de datos. Incluye 5 nuevas en `f031-location.test.ts`.
  - Backend completo: 620 correctas antes de las pruebas nuevas; los dos únicos fallos son los de F06.1 por entorno, ya conocidos.
  - `verify:contracts`: 41 operaciones. `check` correcto.
- **Configuración necesaria en la DEMO (pregunta de Andre):**
  - La API no detecta F07: lo decide la **configuración** `geolocationTest: true` en la composición.
  - `scripts/f025/demo-serve.mjs` ya la pone en `true` siempre que la búsqueda esté configurada, es decir, cuando existe `.cache/f03-docker/redis-password.txt`, como en la DEMO actual.
  - Además, la DEMO ya tiene aplicada la migración `f07/003`, la versión de la función que filtra por verificación.
  - No hace falta ningún valor nuevo.
