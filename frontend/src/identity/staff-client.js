const genericFailure = status => Object.assign(new Error('No se pudo completar la solicitud'), { status });

/** El servidor autoriza cada acción; este cliente solo envía la cookie de sesión del mismo origen. */
export function createStaffClient(fetchImpl = fetch) {
  const enc = encodeURIComponent;
  const path = pharmacyId => `/api/v1/pharmacies/${enc(pharmacyId)}/staff`;
  async function csrf() {
    const response = await fetchImpl('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw genericFailure(response.status);
    const body = await response.json();
    if (typeof body.csrfToken !== 'string') throw genericFailure(500);
    return body.csrfToken;
  }
  async function read(url) {
    const response = await fetchImpl(url, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw genericFailure(response.status);
    return response.json();
  }
  async function mutate(url, method, body) {
    const token = await csrf();
    const response = await fetchImpl(url, { method, credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) throw genericFailure(response.status);
    return response.status === 204 || response.status === 202 ? null : response.json();
  }
  return {
    list: pharmacyId => read(path(pharmacyId)),
    /** La clave temporal solo llega en esta respuesta; quien llama no debe guardarla. */
    create: (pharmacyId, { alias, displayName, capabilities }) =>
      mutate(path(pharmacyId), 'POST', { alias, displayName, capabilities }),
    /** Recuperación de un trabajador sin correo: la clave nueva solo llega en esta respuesta. */
    issueTemporaryKey: (pharmacyId, userId) => mutate(`${path(pharmacyId)}/${enc(userId)}/temporary-key`, 'POST'),
    listInvitations: pharmacyId => read(`${path(pharmacyId)}/invitations`),
    /** La respuesta es siempre la misma exista o no la cuenta; no se interpreta. */
    invite: (pharmacyId, email) => mutate(`${path(pharmacyId)}/invitations`, 'POST', { email }),
    revokeInvitation: (pharmacyId, invitationId) => mutate(`${path(pharmacyId)}/invitations/${enc(invitationId)}`, 'DELETE'),
    setCapabilities: (pharmacyId, membershipId, capabilities) =>
      mutate(`${path(pharmacyId)}/${enc(membershipId)}/capabilities`, 'PUT', { capabilities }),
    revokeMembership: (pharmacyId, membershipId) =>
      mutate(`/api/v1/pharmacies/${enc(pharmacyId)}/memberships/${enc(membershipId)}`, 'PATCH', { status: 'REVOCADA' }),
    listMine: () => read('/api/v1/me/invitations'),
    accept: invitationId => mutate(`/api/v1/me/invitations/${enc(invitationId)}/accept`, 'POST'),
    decline: invitationId => mutate(`/api/v1/me/invitations/${enc(invitationId)}/decline`, 'POST'),
  };
}
