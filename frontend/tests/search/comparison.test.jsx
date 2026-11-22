import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PublicSearch } from '../../src/search/PublicSearch.jsx';

describe('comparación pública F03',()=>{
  it('ofrece filtros, ubicación voluntaria y alternativa textual',()=>{
    const html=renderToStaticMarkup(<PublicSearch/>);
    expect(html).toContain('Precio mínimo'); expect(html).toContain('Precio máximo');
    expect(html).toContain('Usar mi ubicación'); expect(html).toContain('Cercanía');
    expect(html).toContain('Compara información referencial');
  });
});
