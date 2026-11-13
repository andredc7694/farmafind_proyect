import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createPublicSearchClient } from '../../src/search/search-client.js';
import { PublicSearch } from '../../src/search/PublicSearch.jsx';

describe('búsqueda pública React F03', () => {
  it('renderiza formulario accesible, aviso y estado inicial en español', () => {
    const html = renderToStaticMarkup(<PublicSearch />);
    expect(html).toContain('Buscar medicamentos');
    expect(html).toContain('Nombre comercial o principio activo');
    expect(html).not.toContain('cantidadFisica');
  });
  it('cliente no envía sesión ni secretos', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ofertas: [] }) });
    await createPublicSearchClient(fetcher).search({ q: 'paracetamol', pagina: 1 });
    expect(fetcher.mock.calls[0][0]).toContain('/api/v1/busquedas?q=paracetamol');
    expect(fetcher.mock.calls[0][1]).toEqual({ cache: 'no-store' });
  });
});
