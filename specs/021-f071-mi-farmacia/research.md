# Research: F07.1

## R-01 · Qué existe hoy (lectura del código, 2026-11-26)
- **Ubicación (F07):** propuesta y revisión por farmacia (`GEO_LOCATION_PROPOSE` y `GEO_LOCATION_REVIEW` en `f07.can_location_action`, que exige `app.farmacia_id` y una delegación local). Publicación en `f03.farmacia_publica` con igualdad exacta con la propuesta y versión pública. CHECK: quien propone ≠ quien revisa.
- **F02.5** crea `f03.farmacia_publica` con la dirección de la solicitud, pero no concede permisos GEO. Ninguna cuenta de la DEMO los tiene.
- **Contacto:** la 014 (`pharmacy.profile.read/write`, versión y auditoría), visible solo en `/inventory`.
- **«Mi perfil»** (`Profile.jsx`, `/me/profile`): disponible para toda sesión normal, dentro de un desplegable.
- **Migraciones de F07:** se aplican solas, leyendo la carpeta `backend/migrations/f07`. Por eso los SQL nuevos de F07 solo se escriben tras la aprobación del plan.

## R-02 · Por qué una tabla propia para la concesión de plataforma (D-01 A)
`f025.platform_capability_grant` limita sus códigos con un CHECK aprobado, y `f025.has_capability` enumera solo los cinco de F025. Ampliarlos cambiaría lo aprobado de F02.5. Una tabla F07.1 con el mismo patrón (rol de plataforma activo, concesión activa, aprobación y auditoría) evita ese cambio.

## R-03 · Reemplazo de propuestas sin tocar F07 (D-04 A)
El CHECK de `estado` no admite «REEMPLAZADA». Se calcula al leer, y la decisión de plataforma solo se permite sobre la última PENDIENTE. La comprobación `base_public_version = public_version - 1` de la 005 ya impide publicar propuestas basadas en una versión antigua.

## R-04 · Ubicación del dispositivo
La API Geolocation del navegador con `getCurrentPosition` y `maximumAge: 0`, una vez y tras un clic, sin `watchPosition`. Solo rellena el pin; no se envía nada hasta que el propietario confirma.

## R-05 · Horario fuera de la búsqueda
La spec 020 prevé una `search_public_offers_v2`. Para no chocar, el horario se sirve con una función pública aparte, por lista de farmacias, con caché Redis.

## R-06 · Decisión 2026-11-26: Nominatim solo para sugerir la dirección del formulario (enmienda aprobada)
- **Servicio nuevo y gratuito:** Nominatim de OpenStreetMap (https://nominatim.openstreetmap.org), sin clave ni pago. Su política de uso exige como máximo 1 consulta por segundo, un User-Agent identificable, caché, sin autocompletado y la atribución ODbL. No garantiza disponibilidad.
- **Respaldo:** la lista interna de ciudades centra el mapa aunque el servicio falle o esté apagado; el pin, el GPS y las coordenadas siguen disponibles.
- **Privacidad:** solo salen la dirección y la ciudad escritas, o el punto, desde el servidor; nada se guarda en registros.
- **Producción:** apagado por defecto; se revisa junto con Andre en F09 (volumen, política, posible instancia propia o proveedor alternativo).
