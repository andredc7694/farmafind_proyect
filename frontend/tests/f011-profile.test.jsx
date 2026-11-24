// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Profile } from '../src/identity/Profile.jsx';
import { createProfileClient } from '../src/identity/profile-client.js';

afterEach(cleanup);
const response = (status, body = null) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const base = { userId: 'u1', displayName: 'Ana', phone: null, avatarPreset: 2, theme: 'SISTEMA', notifyReservations: true, notifySecurity: true,
  email: 'ana@example.test', emailVerified: false };
const sessions = [{ id: 's1', createdAt: '2026-11-23T10:00:00.000Z', lastUsedAt: '2026-11-23T10:05:00.000Z', current: true },
  { id: 's2', createdAt: '2026-11-22T10:00:00.000Z', lastUsedAt: '2026-11-22T10:05:00.000Z', current: false }];

function makeApi(overrides = {}) {
  return { get: vi.fn().mockResolvedValue(base), update: vi.fn().mockImplementation(async patch => ({ ...base, ...patch })),
    requestEmailVerification: vi.fn().mockResolvedValue(null), verifyEmail: vi.fn().mockResolvedValue(null),
    changeEmail: vi.fn().mockResolvedValue(null), changePassword: vi.fn().mockResolvedValue(null),
    listSessions: vi.fn().mockResolvedValue(sessions), revokeSession: vi.fn().mockResolvedValue(null),
    revokeOtherSessions: vi.fn().mockResolvedValue(null), ...overrides };
}

describe('F01.1 US5: cliente HTTP del perfil', () => {
  it('usa CSRF en cada mutación, rutas propias y nunca envía un identificador de usuario', async () => {
    const fetcher = vi.fn().mockImplementation(async url => url === '/api/v1/auth/csrf' ? response(200, { csrfToken: 't' }) : response(204));
    const client = createProfileClient(fetcher);
    await client.update({ theme: 'OSCURO' });
    await client.changePassword({ currentPassword: 'a', newPassword: 'b' });
    await client.changeEmail({ newEmail: 'x@example.test', currentPassword: 'a' });
    await client.revokeSession('s 2');
    await client.revokeOtherSessions();
    await client.verifyEmail('CODIGO');
    const calls = fetcher.mock.calls.filter(call => call[0] !== '/api/v1/auth/csrf')
      .map(call => [call[0], call[1].method, call[1].body, call[1].headers['X-CSRF-Token']]);
    expect(calls).toEqual([
      ['/api/v1/me/profile', 'PATCH', '{"theme":"OSCURO"}', 't'], ['/api/v1/me/password', 'POST', '{"currentPassword":"a","newPassword":"b"}', 't'],
      ['/api/v1/me/email/change', 'POST', '{"newEmail":"x@example.test","currentPassword":"a"}', 't'],
      ['/api/v1/me/sessions/s%202', 'DELETE', undefined, 't'], ['/api/v1/me/sessions/revoke-others', 'POST', undefined, 't'],
      ['/api/v1/auth/email/verify', 'POST', '{"token":"CODIGO"}', 't']]);
    expect(JSON.stringify(calls)).not.toMatch(/userId|role|membership/i);
  });
});

describe('F01.1 US5: pantalla «Mi perfil»', () => {
  it('carga los datos y guarda solo los seis campos propios; no muestra roles ni permisos', async () => {
    const api = makeApi();
    render(<Profile api={api} />);
    expect((await screen.findByLabelText('Nombre')).value).toBe('Ana');
    expect(document.body.textContent).not.toMatch(/rol|permiso|membres/i);
    fireEvent.change(screen.getByLabelText('Teléfono (opcional)'), { target: { value: '+51 999 111 222' } });
    fireEvent.change(screen.getByLabelText('Tema'), { target: { value: 'OSCURO' } });
    fireEvent.click(screen.getByLabelText('Avisos de reservas'));
    fireEvent.submit(screen.getByText('Guardar datos').closest('form'));
    await screen.findByText('Datos guardados.');
    expect(api.update).toHaveBeenCalledWith({ displayName: 'Ana', phone: '+51 999 111 222', avatarPreset: 2, theme: 'OSCURO',
      notifyReservations: false, notifySecurity: true });
    expect(Object.keys(api.update.mock.calls[0][0]).sort()).toEqual(['avatarPreset', 'displayName', 'notifyReservations', 'notifySecurity', 'phone', 'theme']);
  });

  it('un correo sin verificar ofrece pedir el código y verificarlo', async () => {
    const api = makeApi({ get: vi.fn().mockResolvedValueOnce(base).mockResolvedValue({ ...base, emailVerified: true }) });
    render(<Profile api={api} />);
    fireEvent.click(await screen.findByText('Enviar código de verificación'));
    await screen.findByText('Te enviamos un código de verificación.');
    fireEvent.change(screen.getByLabelText('Código recibido'), { target: { value: ' ABC123 ' } });
    fireEvent.submit(screen.getByText('Verificar').closest('form'));
    await waitFor(() => expect(api.verifyEmail).toHaveBeenCalledWith('ABC123'));
    await screen.findByText(/— verificado$/);
  });

  it('el cambio de correo no confirma si existe otra cuenta y limpia los campos sensibles', async () => {
    const api = makeApi();
    render(<Profile api={api} />);
    fireEvent.change(await screen.findByLabelText('Correo nuevo'), { target: { value: ' nuevo@example.test ' } });
    fireEvent.change(screen.getByLabelText('Tu clave actual'), { target: { value: 'clave-actual-123' } });
    fireEvent.submit(screen.getByText('Pedir cambio de correo').closest('form'));
    await screen.findByText(/Si el correo está disponible/);
    expect(api.changeEmail).toHaveBeenCalledWith({ newEmail: 'nuevo@example.test', currentPassword: 'clave-actual-123' });
    expect(screen.getByLabelText('Tu clave actual').value).toBe('');
  });

  it('valida la clave nueva antes de llamar, distingue clave actual incorrecta y no deja claves en pantalla', async () => {
    const api = makeApi({ changePassword: vi.fn().mockRejectedValueOnce(Object.assign(new Error('x'), { status: 401 })).mockResolvedValue(null) });
    render(<Profile api={api} />);
    const fill = (current, next, repeat) => {
      fireEvent.change(screen.getByLabelText('Clave actual'), { target: { value: current } });
      fireEvent.change(screen.getByLabelText(/Clave nueva/), { target: { value: next } });
      fireEvent.change(screen.getByLabelText('Repite la clave nueva'), { target: { value: repeat } });
      fireEvent.submit(screen.getByText('Cambiar clave', { selector: 'button' }).closest('form'));
    };
    await screen.findByLabelText('Clave actual');
    fill('actual-123456', 'corta', 'corta');
    expect(screen.getByRole('alert').textContent).toContain('al menos 12');
    fill('actual-123456', 'clave-nueva-123456', 'otra-clave-nueva-1');
    expect(screen.getByRole('alert').textContent).toContain('no coinciden');
    expect(api.changePassword).not.toHaveBeenCalled();
    fill('actual-123456', 'clave-nueva-123456', 'clave-nueva-123456');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('La clave actual no es correcta.'));
    fill('actual-123456', 'clave-nueva-123456', 'clave-nueva-123456');
    await screen.findByText('Clave cambiada. Las demás sesiones se cerraron.');
    expect(document.body.textContent).not.toContain('clave-nueva-123456');
  });

  it('lista las sesiones propias y permite cerrar una o las demás, sin botón para la actual', async () => {
    const api = makeApi({ listSessions: vi.fn().mockResolvedValueOnce(sessions).mockResolvedValue([sessions[0]]) });
    render(<Profile api={api} />);
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).queryByText('Cerrar')).toBeNull();
    fireEvent.click(within(items[1]).getByText('Cerrar'));
    await waitFor(() => expect(api.revokeSession).toHaveBeenCalledWith('s2'));
    await waitFor(() => expect(screen.queryByText('Cerrar las demás sesiones')).toBeNull());
  });

  it('si no carga muestra un mensaje genérico', async () => {
    render(<Profile api={makeApi({ get: vi.fn().mockRejectedValue(new Error('500')) })} />);
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo cargar tu perfil.');
  });
});
