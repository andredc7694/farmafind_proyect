// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PasswordReset } from '../src/identity/PasswordReset.jsx';
import { AuthView } from '../src/identity/AuthView.jsx';
import { StaffAdmin } from '../src/identity/StaffAdmin.jsx';
import { createSessionClient } from '../src/identity/session-client.js';
import { createStaffClient } from '../src/identity/staff-client.js';

afterEach(cleanup);

const response = (status, body = null) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('F01.1 US3: clientes HTTP', () => {
  it('restablecer usa CSRF y envía solo los campos esperados', async () => {
    const fetcher = vi.fn().mockImplementation(async url => url === '/api/v1/auth/csrf' ? response(200, { csrfToken: 't' }) : response(202));
    const client = createSessionClient(fetcher);
    await client.requestPasswordReset('ana@example.test');
    await client.confirmPasswordReset({ token: 'CODIGO', newPassword: 'clave-definitiva-123' });
    const calls = fetcher.mock.calls.filter(call => call[0] !== '/api/v1/auth/csrf').map(call => [call[0], call[1].method, call[1].body]);
    expect(calls).toEqual([
      ['/api/v1/auth/password/reset/request', 'POST', '{"email":"ana@example.test"}'],
      ['/api/v1/auth/password/reset/confirm', 'POST', '{"token":"CODIGO","newPassword":"clave-definitiva-123"}']]);
  });

  it('la reemisión de clave temporal pide CSRF y apunta a la ruta del trabajador', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(200, { csrfToken: 't' }))
      .mockResolvedValueOnce(response(201, { temporaryPassword: 'ABCDEFGH-JKMNPQRS-TVWXYZ01-23456789', expiresAt: '2026-11-24T10:00:00.000Z' }));
    const result = await createStaffClient(fetcher).issueTemporaryKey('a b', 'u1');
    expect(fetcher.mock.calls[1][0]).toBe('/api/v1/pharmacies/a%20b/staff/u1/temporary-key');
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'POST', headers: { 'X-CSRF-Token': 't' } });
    expect(result.temporaryPassword).toContain('ABCDEFGH');
  });
});

describe('F01.1 US3: «Olvidé mi clave»', () => {
  it('el acceso ofrece el enlace solo cuando se le da el manejador', () => {
    render(<AuthView onRegister={() => {}} onLogin={() => {}} onLogout={() => {}} />);
    expect(screen.queryByText('Olvidé mi clave')).toBeNull();
    cleanup();
    const onForgotPassword = vi.fn();
    render(<AuthView onRegister={() => {}} onLogin={() => {}} onLogout={() => {}} onForgotPassword={onForgotPassword} />);
    fireEvent.click(screen.getByText('Olvidé mi clave'));
    expect(onForgotPassword).toHaveBeenCalledOnce();
  });

  it('pide el código sin confirmar si la cuenta existe y pasa al paso de confirmación', async () => {
    const api = { requestPasswordReset: vi.fn().mockResolvedValue(null), confirmPasswordReset: vi.fn() };
    render(<PasswordReset api={api} onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText(/Correo electrónico de tu cuenta/), { target: { value: ' ana@example.test ' } });
    fireEvent.submit(screen.getByText('Enviar código').closest('form'));
    await waitFor(() => expect(api.requestPasswordReset).toHaveBeenCalledWith('ana@example.test'));
    expect((await screen.findByRole('status')).textContent).toContain('Si existe una cuenta');
    expect(screen.getByLabelText('Código recibido')).toBeTruthy();
  });

  it('valida la clave nueva antes de llamar y limpia los campos al enviar', async () => {
    const api = { requestPasswordReset: vi.fn(), confirmPasswordReset: vi.fn().mockResolvedValue(null) };
    render(<PasswordReset api={api} onDone={() => {}} initialToken="CODIGO-DE-PRUEBA" />);
    expect(screen.getByLabelText('Código recibido').value).toBe('CODIGO-DE-PRUEBA');
    fireEvent.change(screen.getByLabelText(/Clave nueva/), { target: { value: 'corta' } });
    fireEvent.change(screen.getByLabelText('Repite la clave nueva'), { target: { value: 'corta' } });
    fireEvent.submit(screen.getByText('Cambiar clave').closest('form'));
    expect(screen.getByRole('alert').textContent).toContain('al menos 12');
    fireEvent.change(screen.getByLabelText(/Clave nueva/), { target: { value: 'clave-definitiva-123' } });
    fireEvent.change(screen.getByLabelText('Repite la clave nueva'), { target: { value: 'otra-clave-definitiva-1' } });
    fireEvent.submit(screen.getByText('Cambiar clave').closest('form'));
    expect(screen.getByRole('alert').textContent).toContain('no coinciden');
    expect(api.confirmPasswordReset).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Repite la clave nueva'), { target: { value: 'clave-definitiva-123' } });
    fireEvent.submit(screen.getByText('Cambiar clave').closest('form'));
    await screen.findByText('Clave restablecida');
    expect(api.confirmPasswordReset).toHaveBeenCalledWith({ token: 'CODIGO-DE-PRUEBA', newPassword: 'clave-definitiva-123' });
    expect(document.body.textContent).not.toContain('clave-definitiva-123');
  });

  it('un código inválido muestra un mensaje genérico sin decir por qué', async () => {
    const api = { requestPasswordReset: vi.fn(), confirmPasswordReset: vi.fn().mockRejectedValue(new Error('400')) };
    render(<PasswordReset api={api} onDone={() => {}} initialToken="X" />);
    fireEvent.change(screen.getByLabelText(/Clave nueva/), { target: { value: 'clave-definitiva-123' } });
    fireEvent.change(screen.getByLabelText('Repite la clave nueva'), { target: { value: 'clave-definitiva-123' } });
    fireEvent.submit(screen.getByText('Cambiar clave').closest('form'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('El código no es válido o ya venció. Solicita uno nuevo.');
  });

  it('permite volver sin enviar nada', () => {
    const onDone = vi.fn(); const api = { requestPasswordReset: vi.fn(), confirmPasswordReset: vi.fn() };
    render(<PasswordReset api={api} onDone={onDone} />);
    fireEvent.click(screen.getByText('Volver'));
    expect(onDone).toHaveBeenCalledOnce();
    expect(api.requestPasswordReset).not.toHaveBeenCalled();
  });
});

describe('F01.1 US3: «Emitir nueva clave temporal»', () => {
  const worker = { membershipId: 'm1', userId: 'u1', alias: 'alfa.caja1', displayName: 'Caja uno', state: 'ACTIVA', pendingTemporaryKey: false, capabilities: [] };
  const withEmail = { ...worker, membershipId: 'm2', userId: 'u2', alias: null, displayName: 'Con correo' };

  it('muestra la nueva clave una sola vez y solo ofrece el botón a cuentas con alias', async () => {
    const api = { list: vi.fn().mockResolvedValue([worker, withEmail]), create: vi.fn(),
      issueTemporaryKey: vi.fn().mockResolvedValue({ temporaryPassword: 'NUEVA-CLAVE-UNICA', expiresAt: '2026-11-24T10:00:00.000Z' }) };
    render(<StaffAdmin pharmacyId="a" api={api} />);
    const buttons = await screen.findAllByText('Emitir nueva clave temporal');
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(api.issueTemporaryKey).toHaveBeenCalledWith('a', 'u1'));
    expect((await screen.findByLabelText('Clave temporal')).textContent).toBe('NUEVA-CLAVE-UNICA');
    fireEvent.click(screen.getByText('Ya la entregué; ocultar'));
    expect(document.body.textContent).not.toContain('NUEVA-CLAVE-UNICA');
  });

  it('explica el fallo sin detalles internos', async () => {
    const api = { list: vi.fn().mockResolvedValue([worker]), create: vi.fn(), issueTemporaryKey: vi.fn().mockRejectedValue(new Error('404')) };
    render(<StaffAdmin pharmacyId="a" api={api} />);
    fireEvent.click(await screen.findByText('Emitir nueva clave temporal'));
    expect((await screen.findByRole('alert')).textContent).toContain('Solo aplica a trabajadores sin correo');
  });
});
