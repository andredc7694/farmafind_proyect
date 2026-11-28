import { normalizeSearchText } from '../../busqueda/contracts/public-search-text.js';

/**
 * F06.2: copia de la lista activa de «¿Dónde buscas?» (16 distritos de Huamanga, `frontend/src/search/search-places.js`).
 * Una prueba de paridad compara nombres y centros con la pantalla. El centro solo sirve para ordenar por cercanía.
 */
export interface AssistantPlace { readonly name: string; readonly latitude: number; readonly longitude: number }

export const ASSISTANT_PLACES: readonly AssistantPlace[] = Object.freeze(([
  ['Ayacucho', -13.1603, -74.2253], ['Acocro', -13.2186, -74.0419], ['Acos Vinchos', -13.1131, -74.1000],
  ['Carmen Alto', -13.1794, -74.2206], ['Chiara', -13.2728, -74.2058], ['Ocros', -13.3906, -73.9156],
  ['Pacaycasa', -13.0575, -74.2158], ['Quinua', -13.0492, -74.1392], ['San José de Ticllas', -13.1322, -74.3331],
  ['San Juan Bautista', -13.1667, -74.2236], ['Santiago de Pischa', -13.0856, -74.3933], ['Socos', -13.2150, -74.2894],
  ['Tambillo', -13.1947, -74.1106], ['Vinchos', -13.2417, -74.3542], ['Jesús Nazareno', -13.1542, -74.2125],
  ['Andrés Avelino Cáceres Dorregaray', -13.1628, -74.2139],
] as const).map(([name, latitude, longitude]) => Object.freeze({ name, latitude, longitude })));

/** Sinónimos de la pantalla: «huamanga» → distrito Ayacucho. «Andrés Avelino Cáceres» también se reconoce corto. */
const ALIASES: Readonly<Record<string, string>> = { huamanga: 'Ayacucho', 'andres avelino caceres': 'Andrés Avelino Cáceres Dorregaray' };

/** Distritos que el asistente ofrece como botones cuando falta el lugar (≤ 5, los más poblados de Huamanga). */
export const PLACE_CHOICES = ['Ayacucho', 'Carmen Alto', 'San Juan Bautista', 'Jesús Nazareno', 'Andrés Avelino Cáceres Dorregaray'];

const key = (value: string) => normalizeSearchText(value);
const BY_KEY = new Map<string, AssistantPlace>(ASSISTANT_PLACES.map(place => [key(place.name), place]));
for (const [alias, target] of Object.entries(ALIASES)) BY_KEY.set(alias, BY_KEY.get(key(target))!);
const KEYS_LONGEST_FIRST = [...BY_KEY.keys()].sort((a, b) => b.length - a.length);

export function placeByName(name: unknown): AssistantPlace | null {
  return typeof name === 'string' ? BY_KEY.get(key(name)) ?? null : null;
}

/** Busca un distrito dentro de un texto ya normalizado; devuelve el lugar y el texto sin ese nombre. */
export function findPlaceIn(normalized: string): { readonly place: AssistantPlace | null; readonly rest: string } {
  const padded = ` ${normalized} `;
  for (const candidate of KEYS_LONGEST_FIRST) {
    const index = padded.indexOf(` ${candidate} `);
    if (index >= 0) {
      return { place: BY_KEY.get(candidate)!, rest: `${padded.slice(0, index)} ${padded.slice(index + candidate.length + 2)}`.trim().replace(/\s+/g, ' ') };
    }
  }
  return { place: null, rest: normalized };
}
