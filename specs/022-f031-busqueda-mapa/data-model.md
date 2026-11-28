# Modelo de datos F03.1

Sin tablas, columnas, migraciones ni políticas nuevas.

## API pública (enmienda D-01 A)
`PublicOffer.farmacia` pasa a ser `PublicOfferPharmacy`:

| Campo | Tipo | Regla |
|---|---|---|
| id, nombre, direccion | igual que antes | sin cambios |
| ubicacion | `{latitud:number, longitud:number}` \| `null` | Solo si la farmacia tiene la ubicación verificada **y** la composición tiene F07 activo. En otro caso, `null` |

La ficha `/farmacias/{id}` (`PublicPharmacy`) no cambia.

## Navegador
| Dato | Dónde | Contenido | Cuándo |
|---|---|---|---|
| Filtros recordados | `localStorage` (clave existente) | Precio mínimo y máximo, y orden | Solo con «Recordar filtros» |
| Ciudad recordada | `localStorage` (clave nueva `farmafind.search.city`) | `{nombre}` de `PERU_PLACES` | Solo con «Recordar la ciudad» |
| Ubicación de búsqueda | Memoria | Origen, etiqueta y punto redondeado a 3 decimales | Hasta cerrar o cambiar la página |
