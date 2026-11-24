const genericFailure = status => Object.assign(new Error('No se pudo completar la solicitud'), { status });

/** El servidor autoriza cada acción; este cliente solo envía la cookie de sesión del mismo origen. */
export function createStaffClient(fetchImpl = fetch) {
  const path = pharmacyId => `/api/v1/pharmacies/${encodeURIComponent(pharmacyId)}/staff`;
  async function csrf() {
    const response = await fetchImpl('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw genericFailure(response.status);
    const body = await response.json();
    if (typeof body.csrfToken !== 'string') throw genericFailure(500);
    return body.csrfToken;
  }
  return {
    async list(pharmacyId) {
      const response = await fetchImpl(path(pharmacyId), { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw genericFailure(response.status);
      return response.json();
    },
    /** La clave temporal solo llega en esta respuesta; quien llama no debe guardarla. */
    async create(pharmacyId, { alias, displayName, capabilities }) {
      const token = await csrf();
      const response = await fetchImpl(path(pharmacyId), {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify({ alias, displayName, capabilities }),
      });
      if (!response.ok) throw genericFailure(response.status);
      return response.json();
    },
  };
}
