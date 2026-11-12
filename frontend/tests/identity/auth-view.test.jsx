import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AuthView } from '../../src/identity/AuthView.jsx';

function markup(props = {}) {
  return renderToStaticMarkup(<AuthView onRegister={vi.fn()} onLogin={vi.fn()} onLogout={vi.fn()} {...props} />);
}

describe('vista aislada de identidad F01', () => {
  it('ofrece registro y acceso sin credenciales embebidas', () => {
    const html = markup();
    expect(html).toContain('Crear cuenta');
    expect(html).toContain('Iniciar sesión');
    expect(html.match(/type="password"/g)).toHaveLength(2);
    expect(html).toContain('autoComplete="current-password"');
    expect(html).not.toContain('value="');
  });

  it('muestra error genérico sin reenviar detalles del servidor ni enumerar cuentas', () => {
    const html = markup({ error: true });
    expect(html).toContain('No se pudo completar la solicitud');
    expect(html).not.toContain('cuenta inexistente');
  });

  it('muestra sesión activa y salida sin conservar formularios de credenciales', () => {
    const html = markup({ status: 'authenticated' });
    expect(html).toContain('Sesión activa');
    expect(html).toContain('Cerrar sesión');
    expect(html).not.toContain('type="password"');
  });
});
