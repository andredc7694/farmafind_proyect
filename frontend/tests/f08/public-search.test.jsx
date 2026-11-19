// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicSearch } from '../../src/search/PublicSearch.jsx';

afterEach(cleanup);

const offer = { medicamento: { id: 'm1', nombreComercial: 'Producto TEST', principioActivo: 'Principio TEST', concentracion: '1 mg', presentacion: 'caja' },
  farmacia: { id: 'a', nombre: 'Farmacia Alfa TEST', direccion: 'Calle ficticia' }, precioReferencialCentavos: 1250,
  ultimaRevision: '2026-11-18T12:00:00Z', distanciaKm: null };

describe('búsqueda F08', () => {
  it('muestra vacío honesto y paginación de la API sin calcular ofertas', async () => {
    const search = vi.fn().mockResolvedValue({ aviso: 'Información referencial TEST', ofertas: [],
      paginacion: { pagina: 1, totalPaginas: 0 } });
    render(<PublicSearch client={{ search }} />);
    fireEvent.change(screen.getByLabelText('Nombre comercial o principio activo'), { target: { value: 'sincoincidencia' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar', exact: true }));
    expect(await screen.findByText('Sin ofertas publicadas')).toBeTruthy();
    expect(screen.getByText('Página 1 de 1')).toBeTruthy();
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ q: 'sincoincidencia', pagina: 1 }));
  });

  it('compara solamente ofertas devueltas y no permite más de tres selecciones', async () => {
    const search = vi.fn().mockResolvedValue({ aviso: 'Referencial', ofertas: [offer,
      { ...offer, farmacia: { ...offer.farmacia, id: 'b', nombre: 'Farmacia Beta TEST' } },
      { ...offer, farmacia: { ...offer.farmacia, id: 'c', nombre: 'Farmacia Gamma TEST' } },
      { ...offer, farmacia: { ...offer.farmacia, id: 'd', nombre: 'Farmacia Delta TEST' } }],
      paginacion: { pagina: 1, totalPaginas: 1 } });
    render(<PublicSearch client={{ search }} />);
    fireEvent.change(screen.getByLabelText('Nombre comercial o principio activo'), { target: { value: 'producto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar', exact: true }));
    await waitFor(() => expect(screen.getAllByLabelText('Comparar esta oferta')).toHaveLength(4));
    const choices = screen.getAllByLabelText('Comparar esta oferta');
    fireEvent.click(choices[0]); fireEvent.click(choices[1]); fireEvent.click(choices[2]);
    expect(choices[3].disabled).toBe(true);
    expect(screen.getByRole('region', { name: 'Comparación de ofertas' })).toBeTruthy();
  });
});
