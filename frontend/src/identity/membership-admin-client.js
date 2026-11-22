const genericFailure = () => new Error('No se pudo completar la solicitud');

/** The server decides authorization; this client carries only an opaque session cookie. */
export function createMembershipAdminClient(fetchImpl = fetch) {
  const path = pharmacyId => `/api/v1/pharmacies/${encodeURIComponent(pharmacyId)}/memberships`;
  async function csrf() {
    const response = await fetchImpl('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw genericFailure();
    const body = await response.json();
    if (typeof body.csrfToken !== 'string') throw genericFailure();
    return body.csrfToken;
  }
  async function mutate(url, method, body) {
    const token = await csrf();
    const response = await fetchImpl(url, { method, credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify(body) });
    if (!response.ok) throw genericFailure();
    return response.json();
  }
  return {
    async list(pharmacyId) {
      const response = await fetchImpl(path(pharmacyId), { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw genericFailure();
      return response.json();
    },
    grant: (pharmacyId, userId) => mutate(path(pharmacyId), 'POST', { userId, role: 'TRABAJADOR' }),
    revoke: (pharmacyId, membershipId) => mutate(`${path(pharmacyId)}/${encodeURIComponent(membershipId)}`,
      'PATCH', { status: 'REVOCADA' }),
  };
}
