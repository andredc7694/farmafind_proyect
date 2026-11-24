// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StaffAdmin } from '../src/identity/StaffAdmin.jsx';
import { MyInvitations } from '../src/identity/MyInvitations.jsx';
import { createStaffClient } from '../src/identity/staff-client.js';

afterEach(cleanup);

const response = (status, body = null) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const member = { membershipId: 'm1', userId: 'u1', alias: 'alfa.caja1', displayName: 'Caja uno', state: 'ACTIVA', pendingTemporaryKey: false, capabilities: ['inventory.read'] };
const pendingInvitation = { id: 'i1', destination: 'a***@example.test', state: 'PENDIENTE', createdAt: '2026-11-23T10:00:00.000Z', expiresAt: '2026-11-30T10:00:00.000Z' };

function api(overrides = {}) {
  return { list: vi.fn().mockResolvedValue([member]), create: vi.fn(), listInvitations: vi.fn().mockResolvedValue([pendingInvitation]),
    invite: vi.fn().mockResolvedValue(null), revokeInvitation: vi.fn().mockResolvedValue(null),
    setCapabilities: vi.fn().mockResolvedValue(null), revokeMembership: vi.fn().mockResolvedValue(null), ...overrides };
}

describe('F01.1 US2: cliente HTTP', () => {
  it('usa CSRF y el método correcto en cada operación y expone solo el estado del fallo', async () => {
    const fetcher = vi.fn().mockImplementation(async url => url === '/api/v1/auth/csrf' ? response(200, { csrfToken: 't' }) : response(204));
    const client = createStaffClient(fetcher);
    await client.invite('a b', 'ana@example.test');
    await client.revokeInvitation('a b', 'i/1');
    await client.setCapabilities('a b', 'm1', ['inventory.read']);
    await client.revokeMembership('a b', 'm1');
    await client.accept('i1'); await client.decline('i2');
    const calls = fetcher.mock.calls.filter(call => call[0] !== '/api/v1/auth/csrf').map(call => [call[1].method, call[0], call[1].body]);
    expect(calls).toEqual([
      ['POST', '/api/v1/pharmacies/a%20b/staff/invitations', '{"email":"ana@example.test"}'],
      ['DELETE', '/api/v1/pharmacies/a%20b/staff/invitations/i%2F1', undefined],
      ['PUT', '/api/v1/pharmacies/a%20b/staff/m1/capabilities', '{"capabilities":["inventory.read"]}'],
      ['PATCH', '/api/v1/pharmacies/a%20b/memberships/m1', '{"status":"REVOCADA"}'],
      ['POST', '/api/v1/me/invitations/i1/accept', undefined],
      ['POST', '/api/v1/me/invitations/i2/decline', undefined]]);
    expect(client.grant).toBeUndefined();
    const failing = vi.fn().mockResolvedValueOnce(response(200, { csrfToken: 't' })).mockResolvedValueOnce(response(409));
    await expect(createStaffClient(failing).accept('i1')).rejects.toMatchObject({ status: 409, message: 'No se pudo completar la solicitud' });
  });
});

describe('F01.1 US2: «Personal de la farmacia»', () => {
  it('invita sin confirmar si la cuenta existe y recarga las invitaciones', async () => {
    const service = api();
    render(<StaffAdmin pharmacyId="a" api={service} />);
    await screen.findByText('Invitaciones enviadas');
    expect(screen.getByText(/a\*\*\*@example\.test/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Correo de la persona'), { target: { value: ' ana@example.test ' } });
    fireEvent.submit(screen.getByText('Enviar invitación').closest('form'));
    await waitFor(() => expect(service.invite).toHaveBeenCalledWith('a', 'ana@example.test'));
    const notice = await screen.findByText(/No se confirma si la cuenta existe/);
    expect(notice.textContent).toContain('Si existe una cuenta');
    expect(screen.getByLabelText('Correo de la persona').value).toBe('');
    expect(service.listInvitations).toHaveBeenCalledTimes(2);
  });

  it('revoca una invitación pendiente', async () => {
    const service = api();
    render(<StaffAdmin pharmacyId="a" api={service} />);
    fireEvent.click(await screen.findByText('Revocar invitación'));
    await waitFor(() => expect(service.revokeInvitation).toHaveBeenCalledWith('a', 'i1'));
  });

  it('edita los permisos de un trabajador y guarda el conjunto completo', async () => {
    const service = api();
    render(<StaffAdmin pharmacyId="a" api={service} />);
    fireEvent.click(await screen.findByText('Permisos'));
    const group = screen.getByRole('group', { name: /Permisos de alfa\.caja1/ });
    expect(within(group).getByLabelText('Ver inventario').checked).toBe(true);
    fireEvent.click(within(group).getByLabelText('Ver reservas'));
    fireEvent.click(within(group).getByLabelText('Ver inventario'));
    fireEvent.click(within(group).getByText('Guardar permisos'));
    await waitFor(() => expect(service.setCapabilities).toHaveBeenCalledWith('a', 'm1', ['reservation.read']));
    expect(screen.queryByLabelText('Gestionar personal')).toBeNull(); // no existe forma de delegar la gestión
  });

  it('la revocación de acceso exige una segunda confirmación', async () => {
    const service = api();
    render(<StaffAdmin pharmacyId="a" api={service} />);
    fireEvent.click(await screen.findByText('Revocar acceso'));
    expect(service.revokeMembership).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Cancelar'));
    expect(screen.queryByText('Confirmar revocación')).toBeNull();
    fireEvent.click(screen.getByText('Revocar acceso'));
    fireEvent.click(screen.getByText('Confirmar revocación'));
    await waitFor(() => expect(service.revokeMembership).toHaveBeenCalledWith('a', 'm1'));
  });

  it('muestra un mensaje claro si falla una acción y vuelve a cargar el estado real', async () => {
    const service = api({ setCapabilities: vi.fn().mockRejectedValue(new Error('x')) });
    render(<StaffAdmin pharmacyId="a" api={service} />);
    fireEvent.click(await screen.findByText('Permisos'));
    fireEvent.click(screen.getByText('Guardar permisos'));
    expect((await screen.findByRole('alert')).textContent).toContain('No se pudieron guardar los permisos');
    expect(service.list).toHaveBeenCalledTimes(2);
  });

  it('un miembro revocado ya no ofrece acciones', async () => {
    render(<StaffAdmin pharmacyId="a" api={api({ list: vi.fn().mockResolvedValue([{ ...member, state: 'REVOCADA' }]) })} />);
    await screen.findByText(/REVOCADA/);
    expect(screen.queryByText('Permisos')).toBeNull();
    expect(screen.queryByText('Revocar acceso')).toBeNull();
  });
});

describe('F01.1 US2: «Mis invitaciones»', () => {
  const mine = { id: 'i1', pharmacyName: 'Farmacia ficticia Alfa', state: 'PENDIENTE', expiresAt: '2026-11-30T10:00:00.000Z' };

  it('no se muestra si no hay invitaciones', async () => {
    const service = { listMine: vi.fn().mockResolvedValue([]), accept: vi.fn(), decline: vi.fn() };
    const { container } = render(<MyInvitations api={service} />);
    await waitFor(() => expect(service.listMine).toHaveBeenCalled());
    expect(container.querySelector('section')).toBeNull();
  });

  it('acepta una invitación y avisa para recargar las membresías', async () => {
    const service = { listMine: vi.fn().mockResolvedValueOnce([mine]).mockResolvedValue([]), accept: vi.fn().mockResolvedValue(null), decline: vi.fn() };
    const onAccepted = vi.fn();
    render(<MyInvitations api={service} onAccepted={onAccepted} />);
    fireEvent.click(await screen.findByText('Aceptar'));
    await waitFor(() => expect(service.accept).toHaveBeenCalledWith('i1'));
    expect((await screen.findByRole('status')).textContent).toContain('Ya formas parte');
    expect(onAccepted).toHaveBeenCalledOnce();
  });

  it('rechaza una invitación sin recargar membresías y explica los fallos sin detalles', async () => {
    const declining = { listMine: vi.fn().mockResolvedValueOnce([mine]).mockResolvedValue([]), accept: vi.fn(), decline: vi.fn().mockResolvedValue(null) };
    const onAccepted = vi.fn();
    const first = render(<MyInvitations api={declining} onAccepted={onAccepted} />);
    fireEvent.click(await screen.findByText('Rechazar'));
    expect((await screen.findByRole('status')).textContent).toContain('Invitación rechazada');
    expect(onAccepted).not.toHaveBeenCalled();
    first.unmount();
    const failing = { listMine: vi.fn().mockResolvedValue([mine]), accept: vi.fn().mockRejectedValue(new Error('409')), decline: vi.fn() };
    render(<MyInvitations api={failing} />);
    fireEvent.click(await screen.findByText('Aceptar'));
    expect((await screen.findByRole('status')).textContent).toContain('pudo haber vencido');
  });
});
