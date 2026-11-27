/** F07.1: clientes HTTP de «Mi farmacia», revisión de plataforma y horario. Sin almacenamiento en el navegador. */
async function csrfToken(fetchImpl) {
  const response = await fetchImpl('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('No se pudo verificar la sesión');
  const token = (await response.json()).csrfToken;
  if (typeof token !== 'string') throw new Error('No se pudo verificar la sesión');
  return token;
}
function failure(status) {
  return Object.assign(new Error(status === 409 ? 'Los datos cambiaron; actualiza la vista e inténtalo de nuevo'
    : status === 403 ? 'No tienes permiso para esta operación'
      : status === 422 ? 'Revisa las horas: el cierre debe ser posterior a la apertura'
        : status === 400 ? 'Revisa los datos ingresados' : 'No se pudo completar la operación'), { status });
}
async function send(fetchImpl, method, url, body) {
  const token = await csrfToken(fetchImpl);
  const response = await fetchImpl(url, { method, credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token }, body: JSON.stringify(body) });
  if (!response.ok) throw failure(response.status);
  return response.json();
}
async function read(fetchImpl, url) {
  const response = await fetchImpl(url, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw failure(response.status);
  return response.json();
}
const enc = encodeURIComponent;

export function createLocationStatusClient(fetchImpl = fetch) {
  return { status: pharmacyId => read(fetchImpl, `/api/v1/farmacias/${enc(pharmacyId)}/ubicacion`) };
}

export function createPlatformLocationClient(fetchImpl = fetch) {
  return {
    list: () => read(fetchImpl, '/api/v1/platform/location-proposals'),
    history: (estado, pagina) => read(fetchImpl, `/api/v1/platform/location-proposals/historial?estado=${enc(estado)}&pagina=${enc(pagina)}`),
    canReview: async () => {
      const response = await fetchImpl('/api/v1/platform/location-proposals', { credentials: 'same-origin', cache: 'no-store' });
      return response.ok;
    },
    decide: (proposalId, body) => send(fetchImpl, 'POST', `/api/v1/platform/location-proposals/${enc(proposalId)}/decision`, body),
  };
}

export function createOpeningHoursClient(fetchImpl = fetch) {
  return {
    read: pharmacyId => read(fetchImpl, `/api/v1/farmacias/${enc(pharmacyId)}/horario`),
    save: (pharmacyId, body) => send(fetchImpl, 'PUT', `/api/v1/farmacias/${enc(pharmacyId)}/horario`, body),
    publicHours: async ids => {
      const unique = [...new Set(ids)].slice(0, 50);
      if (!unique.length) return {};
      const response = await fetchImpl(`/api/v1/farmacias-publicas/horarios?ids=${unique.map(enc).join(',')}`, { cache: 'no-store' });
      return response.ok ? response.json() : {};
    },
  };
}

export const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Día ISO (1 lunes … 7 domingo) en hora de Lima. */
export function limaIsoDay(now = new Date()) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', weekday: 'short' }).format(now);
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(name) + 1;
}

export function describeDay(day) {
  if (!day) return 'Sin horario publicado';
  return day.cerrado ? 'Cerrado' : `${day.abre} a ${day.cierra}`;
}

/** F071-FR-013/014: sugerencias de dirección a través de nuestro servidor (POST; la dirección no va en la URL). */
export function createAddressSuggestionClient(fetchImpl = fetch) {
  const path = (pharmacyId, kind) => `/api/v1/farmacias/${enc(pharmacyId)}/ubicacion/sugerencias/${kind}`;
  return {
    search: async (pharmacyId, body) => (await send(fetchImpl, 'POST', path(pharmacyId, 'buscar'), body)).resultado ?? null,
    reverse: async (pharmacyId, body) => (await send(fetchImpl, 'POST', path(pharmacyId, 'inversa'), body)).resultado ?? null,
  };
}
