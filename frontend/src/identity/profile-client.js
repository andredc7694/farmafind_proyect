const genericFailure = status => Object.assign(new Error('No se pudo completar la solicitud'), { status });

/** Perfil y seguridad propios. El servidor deriva el usuario de la cookie de sesión; aquí nunca se envía un identificador de usuario. */
export function createProfileClient(fetchImpl = fetch) {
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
    get: () => read('/api/v1/me/profile'),
    update: patch => mutate('/api/v1/me/profile', 'PATCH', patch),
    requestEmailVerification: () => mutate('/api/v1/me/email/verification', 'POST'),
    verifyEmail: token => mutate('/api/v1/auth/email/verify', 'POST', { token }),
    changeEmail: ({ newEmail, currentPassword }) => mutate('/api/v1/me/email/change', 'POST', { newEmail, currentPassword }),
    changePassword: ({ currentPassword, newPassword }) => mutate('/api/v1/me/password', 'POST', { currentPassword, newPassword }),
    listSessions: () => read('/api/v1/me/sessions'),
    revokeSession: sessionId => mutate(`/api/v1/me/sessions/${encodeURIComponent(sessionId)}`, 'DELETE'),
    revokeOtherSessions: () => mutate('/api/v1/me/sessions/revoke-others', 'POST'),
  };
}
