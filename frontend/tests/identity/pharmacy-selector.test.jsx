import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PharmacySelector } from '../../src/identity/PharmacySelector.jsx';

const available = [
  { pharmacyId: 'a', pharmacyName: 'Farmacia A ficticia' },
  { pharmacyId: 'b', pharmacyName: 'Farmacia B ficticia' },
];

function markup(props = {}) {
  return renderToStaticMarkup(<PharmacySelector pharmacies={available} onSelect={vi.fn()} {...props} />);
}

describe('selector visual de farmacias propias', () => {
  it('muestra solo los establecimientos que entrega el caso de uso', () => {
    const html = markup({ pharmacies: [available[0]], activePharmacyId: 'a' });
    expect(html).toContain('Farmacia A ficticia');
    expect(html).not.toContain('Farmacia B ficticia');
    expect(html).toContain('aria-current="true"');
  });

  it('no expone establecimientos cuando la sesión está denegada o expirada', () => {
    for (const status of ['denied', 'expired']) {
      const html = markup({ status });
      expect(html).not.toContain('Farmacia A ficticia');
      expect(html).not.toContain('Farmacia B ficticia');
      expect(html).toContain('role="status"');
    }
  });

  it('presenta estados de carga, lista vacía y selección en curso sin autoridad local', () => {
    expect(markup({ status: 'loading' })).toContain('Cargando');
    expect(markup({ pharmacies: [] })).toContain('No tienes farmacias disponibles');
    expect(markup({ selectingPharmacyId: 'a' })).toContain('disabled=""');
  });

  it('delega la elección al controlador sin establecer permisos en el navegador', () => {
    const onSelect = vi.fn();
    const section = PharmacySelector({ pharmacies: [available[0]], onSelect });
    const list = section.props.children[1];
    const item = list.props.children[0];
    item.props.children.props.onClick();
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('a');
  });
});
