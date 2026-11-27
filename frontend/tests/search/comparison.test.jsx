import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PublicSearch } from '../../src/search/PublicSearch.jsx';

describe('comparación pública F03',()=>{
  it('ofrece filtros, ubicación voluntaria y alternativa textual',()=>{
    const html=renderToStaticMarkup(<PublicSearch/>);
    expect(html).toContain('Precio mínimo'); expect(html).toContain('Precio máximo');
    // F03.1: la ubicación se elige en «¿Dónde buscas?»; el orden por cercanía es «Más cercano».
    expect(html).toContain('Sin ubicación'); expect(html).toContain('Elegir'); expect(html).toContain('Más cercano');
    expect(html).not.toContain('Latitud'); expect(html).not.toContain('Longitud');
    expect(html).toContain('Compara información referencial');
  });
});
