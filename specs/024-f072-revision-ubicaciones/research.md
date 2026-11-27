# Research — F07.2

## R-01 · Por qué reaparece la propuesta vieja
- `listLatestPending` usa `DISTINCT ON (farmacia_id)` sobre propuestas PENDIENTES: muestra la pendiente más reciente. Si la más nueva ya fue aprobada, la vieja pasa a ser «la más reciente pendiente».
- `isLatestPending` solo compara contra otras pendientes. El historial del dueño (`location-status.ts`) marca «Reemplazada» solo si la más nueva sigue pendiente.
- Aprobar la vieja falla hoy con «Ubicación pública cambió» porque `publish` exige `public_version = base_public_version` (control optimista): no hay riesgo de publicar coordenadas viejas.

## R-02 · Doble envío
- `LocationAdmin.jsx` ya desactiva el botón con `busy` durante la petición, pero tras el éxito deja el formulario lleno y habilitado. Con 4 s de diferencia, el segundo clic fue un reenvío tras el éxito.
- `setBusy(true)` es asíncrono: dos clics en el mismo instante podrían salir antes del nuevo render; se protege con `useRef`.
- En el servidor, `pg_advisory_xact_lock` serializa los envíos de una farmacia dentro de la transacción y se libera al terminar; es una función estándar ejecutable por cualquier rol, sin permisos nuevos.

## R-03 · Búsqueda limitada
- `NominatimGeocoder.search` envía `q="dirección, ciudad, Perú"`, `countrycodes=pe` y `limit=1`: es un sesgo, no un límite. Nominatim admite `viewbox=izq,arriba,der,abajo` y `bounded=1` para devolver solo resultados dentro del recuadro.
- El caso de HUAMANFAR (punto a 0,4 km del centro de Moquegua) es coherente con una coincidencia de calle en otra ciudad.

## R-04 · Distancia
- Haversine con radio 6371 km; HUAMANFAR aprobada → 571 km de Ayacucho.
- Lista interna: `peru-cities.js` (F07.1) + 16 distritos de Huamanga (`search-places.js`, F03.1 E-01). Sin servicios externos.
