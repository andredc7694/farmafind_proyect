// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/identity/session-client.js', () => ({
  createSessionClient: () => ({ session: vi.fn().mockRejectedValue(new Error('offline')) }),
}));

import { IdentityApp } from '../../src/identity/IdentityApp.jsx';

afterEach(cleanup);

describe('identidad y reservas F08', () => {
  it('distingue caída de API de credenciales erróneas en una ruta protegida', async () => {
    render(<IdentityApp reservationsMode />);
    expect(await screen.findByText(/El servicio de identidad no está disponible temporalmente/)).toBeTruthy();
    expect(screen.queryByText(/Revisa los datos e inténtalo de nuevo/)).toBeNull();
  });
});
