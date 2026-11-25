/** F08.1: el estado de la búsqueda vive en la URL (compartible, sin datos personales). La ubicación nunca se guarda. */
const KEYS = { q: 'q', minimum: 'min', maximum: 'max', order: 'orden' };
const ORDERS = ['relevancia', 'precio_asc', 'precio_desc', 'disponibilidad', 'cercania'];
const STORAGE_KEY = 'ff-filters';

export function parseFilters(search = '') {
  const params = new URLSearchParams(search);
  const number = value => (value !== null && /^\d+(\.\d{1,2})?$/.test(value) ? value : '');
  const order = params.get(KEYS.order);
  return { query: (params.get(KEYS.q) ?? '').slice(0, 120), minimum: number(params.get(KEYS.minimum)), maximum: number(params.get(KEYS.maximum)),
    order: ORDERS.includes(order) && order !== 'cercania' ? order : 'relevancia' };
}

export function serializeFilters({ query = '', minimum = '', maximum = '', order = 'relevancia' } = {}) {
  const params = new URLSearchParams();
  if (query) params.set(KEYS.q, query);
  if (minimum !== '') params.set(KEYS.minimum, String(minimum));
  if (maximum !== '') params.set(KEYS.maximum, String(maximum));
  if (order && order !== 'relevancia' && order !== 'cercania') params.set(KEYS.order, order);
  return params.toString();
}

/** Recordar filtros es una preferencia opcional con consentimiento explícito; solo precio y orden, jamás la consulta ni la ubicación. */
export function readRememberedFilters(storage = safeStorage()) {
  try { const raw = storage?.getItem(STORAGE_KEY); return raw ? parseFilters(serializeFilters(JSON.parse(raw))) : null; } catch { return null; }
}
export function rememberFilters(filters, storage = safeStorage()) {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify({ minimum: filters.minimum, maximum: filters.maximum, order: filters.order })); return true; } catch { return false; }
}
export function forgetFilters(storage = safeStorage()) { try { storage?.removeItem(STORAGE_KEY); return true; } catch { return false; } }
function safeStorage() { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } }
