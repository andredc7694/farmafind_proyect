import { describe, expect, it, vi } from 'vitest';
import { createMembershipAdminClient } from '../../src/identity/membership-admin-client.js';

const response = (status, body = null) => ({ ok: status >= 200 && status < 300,
  status, json: async () => body });

describe('administracion local React: el servidor autoriza, el cliente solo solicita', () => {
  it('lista únicamente la farmacia seleccionada con cookie del mismo origen', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(200, []));
    expect(await createMembershipAdminClient(fetcher).list('farmacia-a')).toEqual([]);
    expect(fetcher).toHaveBeenCalledWith('/api/v1/pharmacies/farmacia-a/memberships',
      { credentials: 'same-origin', cache: 'no-store' });
  });

  it('pide CSRF por cada cambio y envía solo TRABAJADOR o REVOCADA', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(200, { csrfToken: 'fixture-csrf-1' }))
      .mockResolvedValueOnce(response(201, { role: 'TRABAJADOR' }))
      .mockResolvedValueOnce(response(200, { csrfToken: 'fixture-csrf-2' }))
      .mockResolvedValueOnce(response(200, { status: 'REVOCADA' }));
    const client = createMembershipAdminClient(fetcher);
    await client.grant('farmacia-a', 'usuario-ficticio');
    await client.revoke('farmacia-a', 'membresia-ficticia');
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'POST', credentials: 'same-origin',
      body: '{"userId":"usuario-ficticio","role":"TRABAJADOR"}',
      headers: { 'X-CSRF-Token': 'fixture-csrf-1' } });
    expect(fetcher.mock.calls[3][1]).toMatchObject({ method: 'PATCH', credentials: 'same-origin',
      body: '{"status":"REVOCADA"}', headers: { 'X-CSRF-Token': 'fixture-csrf-2' } });
  });

  it('oculta el detalle privado cuando el servidor deniega la farmacia', async () => {
    const client = createMembershipAdminClient(vi.fn().mockResolvedValue(response(404, { private: 'dato' })));
    await expect(client.list('farmacia-b')).rejects.toThrow('No se pudo completar la solicitud');
  });
});
