// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

// Selector de punto simulado: un punto cerca de Ayacucho y otro en Moquegua (caso real de HUAMANFAR).
vi.mock('../../src/geolocation/PointPicker.jsx', () => ({ PointPicker: ({ onChange }) => <div>
  <button type="button" onClick={() => onChange({ latitude: -13.16, longitude: -74.22 }, 'gps')}>Punto en Ayacucho</button>
  <button type="button" onClick={() => onChange({ latitude: -17.195, longitude: -70.936 }, 'map')}>Punto en Moquegua</button>
</div> }));
import { LocationAdmin } from '../../src/geolocation/LocationAdmin.jsx';
import { LocationReview } from '../../src/geolocation/LocationReview.jsx';
import { FAR_THRESHOLD_KM, distanceMessage, distanceWarning, findCityCenter } from '../../src/geolocation/distance-check.js';

afterEach(cleanup);
const noStatus = { status: vi.fn().mockRejectedValue(new Error('x')) };
const quietReverse = vi.fn().mockResolvedValue(null);
function setupAdmin({ propose = vi.fn().mockResolvedValue({ id: 'p1', estado: 'PENDIENTE', version: 1 }), search = vi.fn() } = {}) {
  render(<LocationAdmin pharmacyId="alfa" delegationCodes={['GEO_LOCATION_PROPOSE']} client={{ propose }}
    statusClient={noStatus} suggestionClient={{ search, reverse: quietReverse }} />);
  return { propose, search };
}
function fill({ city = 'Ayacucho', point = 'Punto en Ayacucho' } = {}) {
  fireEvent.change(screen.getByLabelText('Ciudad o distrito'), { target: { value: city } });
  fireEvent.change(screen.getByLabelText('Dirección pública'), { target: { value: 'Jr. Ficticio 123' } });
  fireEvent.click(screen.getByRole('button', { name: point }));
  fireEvent.click(screen.getByLabelText(/Confirmo que la dirección pública/));
}
const submitButton = () => screen.getByRole('button', { name: 'Enviar propuesta' });

describe('F07.2 · aviso de distancia con la lista interna (T007)', () => {
  it('HUAMANFAR aprobada en Moquegua con ciudad Ayacucho: 571 km', () => {
    expect(distanceWarning('ayacucho', { latitude: -17.195, longitude: -70.936 })).toEqual({ tipo: 'lejos', km: 571, ciudad: 'Ayacucho' });
    expect(distanceMessage({ tipo: 'lejos', km: 571, ciudad: 'Ayacucho' })).toBe('Este punto está a 571 km de Ayacucho. ¿Es correcto?');
  });
  it('cerca (≤ 30 km) no avisa; distritos de Huamanga y ciudades sin tilde se reconocen', () => {
    expect(FAR_THRESHOLD_KM).toBe(30);
    expect(distanceWarning('Ayacucho', { latitude: -13.165, longitude: -74.216 })).toBeNull();
    expect(distanceWarning('carmen alto', { latitude: -13.18, longitude: -74.22 })).toBeNull();
    expect(findCityCenter('HUANUCO')).toMatchObject({ name: 'Huánuco' });
    expect(distanceWarning('Quinua', { latitude: -12.05, longitude: -77.04 })).toMatchObject({ tipo: 'lejos', ciudad: 'Quinua' });
  });
  it('ciudad fuera de la lista: aviso de que no se puede comprobar; sin ciudad o sin punto, nada', () => {
    expect(distanceMessage(distanceWarning('Pueblo inventado', { latitude: -13, longitude: -74 })))
      .toBe('No podemos comprobar la distancia: «Pueblo inventado» no está en nuestra lista de ciudades.');
    expect(distanceWarning('', { latitude: -13, longitude: -74 })).toBeNull();
    expect(distanceWarning('Ayacucho', null)).toBeNull();
  });
});

describe('F07.2 · «Mi farmacia»: un solo envío (FR-001, T005)', () => {
  it('doble clic en el mismo instante: una sola petición', async () => {
    let resolve;
    const propose = vi.fn(() => new Promise(done => { resolve = done; }));
    setupAdmin({ propose }); fill();
    const form = submitButton().closest('form');
    fireEvent.submit(form); fireEvent.submit(form);
    expect(propose).toHaveBeenCalledTimes(1);
    resolve({ id: 'p1', estado: 'PENDIENTE', version: 1 });
    await screen.findByText(/Propuesta enviada\. Queda «En revisión»/);
  });
  it('tras el éxito el botón queda desactivado hasta cambiar algún dato; al cambiarlo se puede enviar otra', async () => {
    const { propose } = setupAdmin(); fill();
    fireEvent.submit(submitButton().closest('form'));
    await screen.findByText('Propuesta enviada; cambia algún dato para enviar otra.');
    expect(submitButton().disabled).toBe(true);
    fireEvent.submit(submitButton().closest('form'));
    expect(propose).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Dirección pública'), { target: { value: 'Jr. Ficticio 125' } });
    expect(submitButton().disabled).toBe(false);
    fireEvent.submit(submitButton().closest('form'));
    await waitFor(() => expect(propose).toHaveBeenCalledTimes(2));
  });
  it('si el envío falla, se puede reintentar sin cambiar nada', async () => {
    const propose = vi.fn().mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue({ id: 'p1', estado: 'PENDIENTE', version: 1 });
    setupAdmin({ propose }); fill();
    fireEvent.submit(submitButton().closest('form'));
    await screen.findByText('Sin conexión');
    expect(submitButton().disabled).toBe(false);
    fireEvent.submit(submitButton().closest('form'));
    await waitFor(() => expect(propose).toHaveBeenCalledTimes(2));
  });
});

describe('F07.2 · «Mi farmacia»: búsqueda limitada y aviso (FR-006, FR-007, FR-009, T008)', () => {
  it('envía el centro de la ciudad y, sin resultados en la zona, orienta (texto pedido por Andre)', async () => {
    const { search } = setupAdmin({ search: vi.fn().mockResolvedValue(null) });
    fireEvent.change(screen.getByLabelText('Ciudad o distrito'), { target: { value: 'Ayacucho' } });
    fireEvent.change(screen.getByLabelText('Dirección pública'), { target: { value: 'Jr. Inexistente 999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar en el mapa' }));
    expect(await screen.findByText('No encontramos esa dirección en Ayacucho. Revisa cómo está escrita o marca el punto tocando el mapa.')).toBeTruthy();
    expect(search).toHaveBeenCalledWith('alfa', { direccion: 'Jr. Inexistente 999', ciudad: 'Ayacucho', centro: { latitud: -13.1603, longitud: -74.2253 } });
  });
  it('ciudad fuera de la lista: busca sin centro y avisa que no pudo limitar', async () => {
    const { search } = setupAdmin({ search: vi.fn().mockResolvedValue(null) });
    fireEvent.change(screen.getByLabelText('Ciudad o distrito'), { target: { value: 'Pueblo inventado' } });
    fireEvent.change(screen.getByLabelText('Dirección pública'), { target: { value: 'Jr. Ficticio 123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar en el mapa' }));
    expect(await screen.findByText('No pudimos limitar la búsqueda a «Pueblo inventado»: no está en nuestra lista de ciudades.')).toBeTruthy();
    expect(screen.getByText('No encontramos esa dirección. Revisa cómo está escrita o marca el punto tocando el mapa.')).toBeTruthy();
    expect(search).toHaveBeenCalledWith('alfa', { direccion: 'Jr. Ficticio 123', ciudad: 'Pueblo inventado' });
  });
  it('punto lejano: aviso junto al botón y el envío sigue permitido', async () => {
    const { propose } = setupAdmin(); fill({ point: 'Punto en Moquegua' });
    expect(screen.getByText('Este punto está a 571 km de Ayacucho. ¿Es correcto?')).toBeTruthy();
    expect(submitButton().disabled).toBe(false);
    fireEvent.submit(submitButton().closest('form'));
    await waitFor(() => expect(propose).toHaveBeenCalledTimes(1));
  });
  it('punto cercano: sin aviso', () => {
    setupAdmin(); fill();
    expect(screen.queryByText(/Este punto está a/)).toBeNull();
  });
});

describe('F07.2 · «Revisar ubicaciones» (FR-005, FR-008, FR-009, T009)', () => {
  const far = { propuestaId: 'p1', farmaciaId: 'f1', farmaciaNombre: 'Farmacia Lejana (ficticia)', direccionPublicable: 'Jr. Ficticio 123', ciudad: 'ayacucho',
    latitud: -17.195, longitud: -70.936, precisionMetros: null, fuente: 'Dirección buscada', evidenciaReferencia: null, version: 1, propuestaAt: '2026-11-27T22:00:00.000Z' };
  it('propuesta lejana: el revisor ve el aviso antes de decidir y puede aprobar igual', async () => {
    const decide = vi.fn().mockResolvedValue({});
    render(<LocationReview client={{ list: vi.fn().mockResolvedValue([far]), history: vi.fn(), decide }} />);
    const card = (await screen.findByText('Farmacia Lejana (ficticia)')).closest('li');
    expect(within(card).getByText('Este punto está a 571 km de Ayacucho. ¿Es correcto?')).toBeTruthy();
    fireEvent.click(within(card).getByLabelText('Comprobé la dirección y el punto'));
    fireEvent.change(within(card).getByLabelText('Motivo'), { target: { value: 'Revisado' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Registrar decisión' }));
    await waitFor(() => expect(decide).toHaveBeenCalledWith('p1', { decision: 'APROBAR', version: 1, evidenciaConfirmada: true, motivo: 'Revisado' }));
  });
  it('filtro «Reemplazadas»: fila con «Reemplazada», fecha de reemplazo y motivo', async () => {
    const history = vi.fn().mockResolvedValue({ pagina: 1, porPagina: 20, total: 1, filas: [{ propuestaId: 'vieja', farmaciaNombre: 'STUART-FAR (ficticia)',
      direccion: 'Jr. Ficticio 123', ciudad: 'ayacucho', latitud: -13.165, longitud: -74.216, decision: 'REEMPLAZADA', motivo: 'Se envió una propuesta más reciente',
      enviadaAt: '2026-11-27T22:33:42.000Z', decididaAt: '2026-11-27T22:33:46.000Z', decididoPor: null }] });
    render(<LocationReview client={{ list: vi.fn().mockResolvedValue([]), history, decide: vi.fn() }} />);
    await screen.findByText('No hay ubicaciones pendientes de revisión.');
    fireEvent.click(screen.getByRole('button', { name: 'Reemplazadas' }));
    const card = (await screen.findByText('STUART-FAR (ficticia)')).closest('li');
    expect(history).toHaveBeenCalledWith('REEMPLAZADA', 1);
    for (const text of ['Reemplazada', 'Se envió una propuesta más reciente']) expect(within(card).getAllByText(text).length).toBeGreaterThan(0);
    expect(within(card).queryByText(/Este punto está a/)).toBeNull();
  });
  it('«Reemplazadas» vacío', async () => {
    render(<LocationReview client={{ list: vi.fn().mockResolvedValue([]), decide: vi.fn(),
      history: vi.fn().mockResolvedValue({ pagina: 1, porPagina: 20, total: 0, filas: [] }) }} />);
    await screen.findByText('No hay ubicaciones pendientes de revisión.');
    fireEvent.click(screen.getByRole('button', { name: 'Reemplazadas' }));
    expect(await screen.findByText('No hay propuestas reemplazadas.')).toBeTruthy();
  });
});
