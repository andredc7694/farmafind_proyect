// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({
  session: vi.fn(), memberships: vi.fn(), selectPharmacy: vi.fn(),
  register: vi.fn(), login: vi.fn(), logout: vi.fn(),
}));
vi.mock('../../src/identity/session-client.js', () => ({ createSessionClient: () => api }));

import { IdentityApp } from '../../src/identity/IdentityApp.jsx';

const pharmacies = [
  { pharmacyId: 'alfa', pharmacyName: 'Farmacia Alfa', delegationCodes: ['inventory.read'] },
  { pharmacyId: 'beta', pharmacyName: 'Farmacia Beta', delegationCodes: [] },
];
beforeEach(() => {
  for (const method of Object.values(api)) method.mockReset();
  api.session.mockResolvedValue({ email: 'persona@example.invalid' });
  api.memberships.mockResolvedValue(pharmacies);
});
afterEach(cleanup);

describe('sesión y cambio de farmacia F08', () => {
  it('retira perfil, selector y datos privados cuando F01 declara la sesión terminada', async () => {
    render(<IdentityApp inventoryMode />);
    expect(await screen.findByRole('heading', { name: 'Sesión activa' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Farmacia Alfa' })).toBeTruthy();
    api.session.mockResolvedValueOnce(null);
    fireEvent(window, new Event('focus'));
    expect(await screen.findByText(/Tu sesión terminó o expiró/)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Sesión activa' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Farmacia Alfa' })).toBeNull();
    expect(screen.queryByText('persona@example.invalid')).toBeNull();
  });

  it('una denegación de selección Beta no deja un contexto de farmacia ajena', async () => {
    api.selectPharmacy.mockRejectedValue(new Error('403'));
    render(<IdentityApp />);
    const beta = await screen.findByRole('button', { name: 'Farmacia Beta' });
    fireEvent.click(beta);
    await waitFor(() => expect(api.selectPharmacy).toHaveBeenCalledWith('beta'));
    expect(await screen.findByText('No se pudo acceder a las farmacias autorizadas.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Farmacia Beta' })).toBeNull();
  });
});
