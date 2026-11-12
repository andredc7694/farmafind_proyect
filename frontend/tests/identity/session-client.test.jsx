import { describe, expect, it, vi } from 'vitest';
import { createSessionClient } from '../../src/identity/session-client.js';

const response = (status, data = null) => ({ ok: status >= 200 && status < 300,
  status, json: async () => data });

describe('cliente de sesión de mismo origen F01', () => {
  it('solicita CSRF antes de login y no persiste credenciales ni secreto de sesión', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(200, { csrfToken: 'fixture-csrf' }))
      .mockResolvedValueOnce(response(200, { userId: 'fixture-user', activePharmacyId: null }));
    const client = createSessionClient(fetcher);
    const result = await client.login({ email: 'cliente@example.test', password: 'ficticia' });
    expect(result.userId).toBe('fixture-user');
    expect(fetcher.mock.calls.map(call => call[0])).toEqual(['/api/v1/auth/csrf', '/api/v1/auth/login']);
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'POST', credentials: 'same-origin',
      headers: { 'X-CSRF-Token': 'fixture-csrf' } });
    expect(fetcher.mock.calls[1][1].body).toContain('ficticia');
    expect(JSON.stringify(result)).not.toContain('ficticia');
    expect(Object.keys(client)).toEqual(['register', 'login', 'logout', 'memberships', 'selectPharmacy', 'session']);
  });

  it('trata la sesión 401 como anónima y oculta errores sensibles', async () => {
    const anonymous = createSessionClient(vi.fn().mockResolvedValue(response(401)));
    expect(await anonymous.session()).toBeNull();
    const fetcher = vi.fn().mockResolvedValueOnce(response(200, { csrfToken: 'fixture-csrf' }))
      .mockResolvedValueOnce(response(429, { message: 'detalle privado' }));
    await expect(createSessionClient(fetcher).login({ email: 'ausente@example.test', password: 'x' }))
      .rejects.toThrow('No se pudo completar la solicitud');
  });

  it('vuelve a pedir CSRF para logout y omite cuerpo de credenciales', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(200, { csrfToken: 'nuevo-csrf' }))
      .mockResolvedValueOnce(response(204));
    await createSessionClient(fetcher).logout();
    expect(fetcher.mock.calls[1][1].body).toBeUndefined();
    expect(fetcher.mock.calls[1][1].headers['X-CSRF-Token']).toBe('nuevo-csrf');
  });
  it('consulta solo membresias del servidor y envia la seleccion como solicitud PUT con CSRF', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(200, [{ pharmacyId: 'a', pharmacyName: 'A' }]))
      .mockResolvedValueOnce(response(200, { csrfToken: 'fixture-csrf' }))
      .mockResolvedValueOnce(response(200, { pharmacyId: 'a', roleCode: 'TRABAJADOR', delegationCodes: [] }));
    const client = createSessionClient(fetcher);
    expect(await client.memberships()).toEqual([{ pharmacyId: 'a', pharmacyName: 'A' }]);
    expect((await client.selectPharmacy('a')).pharmacyId).toBe('a');
    expect(fetcher.mock.calls[2][0]).toBe('/api/v1/me/active-pharmacy');
    expect(fetcher.mock.calls[2][1]).toMatchObject({ method: 'PUT', credentials: 'same-origin',
      headers: { 'X-CSRF-Token': 'fixture-csrf' }, body: '{"pharmacyId":"a"}' });
  });
});
