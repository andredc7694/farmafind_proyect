// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PublicSearch } from '../../src/search/PublicSearch.jsx';

beforeEach(() => { window.localStorage.clear(); window.history.replaceState(null, '', '/search'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const offer = (id, concentracion, presentacion, cents) => ({ medicamento: { id, nombreComercial: 'paracetamol', principioActivo: 'paracetamol',
  concentracion, presentacion }, farmacia: { id: 'a', nombre: 'Farmacia Alfa', direccion: 'Jr. Alfa 1', ubicacion: null },
precioReferencialCentavos: cents, disponibilidadReferencial: 'DISPONIBLE', ultimaRevision: '2026-11-27T10:00:00.000Z', distanciaKm: null });
const page = (ofertas, coincidencia) => ({ consulta: 'q', ofertas, paginacion: { pagina: 1, tamano: 20, total: ofertas.length, totalPaginas: 1 },
  aviso: 'Referencial.', ...(coincidencia ? { coincidencia } : {}) });
const NOTICE = 'No encontramos esa presentación exacta; estas son otras disponibles.';
const HELP = 'Escribe también el nombre del medicamento, por ejemplo: paracetamol 500 mg.';

async function searchFor(data, text = 'paracetamol 750 mg') {
  const client = { search: vi.fn().mockResolvedValue(data), suggest: vi.fn().mockResolvedValue([]) };
  render(<PublicSearch client={client} />);
  fireEvent.change(screen.getByLabelText('Nombre comercial o principio activo'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  await screen.findByText(/resultado\(s\)/);
  return client;
}

describe('F03.2 · aviso y ayuda en la búsqueda (T010, FR-005, FR-013)', () => {
  it('APROXIMADA: muestra el aviso como estado accesible, junto a los resultados', async () => {
    await searchFor(page([offer('m1', '500 mg', 'tabletas x 10', 250), offer('m2', '1 g', 'tabletas x 10', 600)], 'APROXIMADA'));
    expect(screen.getAllByRole('status').some(element => element.textContent === NOTICE)).toBe(true);
    expect(screen.getAllByText('Farmacia Alfa').length).toBeGreaterThan(0);
  });
  it('el aviso también se ve en la vista Mapa', async () => {
    await searchFor(page([offer('m1', '500 mg', 'tabletas x 10', 250)], 'APROXIMADA'));
    fireEvent.click(screen.getByRole('button', { name: 'Mapa' }));
    expect(screen.getByText(NOTICE)).toBeTruthy();
  });
  it('EXACTA o respuesta sin el campo (vieja): sin aviso', async () => {
    await searchFor(page([offer('m1', '500 mg', 'tabletas x 10', 250)], 'EXACTA'), 'paracetamol 500');
    expect(screen.queryByText(NOTICE)).toBeNull();
    cleanup();
    await searchFor(page([offer('m1', '500 mg', 'tabletas x 10', 250)]), 'paracetamol');
    expect(screen.queryByText(NOTICE)).toBeNull();
  });
  it('FALTA_NOMBRE: ayuda en lugar del vacío genérico', async () => {
    await searchFor(page([], 'FALTA_NOMBRE'), 'tabletas');
    expect(screen.getByText('Falta el nombre del medicamento')).toBeTruthy();
    expect(screen.getByText(HELP)).toBeTruthy();
    expect(screen.queryByText(/No encontramos ofertas publicadas/)).toBeNull();
  });
  it('NINGUNA (o sin campo): vacío de siempre, sin ayuda ni aviso', async () => {
    for (const coincidencia of ['NINGUNA', undefined]) {
      await searchFor(page([], coincidencia), 'xyzol 500 mg');
      expect(screen.getByText(/No encontramos ofertas publicadas/)).toBeTruthy();
      expect(screen.queryByText(HELP)).toBeNull(); expect(screen.queryByText(NOTICE)).toBeNull();
      cleanup();
    }
  });
});
