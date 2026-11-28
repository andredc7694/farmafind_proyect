# Enmienda E-01 a la spec F03.1: lugares de «¿Dónde buscas?» (propuesta, pendiente de Andre)

**Fecha:** 2026-11-26
**Origen:** revisión de Andre en la copia temporal.
**Estado:** **propuesta**. No se programa la lista nueva hasta que Andre la apruebe.

## Por qué hace falta
La spec aprobada (F031-FR-002) dice que el lugar se elige de «la lista interna de F07.1». Andre pide tres cambios sobre esa lista:
- mostrar solo los 16 distritos de la provincia de Huamanga;
- dejar el resto del Perú desactivado por configuración;
- quitar los duplicados.

Eso cambia de dónde sale la lista. Además, esa lista (`frontend/src/geolocation/peru-cities.js`) **es la misma que usa «Mi farmacia» (F07.1)**.

## Efecto en «Mi farmacia» si se cambiara la lista compartida
- **Uso actual:** «Mi farmacia» usa la lista solo para **centrar el mapa** cuando el dueño escribe la ciudad (`LocationAdmin.changeCity`). No se guarda nada ni valida la ciudad: el dueño puede escribir cualquier ciudad.
- **Con solo los 16 distritos:** un dueño de fuera de Huamanga escribiría su ciudad y el mapa **ya no se centraría**. Tendría que mover el mapa a mano o usar «Buscar en el mapa».
- **Al quitar «Cuzco» y «Huamanga» como lugares propios:** al escribirlos, el mapa dejaría de centrarse, salvo que se conserven como sinónimos.
- **Pruebas afectadas:** una prueba de F07.1 (`frontend/tests/f071/sugerencias.test.jsx`) exige que estén todas las capitales departamentales.
- **Recomendación:** **no tocar «Mi farmacia» ahora** (opción A). Si más adelante se quiere el mismo criterio allí, se presenta como cambio aparte.

## Opciones
- **A) Recomendada: lista propia de la búsqueda; «Mi farmacia» no cambia.**
  - Nuevo `frontend/src/search/search-places.js` con los 16 distritos.
  - El resto del Perú (la lista de F07.1, sin duplicados) queda **desactivado por configuración**: no se borra.
  - `peru-cities.js` y «Mi farmacia» quedan exactamente igual.
- B) Cambiar la lista compartida para las dos pantallas. Tiene los efectos de la sección anterior y exige aprobar el cambio en «Mi farmacia».

## Detalle de la opción A
1. **Distritos activos por defecto:** los 16 de la provincia de Huamanga (tabla abajo). Cada uno centra el mapa en su capital y se usa como «Cerca de: {distrito} (aproximado)».
2. **Configuración:** `VITE_SEARCH_PLACES_SCOPE`.
   - Valores: `huamanga` (por defecto, si falta o es desconocido) o `peru`.
   - Con `peru` se suman las ciudades y los distritos de la lista de F07.1, sin duplicados.
   - Es configuración de compilación del frontend, sin servicios externos.
3. **Duplicados:**
   - «Cuzco» pasa a ser sinónimo de «Cusco», que se muestra una sola vez.
   - «Huamanga» deja de ser un lugar aparte. Al escribir «huamanga» aparece «Ayacucho», el distrito capital de la provincia de Huamanga. Esto vale en los dos alcances.
   - Si el alcance es `peru`, «Ayacucho» aparece una sola vez (se usa el centro del distrito de la tabla).
4. **Ciudad recordada:** si la ciudad guardada en el navegador no está en el alcance activo, se ignora y no se muestra.
5. **Spec:** F031-FR-002 pasa a decir «distrito o ciudad de la **lista interna de la búsqueda**: por defecto los 16 distritos de Huamanga; el resto del Perú, desactivado por configuración».
6. **Pruebas:**
   - Exactamente 16 lugares y sus nombres oficiales.
   - Sinónimos («huamanga» y «cuzco») y ausencia de duplicados con `peru`.
   - Alcance desconocido → `huamanga`.
   - Ciudad recordada fuera del alcance → se ignora.
   - Las de F07.1 sin cambios.

## Los 16 distritos (verificados)
| Ubigeo INEI | Distrito (nombre oficial) | Capital | Latitud | Longitud |
|---|---|---|---|---|
| 050101 | Ayacucho | Ayacucho | -13.1603 | -74.2253 |
| 050102 | Acocro | Acocro | -13.2186 | -74.0419 |
| 050103 | Acos Vinchos | Acos Vinchos | -13.1131 | -74.1000 |
| 050104 | Carmen Alto | Carmen Alto | -13.1794 | -74.2206 |
| 050105 | Chiara | Chiara | -13.2728 | -74.2058 |
| 050106 | Ocros | Ocros | -13.3906 | -73.9156 |
| 050107 | Pacaycasa | Pacaycasa | -13.0575 | -74.2158 |
| 050108 | Quinua | Quinua | -13.0492 | -74.1392 |
| 050109 | San José de Ticllas | Ticllas | -13.1322 | -74.3331 |
| 050110 | San Juan Bautista | San Juan Bautista | -13.1667 | -74.2236 |
| 050111 | Santiago de Pischa | San Pedro de Cachi | -13.0856 | -74.3933 |
| 050112 | Socos | Socos | -13.2150 | -74.2894 |
| 050113 | Tambillo | Tambillo | -13.1947 | -74.1106 |
| 050114 | Vinchos | Vinchos | -13.2417 | -74.3542 |
| 050115 | Jesús Nazareno | Las Nazarenas | -13.1542 | -74.2125 |
| 050116 | Andrés Avelino Cáceres Dorregaray | Jardín | -13.1628 | -74.2139 |

### Fuentes y límites
- **Códigos y nombres:** son los ubigeos INEI 050101 a 050116 de la provincia de Huamanga. Los documentos oficiales consultados son listados parciales:
  - SUNAT (Superintendencia 048-2000): de 050101 a 050108.
  - Anexo de la RM 183-2013-EF (MEF): 050115 Jesús Nazareno y el inicio de 050116. Este distrito lo creó la Ley 30013.
- **Coordenadas:** las de la capital de cada distrito, tomadas de un conjunto abierto que reúne los códigos INEI/RENIEC con la ubicación de la capital (`jmcastagnetto/ubigeo-peru-aumentado`).
  - **No es una descarga directa del INEI.** El INEI publica polígonos (GeoPackage), no un CSV de capitales.
  - Las coordenadas solo sirven para centrar el mapa y estimar la distancia: son aproximadas por diseño.
  - Se consultaron una sola vez durante el desarrollo. **La aplicación no llama a ningún servicio externo**: los datos quedan escritos en el código.
- **Nota sobre los nombres:** el buscador también encuentra «Santiago de Pischa» al escribir «san», porque empieza por «San». Al escribir «san» se ven los tres distritos que empiezan así.
