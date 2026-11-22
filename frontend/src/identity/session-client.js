const base = '/api/v1/auth';

function genericFailure() {
  return new Error('No se pudo completar la solicitud');
}

/** Browser credentials travel only in a same-origin request, never in storage. */
export function createSessionClient(fetchImpl = fetch) {
  async function csrf() {
    const response = await fetchImpl(`${base}/csrf`, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw genericFailure();
    const data = await response.json();
    if (typeof data.csrfToken !== 'string') throw genericFailure();
    return data.csrfToken;
  }

  async function mutate(path, body, method = 'POST') {
    const token = await csrf();
    const response = await fetchImpl(path.startsWith('/') ? path : `${base}/${path}`, {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw genericFailure();
    return response.status === 204 || response.status === 202 ? null : response.json();
  }

  return {
    register: credentials => mutate('register', credentials),
    login: credentials => mutate('login', credentials),
    logout: () => mutate('logout'),
    async memberships() {
      const response = await fetchImpl('/api/v1/me/memberships', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw genericFailure();
      return response.json();
    },
    selectPharmacy: pharmacyId => mutate('/api/v1/me/active-pharmacy', { pharmacyId }, 'PUT'),
    async session() {
      const response = await fetchImpl(`${base}/session`, { credentials: 'same-origin', cache: 'no-store' });
      if (response.status === 401) return null;
      if (!response.ok) throw genericFailure();
      return response.json();
    },
  };
}
