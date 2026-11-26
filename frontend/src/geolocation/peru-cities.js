/**
 * F071-FR-015: lista interna (sin servicio externo) para centrar el mapa al escribir la ciudad.
 * Coordenadas aproximadas del centro: todas las capitales departamentales, el Callao, ciudades
 * grandes y distritos de Lima. Solo centran el mapa; nunca fijan el punto ni se publican.
 */
export const PERU_PLACES = [
  // Capitales departamentales y Callao
  ['Chachapoyas', -6.2317, -77.869], ['Huaraz', -9.5278, -77.5278], ['Abancay', -13.6339, -72.8814],
  ['Arequipa', -16.3989, -71.535], ['Ayacucho', -13.1588, -74.2239], ['Huamanga', -13.1588, -74.2239],
  ['Cajamarca', -7.1638, -78.5003], ['Callao', -12.0566, -77.1181], ['Cusco', -13.532, -71.9675], ['Cuzco', -13.532, -71.9675],
  ['Huancavelica', -12.7861, -74.9759], ['Huánuco', -9.9306, -76.2422], ['Ica', -14.0678, -75.7286],
  ['Huancayo', -12.0651, -75.2049], ['Trujillo', -8.1116, -79.0288], ['Chiclayo', -6.7714, -79.8409],
  ['Lima', -12.0464, -77.0428], ['Iquitos', -3.7437, -73.2516], ['Puerto Maldonado', -12.5933, -69.1891],
  ['Moquegua', -17.1983, -70.9357], ['Cerro de Pasco', -10.6864, -76.2625], ['Piura', -5.1945, -80.6328],
  ['Puno', -15.8402, -70.0219], ['Moyobamba', -6.0342, -76.9717], ['Tacna', -18.0066, -70.2463],
  ['Tumbes', -3.5669, -80.4515], ['Pucallpa', -8.3791, -74.5539],
  // Otras ciudades grandes
  ['Juliaca', -15.5, -70.1333], ['Chimbote', -9.0745, -78.5936], ['Tarapoto', -6.4882, -76.3597],
  ['Sullana', -4.9039, -80.6853], ['Huacho', -11.1067, -77.605], ['Chincha Alta', -13.4099, -76.1323],
  ['Pisco', -13.7103, -76.2035], ['Talara', -4.5772, -81.2719], ['Jaén', -5.7083, -78.8083],
  ['Ilo', -17.6394, -71.3375], ['Tingo María', -9.2953, -75.9978],
  // Distritos de Lima Metropolitana
  ['Miraflores', -12.1211, -77.0297], ['San Isidro', -12.0977, -77.0365], ['Santiago de Surco', -12.1452, -76.9914],
  ['Surco', -12.1452, -76.9914], ['San Borja', -12.106, -77.001], ['Barranco', -12.1497, -77.0213],
  ['San Miguel', -12.0773, -77.0846], ['Los Olivos', -11.9592, -77.0703], ['Comas', -11.9333, -77.05],
  ['San Juan de Lurigancho', -11.9969, -77.0024], ['Ate', -12.026, -76.92], ['La Molina', -12.079, -76.942],
  ['Jesús María', -12.0758, -77.0444], ['Lince', -12.0844, -77.0336], ['Magdalena del Mar', -12.0912, -77.0711],
  ['Pueblo Libre', -12.0739, -77.0631], ['Breña', -12.0573, -77.0525], ['Chorrillos', -12.1689, -77.0153],
  ['Villa El Salvador', -12.2128, -76.9375], ['Villa María del Triunfo', -12.1639, -76.9419],
  ['San Juan de Miraflores', -12.1564, -76.9711], ['San Martín de Porres', -12.01, -77.06],
  ['Independencia', -11.9917, -77.0511], ['Carabayllo', -11.8667, -77.0333], ['Puente Piedra', -11.8667, -77.0767],
  ['Rímac', -12.0333, -77.0333], ['La Victoria', -12.065, -77.0311], ['Surquillo', -12.1167, -77.0167],
  ['Santa Anita', -12.0431, -76.9711], ['El Agustino', -12.0425, -76.9997], ['Lurín', -12.2747, -76.8708],
  ['Chaclacayo', -11.9772, -76.7681], ['Bellavista', -12.0617, -77.1083], ['Ventanilla', -11.8758, -77.1278],
].map(([name, latitude, longitude]) => ({ name, latitude, longitude }));

const normalize = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
const index = new Map(PERU_PLACES.map(place => [normalize(place.name), place]));

/** Busca la ciudad o distrito exacto (sin tildes ni mayúsculas). Devuelve null si no está en la lista. */
export function findPeruPlace(name) {
  return index.get(normalize(name)) ?? null;
}
