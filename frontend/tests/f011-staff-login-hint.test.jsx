// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StaffAdmin, nameLooksLikeUsername } from '../src/identity/StaffAdmin.jsx';

afterEach(cleanup);

const jose = { membershipId: 'm1', userId: 'u1', alias: 'jose', displayName: 'JOSE_01', state: 'ACTIVA', pendingTemporaryKey: true, capabilities: [] };

describe('F01.1 · «Personal»: usuario para entrar visible (mejora 2026-11-26)', () => {
  it('detecta nombres que parecen usuario sin marcar nombres reales', () => {
    expect(nameLooksLikeUsername('JOSE_01', 'jose')).toBe(true);
    expect(nameLooksLikeUsername('caja.2', 'jose')).toBe(true);
    expect(nameLooksLikeUsername('José Pérez', 'jose')).toBe(false);
    expect(nameLooksLikeUsername('Jose', 'jose')).toBe(false);
    expect(nameLooksLikeUsername('jose_01', 'jose_01')).toBe(false); // coincide con el usuario: no confunde
  });

  it('la lista muestra «Usuario para entrar» y el nombre por separado', async () => {
    render(<StaffAdmin pharmacyId="a" api={{ list: vi.fn().mockResolvedValue([jose]), create: vi.fn() }} />);
    const row = (await screen.findByText('JOSE_01')).closest('li');
    expect(row.textContent).toContain('Usuario para entrar: jose');
  });

  it('avisa en el formulario y en el aviso de la clave temporal', async () => {
    const api = { list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ alias: 'maria', temporaryPassword: 'ABCDEFGH-JKMNPQRS-TVWXYZ01-23456789', expiresAt: '2026-11-27T10:00:00.000Z' }) };
    render(<StaffAdmin pharmacyId="a" api={api} />);
    await screen.findByText('Personal de la farmacia');
    fireEvent.change(screen.getByLabelText('Usuario (alias) del trabajador'), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText('Nombre para mostrar'), { target: { value: 'MARIA_02' } });
    expect(screen.getByText(/Este nombre parece un usuario/).textContent).toContain('maria');
    expect(screen.getByLabelText('Nombre para mostrar').getAttribute('aria-describedby')).toBe('staff-name-warning');
    fireEvent.submit(screen.getByText('Crear cuenta de trabajador').closest('form'));
    const notice = (await screen.findByLabelText('Clave temporal')).closest('[role="alert"]');
    expect(notice.textContent).toContain('Usuario para entrar: maria');
    expect(notice.textContent).toContain('no con su nombre «MARIA_02»');
    expect(screen.queryByText(/Este nombre parece un usuario/)).toBeNull(); // el formulario quedó limpio
  });
});
