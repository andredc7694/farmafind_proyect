// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MfaEnroll } from '../src/identity/MfaEnroll.jsx';
import { createSessionClient } from '../src/identity/session-client.js';

afterEach(cleanup);
const response = (status, body = null) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('F01.1 US4: cliente HTTP del segundo factor', () => {
  it('usa CSRF, envía solo el código y expone el estado HTTP del fallo', async () => {
    const fetcher = vi.fn().mockImplementation(async url => url === '/api/v1/auth/csrf' ? response(200, { csrfToken: 't' })
      : url.endsWith('/verify') ? response(429) : response(204));
    const client = createSessionClient(fetcher);
    await client.activateMfa('123456');
    await expect(client.verifyMfa('654321')).rejects.toMatchObject({ status: 429 });
    const calls = fetcher.mock.calls.filter(call => call[0] !== '/api/v1/auth/csrf').map(call => [call[0], call[1].method, call[1].body]);
    expect(calls).toEqual([['/api/v1/me/mfa/activate', 'POST', '{"code":"123456"}'], ['/api/v1/auth/mfa/verify', 'POST', '{"code":"654321"}']]);
  });
});

describe('F01.1 US4: pantalla de segundo factor', () => {
  it('verificar valida el formato localmente y limpia el campo al enviar', async () => {
    const api = { verifyMfa: vi.fn().mockResolvedValue(null) };
    const onDone = vi.fn();
    render(<MfaEnroll mode="verify" api={api} onDone={onDone} onLogout={() => {}} />);
    fireEvent.change(screen.getByLabelText('Código de verificación'), { target: { value: '12ab' } });
    fireEvent.submit(screen.getByText('Verificar').closest('form'));
    expect(screen.getByRole('alert').textContent).toContain('6 dígitos');
    expect(api.verifyMfa).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Código de verificación'), { target: { value: ' 123456 ' } });
    fireEvent.submit(screen.getByText('Verificar').closest('form'));
    await waitFor(() => expect(api.verifyMfa).toHaveBeenCalledWith('123456'));
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(screen.getByLabelText('Código de verificación').value).toBe('');
  });

  it('un código rechazado muestra un mensaje genérico; el bloqueo se explica aparte', async () => {
    const api = { verifyMfa: vi.fn().mockRejectedValueOnce(Object.assign(new Error('x'), { status: 401 }))
      .mockRejectedValueOnce(Object.assign(new Error('x'), { status: 429 })) };
    render(<MfaEnroll mode="verify" api={api} onDone={() => {}} onLogout={() => {}} />);
    for (const expected of ['El código no es válido', 'Demasiados intentos']) {
      fireEvent.change(screen.getByLabelText('Código de verificación'), { target: { value: '111111' } });
      fireEvent.submit(screen.getByText('Verificar').closest('form'));
      await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(expected));
    }
  });

  it('el alta muestra el secreto una sola vez y lo oculta al activar', async () => {
    const api = { enrollMfa: vi.fn().mockResolvedValue({ secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/x' }),
      activateMfa: vi.fn().mockResolvedValue(null) };
    render(<MfaEnroll mode="enroll" api={api} />);
    fireEvent.click(screen.getByText('Activar segundo factor'));
    expect((await screen.findByLabelText('Clave del segundo factor')).textContent).toBe('JBSWY3DPEHPK3PXP');
    fireEvent.change(screen.getByLabelText('Primer código generado'), { target: { value: '123456' } });
    fireEvent.submit(screen.getByText('Activar', { selector: 'button[type=submit]' }).closest('form'));
    await screen.findByText('Segundo factor activo en esta sesión.');
    expect(api.activateMfa).toHaveBeenCalledWith('123456');
    expect(document.body.textContent).not.toContain('JBSWY3DPEHPK3PXP');
  });

  it('una cuenta que no es administradora recibe un aviso sin detalles', async () => {
    const api = { enrollMfa: vi.fn().mockRejectedValue(Object.assign(new Error('403'), { status: 403 })) };
    render(<MfaEnroll mode="enroll" api={api} />);
    fireEvent.click(screen.getByText('Activar segundo factor'));
    expect((await screen.findByRole('alert')).textContent).toBe('Esta cuenta no requiere segundo factor.');
  });
});
