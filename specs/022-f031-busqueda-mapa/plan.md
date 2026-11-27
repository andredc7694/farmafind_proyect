# Plan: F03.1 — Búsqueda simplificada y mapa interactivo

**Spec**: [spec.md](spec.md), aprobada el 2026-11-26 con D-01 a D-08 en A y las condiciones registradas en [approval.md](approval.md).
**Estado**: **aprobado por Andre el 2026-11-26.**

## Resumen técnico
Este cambio es casi todo de pantalla. En el servidor solo se toca la API pública de búsqueda: se agrega `farmacia.ubicacion` a cada oferta. **No hay SQL, migraciones, RLS, cambios de TTL ni de claves de caché, ni librerías nuevas.**

## Contexto técnico
- **Frontend:** React/Vite/JSX y Leaflet 1.9.4, que ya está instalado. Se reutilizan:
  - `PointPicker` para elegir en el mapa.
  - `peru-cities.js` como lista interna de lugares.
  - `usePublicOpeningHours` y `limaIsoDay` para el horario.
  - `SuggestBox` y `filters-state.js`.
- **Backend:** Express/TS, módulo `busqueda`, con la Clean Architecture actual.
- **Pruebas:**
  - Vitest con jsdom y un Leaflet falso, sin red.
  - PostgreSQL efímero del clúster de pruebas.
  - Playwright en la copia temporal, con las teselas bloqueadas.

## Servidor (D-01 A, con las condiciones de Andre)
1. **Contrato:** la versión enmendada vive en [contracts/public-search.openapi.yaml](contracts/public-search.openapi.yaml) (0.2.0).
   - Cambio único: la oferta usa `PublicOfferPharmacy` = `id`, `nombre`, `direccion` y **`ubicacion` (`{latitud, longitud}` o `null`)**.
   - La ficha `/farmacias/{id}` no cambia: sigue con `PublicPharmacy`.
   - La carpeta 004 aprobada **no se edita**. El verificador de rutas y la prueba de contrato pasan a leer el archivo de la 022.
2. **Fuente del dato:** ya lo da `f03.search_public_offers` en su versión F07 (`f07/003`), que devuelve coordenadas **solo si `estado_ubicacion='PUBLICADA_VERIFICADA'`** y NULL en el resto.
   - El repositorio arma `ubicacion` únicamente si ambas coordenadas vienen informadas.
3. **Guarda contra bases sin F07:** si la base solo tiene la función de F03 (`002`), esa función no filtra por verificación. Para ese caso:
   - `PgPublicOfferRepository` recibe la opción `exposeVerifiedLocation`, que la composición enciende solo con la geolocalización F07 activa (`config.geolocationTest`, el mismo requisito de las rutas F07).
   - Con la opción apagada, `ubicacion` va siempre en `null`.
   - Así ninguna farmacia sin verificar puede salir con coordenadas.
4. **Caché:** `validCached` exige la forma nueva (`farmacia` con `ubicacion`, y `null` permitido).
   - Una entrada vieja, sin `ubicacion`, se marca `invalid` en las métricas, se recalcula y se reescribe sin error. Hay una prueba específica.
   - No cambian el TTL, la generación ni las claves.
5. **Distancia:** se sigue calculando solo con coordenadas verificadas (comportamiento actual), redondeada al mostrarla.

## Pantalla
| Pieza | Archivo | Qué hace |
|---|---|---|
| Página | `frontend/src/search/PublicSearch.jsx` (reescrito) | Buscador grande, línea de ubicación, botones rápidos de orden, «Filtros», interruptor Lista \| Mapa y paginación |
| Diálogo | `frontend/src/search/WhereDialog.jsx` (nuevo) | `<dialog>` modal con «Usar mi ubicación» (una lectura), un campo de lugar con sugerencias de `PERU_PLACES` y «Elegir en el mapa» (`PointPicker`). Foco atrapado, Escape y casilla «Recordar la ciudad» |
| Ubicación | `frontend/src/search/search-location.js` (nuevo) | Redondea a 3 decimales (D-06) y guarda o recupera **solo el nombre** de la ciudad (D-05), con try/catch |
| Horario | `frontend/src/search/today-hours.js` (nuevo) | «Abierto hasta HH:MM», «Abre a las HH:MM», «Cerrado ahora», «Cerrado hoy» u «Horario no publicado», en hora de Lima |
| Tarjeta | `frontend/src/search/OfferCard.jsx` (nuevo) | Farmacia, producto, precio, distancia, horario, dirección, fecha, «Comparar» discreto (D-04), «Reservar» y «Ubicación no verificada» |
| Mapa | `frontend/src/search/ResultsMap.jsx` (nuevo) | Ver el detalle debajo |
| Filtros | `filters-state.js` (se amplía) | Otros órdenes (D-03) dentro de «Filtros». Lo que ya existe no cambia |

**Detalle del mapa (`ResultsMap.jsx`):**
- Carga Leaflet solo al elegir «Mapa».
- Marcadores `L.divIcon` propios: una cruz verde con el precio, hecha en CSS.
- El texto alternativo se pone con `setAttribute`. Los nombres de las farmacias **nunca** se insertan como HTML.
- Los marcadores se pueden usar con el teclado (`keyboard: true`).
- La tarjeta emergente se construye con nodos DOM.
- El círculo del usuario se dibuja sin usarse para encuadrar: el mapa se ajusta solo a las farmacias, como ya hace F07.
- Selección compartida con la lista.

**Diseño de pantalla:**
- En escritorio con «Mapa», el mapa y la lista se ven lado a lado (D-07).
- En pantallas de 700 px o menos se ve una sola vista.
- El enlace a `/search/mapa` se quita de la búsqueda, pero la ruta sigue existiendo (D-08).

## Constitution
- **Stack:** se cumple.
- **Seguridad y RLS:** sin cambios. Solo se publican datos que F07 ya hace públicos.
- **Costo:** US$0.
- **Privacidad:**
  - La ubicación no se guarda; solo la ciudad, si el usuario lo pide.
  - La ubicación se redondea a unos 100 m.
  - El mapa se carga bajo pedido.
- **Continuidad:**
  - Se conservan el orden por disponibilidad y la dirección textual si falla el mapa.
  - Accesibilidad F08.
- **SDD:** se cumple.

## Riesgos
- jsdom no implementa `<dialog>.showModal`: se usa un polyfill mínimo solo en las pruebas.
- Teselas de OSM en producción: se revisan en F09. En TEST/DEMO se cargan solo al pedirlas.
- La caché compartida entre procesos con versiones distintas: las entradas viejas se descartan solas (prueba en T003).

## Dependencias y orden
T001–T004 (servidor y contrato) → T005–T011 (pantalla) → T012–T015 (base de datos, E2E en la copia y regresión) → T016 (copia para Andre) → T017–T018 (cierre y aceptación).
