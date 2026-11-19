import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Home } from '../../src/app/Home.jsx';
import { AppShell } from '../../src/app/AppShell.jsx';
import { pharmacyNavigation, publicNavigation } from '../../src/app/routes.js';

describe('navegación pública F08', () => {
  it('presenta rutas funcionales y conserva el marcador técnico F00', () => {
    const html = renderToStaticMarkup(<AppShell path="/"><Home /></AppShell>);
    expect(html).toContain('Encuentra información para');
    expect(html).toContain('FarmaFind — Bootstrap');
    expect(html).toContain('Modo técnico: sin funcionalidades de negocio');
    for (const route of publicNavigation) expect(html).toContain(`href="${route.href}"`);
    expect(html).toContain('Saltar al contenido');
    expect(html).not.toContain('href="/inventory"');
    expect(html).not.toContain('href="/ubicacion"');
  });

  it('solo muestra ubicación administrativa con una capacidad GEO explícita', () => {
    expect(pharmacyNavigation([])).toEqual([]);
    expect(pharmacyNavigation([{ pharmacyId: 'alfa', delegationCodes: [] }])).toEqual([]);
    expect(pharmacyNavigation([{ pharmacyId: 'alfa', delegationCodes: ['inventory.read', 'GEO_LOCATION_PROPOSE'] }])
      .map(link => link.href)).toEqual(['/inventory', '/ubicacion']);
  });
});
