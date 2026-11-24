// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StaffAdmin } from '../src/identity/StaffAdmin.jsx';
import { ForcedPasswordChange } from '../src/identity/ForcedPasswordChange.jsx';
import { createStaffClient } from '../src/identity/staff-client.js';
import { createSessionClient } from '../src/identity/session-client.js';

afterEach(cleanup);

const response = (status, body = null) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const member = { membershipId: 'm1', userId: 'u1', alias: 'alfa.caja1', displayName: 'Caja uno', state: 'ACTIVA', pendingTemporaryKey: true, capabilities: [] };

describe('F01.1 US1: cliente de personal', () => {
  it('lista con cookie del mismo origen y crea con CSRF, sin guardar nada en el navegador', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(200, [member]))
      .mockResolvedValueOnce(response(200, { csrfToken: 'csrf-1' }))
      .mockResolvedValueOnce(response(201, { alias: 'alfa.caja2', temporaryPassword: 'CLAVE', expiresAt: '2026-11-24T10:00:00.000Z' }));
    const client = createStaffClient(fetcher);
    expect(await client.list('farmacia a')).toEqual([member]);
    expect(fetcher.mock.calls[0]).toEqual(['/api/v1/pharmacies/farmacia%20a/staff', { credentials: 'same-origin', cache: 'no-store' }]);
    await client.create('farmacia a', { alias: 'alfa.caja2', displayName: 'Caja dos', capabilities: ['inventory.read'] });
    expect(fetcher.mock.calls[2][1]).toMatchObject({ method: 'POST', credentials: 'same-origin',
      headers: { 'X-CSRF-Token': 'csrf-1' }, body: '{"alias":"alfa.caja2","displayName":"Caja dos","capabilities":["inventory.read"]}' });
  });

  it('expone el estado HTTP del fallo sin detalles del servidor', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(200, { csrfToken: 't' })).mockResolvedValueOnce(response(409, { code: 'CONFLICT' }));
    await expect(createStaffClient(fetcher).create('a', { alias: 'x', displayName: 'y' })).rejects.toMatchObject({ status: 409, message: 'No se pudo completar la solicitud' });
  });

  it('el cliente de sesión cambia la clave temporal con CSRF', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(200, { csrfToken: 'csrf-2' })).mockResolvedValueOnce(response(204));
    await createSessionClient(fetcher).changeTemporaryPassword('clave-definitiva-123');
    expect(fetcher.mock.calls[1][0]).toBe('/api/v1/auth/password/change-temporary');
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'POST', body: '{"newPassword":"clave-definitiva-123"}', headers: { 'X-CSRF-Token': 'csrf-2' } });
  });
});

describe('F01.1 US1: pantalla «Personal de la farmacia»', () => {
  it('no se muestra cuando el servidor deniega el acceso', async () => {
    const api = { list: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { status: 403 })), create: vi.fn() };
    const { container } = render(<StaffAdmin pharmacyId="a" api={api} />);
    await waitFor(() => expect(api.list).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector('section')).toBeNull());
  });

  it('crea la cuenta, muestra la clave temporal una sola vez y permite ocultarla', async () => {
    const api = { list: vi.fn().mockResolvedValue([member]),
      create: vi.fn().mockResolvedValue({ alias: 'alfa.caja2', temporaryPassword: 'ABCDEFGH-JKMNPQRS-TVWXYZ01-23456789', expiresAt: '2026-11-24T10:00:00.000Z' }) };
    render(<StaffAdmin pharmacyId="a" api={api} />);
    await screen.findByText('Personal de la farmacia');
    expect(screen.getByText(/clave temporal pendiente de usar/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Usuario (alias) del trabajador'), { target: { value: ' alfa.caja2 ' } });
    fireEvent.change(screen.getByLabelText('Nombre para mostrar'), { target: { value: 'Caja dos' } });
    fireEvent.click(screen.getByLabelText('Ver inventario'));
    fireEvent.click(screen.getByLabelText('Ver reservas'));
    fireEvent.submit(screen.getByText('Crear cuenta de trabajador').closest('form'));
    await screen.findByLabelText('Clave temporal');
    expect(api.create).toHaveBeenCalledWith('a', { alias: 'alfa.caja2', displayName: 'Caja dos', capabilities: ['inventory.read', 'reservation.read'] });
    expect(screen.getByLabelText('Clave temporal').textContent).toBe('ABCDEFGH-JKMNPQRS-TVWXYZ01-23456789');
    expect(screen.getByLabelText('Usuario (alias) del trabajador').value).toBe('');
    fireEvent.click(screen.getByText('Ya la entregué; ocultar'));
    expect(screen.queryByLabelText('Clave temporal')).toBeNull();
    expect(document.body.textContent).not.toContain('ABCDEFGH');
  });

  it('muestra un mensaje claro ante alias no disponible y no revela la clave anterior', async () => {
    const api = { list: vi.fn().mockResolvedValue([]), create: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { status: 409 })) };
    render(<StaffAdmin pharmacyId="a" api={api} />);
    await screen.findByText('Personal de la farmacia');
    fireEvent.change(screen.getByLabelText('Usuario (alias) del trabajador'), { target: { value: 'alfa.caja1' } });
    fireEvent.change(screen.getByLabelText('Nombre para mostrar'), { target: { value: 'Caja' } });
    fireEvent.submit(screen.getByText('Crear cuenta de trabajador').closest('form'));
    expect((await screen.findByRole('alert')).textContent).toContain('no está disponible');
  });

  it('al cambiar de farmacia descarta la clave temporal mostrada', async () => {
    const api = { list: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ alias: 'a.b.c', temporaryPassword: 'SECRETA-UNICA', expiresAt: '2026-11-24T10:00:00.000Z' }) };
    const { rerender } = render(<StaffAdmin pharmacyId="a" api={api} />);
    await screen.findByText('Personal de la farmacia');
    fireEvent.change(screen.getByLabelText('Usuario (alias) del trabajador'), { target: { value: 'alfa.caja1' } });
    fireEvent.change(screen.getByLabelText('Nombre para mostrar'), { target: { value: 'Caja' } });
    fireEvent.submit(screen.getByText('Crear cuenta de trabajador').closest('form'));
    await screen.findByLabelText('Clave temporal');
    rerender(<StaffAdmin pharmacyId="b" api={api} />);
    await waitFor(() => expect(screen.queryByLabelText('Clave temporal')).toBeNull());
  });
});

describe('F01.1 US1: cambio obligatorio de clave', () => {
  it('rechaza una clave corta o distinta sin llamar al servidor', () => {
    const onSubmit = vi.fn();
    render(<ForcedPasswordChange onSubmit={onSubmit} onLogout={() => {}} />);
    fireEvent.change(screen.getByLabelText(/Clave nueva/), { target: { value: 'corta' } });
    fireEvent.change(screen.getByLabelText('Repite la clave nueva'), { target: { value: 'corta' } });
    fireEvent.submit(screen.getByText('Guardar clave y continuar').closest('form'));
    expect(screen.getByRole('alert').textContent).toContain('al menos 12');
    fireEvent.change(screen.getByLabelText(/Clave nueva/), { target: { value: 'clave-definitiva-123' } });
    fireEvent.change(screen.getByLabelText('Repite la clave nueva'), { target: { value: 'otra-clave-definitiva-1' } });
    fireEvent.submit(screen.getByText('Guardar clave y continuar').closest('form'));
    expect(screen.getByRole('alert').textContent).toContain('no coinciden');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envía la clave válida una vez y limpia los campos', () => {
    const onSubmit = vi.fn();
    render(<ForcedPasswordChange onSubmit={onSubmit} onLogout={() => {}} />);
    fireEvent.change(screen.getByLabelText(/Clave nueva/), { target: { value: 'clave-definitiva-123' } });
    fireEvent.change(screen.getByLabelText('Repite la clave nueva'), { target: { value: 'clave-definitiva-123' } });
    fireEvent.submit(screen.getByText('Guardar clave y continuar').closest('form'));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith('clave-definitiva-123');
    expect(screen.getByLabelText(/Clave nueva/).value).toBe('');
  });

  it('permite cerrar la sesión y muestra el error genérico del servidor', () => {
    const onLogout = vi.fn();
    render(<ForcedPasswordChange onSubmit={() => {}} onLogout={onLogout} error />);
    expect(screen.getByRole('alert').textContent).toContain('No se pudo guardar');
    fireEvent.click(screen.getByText('Cerrar sesión'));
    expect(onLogout).toHaveBeenCalledOnce();
  });
});
