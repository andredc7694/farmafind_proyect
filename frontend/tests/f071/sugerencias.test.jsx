// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

// Selector de punto simulado: expone el foco recibido y permite «hacer clic en el mapa».
const picker = vi.hoisted(() => ({ focus: null }));
vi.mock('../../src/geolocation/PointPicker.jsx', () => ({ PointPicker: ({ value, onChange, focus }) => {
  picker.focus = focus;
  return <div data-testid="picker" data-point={value ? `${value.latitude},${value.longitude}` : ''}>
    <button type="button" onClick={() => onChange({ latitude: -13.1631, longitude: -74.2244 }, 'map')}>Clic en el mapa simulado</button>
    <button type="button" onClick={() => onChange({ latitude: -13.16, longitude: -74.22 }, 'gps')}>GPS simulado</button>
  </div>;
} }));
import { LocationAdmin, SOURCE_LABEL } from '../../src/geolocation/LocationAdmin.jsx';
import { PERU_PLACES, findPeruPlace } from '../../src/geolocation/peru-cities.js';

afterEach(() => { cleanup(); picker.focus = null; });
const noStatus = { status: vi.fn().mockRejectedValue(new Error('x')) };
function setup(suggestionClient, propose = vi.fn().mockResolvedValue({ id: 'p1', estado: 'PENDIENTE' })) {
  render(<LocationAdmin pharmacyId="alfa" delegationCodes={['GEO_LOCATION_PROPOSE']} client={{ propose }}
    statusClient={noStatus} suggestionClient={suggestionClient} />);
  return propose;
}

describe('F07.1 · respaldo interno de ciudades (FR-015, sin servicio externo)', () => {
  it('incluye todas las capitales departamentales, el Callao y Ayacucho; ignora tildes y mayúsculas', () => {
    const capitals = ['Chachapoyas', 'Huaraz', 'Abancay', 'Arequipa', 'Ayacucho', 'Cajamarca', 'Callao', 'Cusco', 'Huancavelica', 'Huánuco',
      'Ica', 'Huancayo', 'Trujillo', 'Chiclayo', 'Lima', 'Iquitos', 'Puerto Maldonado', 'Moquegua', 'Cerro de Pasco', 'Piura', 'Puno',
      'Moyobamba', 'Tacna', 'Tumbes', 'Pucallpa'];
    for (const name of capitals) expect(findPeruPlace(name), name).not.toBeNull();
    expect(findPeruPlace('  HUANUCO ')).toMatchObject({ name: 'Huánuco' });
    expect(findPeruPlace('Madrid')).toBeNull();
    expect(PERU_PLACES.every(place => place.latitude >= -18.4 && place.latitude <= 0.1 && place.longitude >= -81.4 && place.longitude <= -68.6)).toBe(true);
  });
  it('al escribir la ciudad, el mapa se centra sin llamar al servicio', () => {
    const suggestionClient = { search: vi.fn(), reverse: vi.fn() };
    setup(suggestionClient);
    fireEvent.change(screen.getByLabelText('Ciudad o distrito'), { target: { value: 'ayacucho' } });
    expect(picker.focus).toMatchObject({ latitude: -13.1588, longitude: -74.2239, zoom: 14 });
    expect(suggestionClient.search).not.toHaveBeenCalled();
  });
});

describe('F07.1 · «Buscar en el mapa» (FR-013)', () => {
  it('solo al pulsar: coloca el punto, centra el mapa y la fuente queda «Dirección buscada»', async () => {
    const suggestionClient = { search: vi.fn().mockResolvedValue({ latitud: -13.1631, longitud: -74.2244, etiqueta: 'Jr. 28 de Julio, Ayacucho' }), reverse: vi.fn() };
    setup(suggestionClient);
    const button = screen.getByRole('button', { name: 'Buscar en el mapa' });
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Ciudad o distrito'), { target: { value: 'Ayacucho' } });
    fireEvent.change(screen.getByLabelText('Dirección pública'), { target: { value: 'Jr. 28 de Julio 145' } });
    expect(suggestionClient.search).not.toHaveBeenCalled(); // sin autocompletado letra por letra
    fireEvent.click(button);
    await waitFor(() => expect(suggestionClient.search).toHaveBeenCalledWith('alfa', { direccion: 'Jr. 28 de Julio 145', ciudad: 'Ayacucho' }));
    expect(await screen.findByText(/Dirección encontrada/)).toBeTruthy();
    expect(screen.getByTestId('picker').getAttribute('data-point')).toBe('-13.1631,-74.2244');
    expect(picker.focus).toMatchObject({ zoom: 17 });
    expect(screen.getByText(`Fuente: ${SOURCE_LABEL.search}`)).toBeTruthy();
  });
  it('servicio apagado o caído: mensaje claro y el formulario sigue funcionando', async () => {
    const suggestionClient = { search: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { status: 503 })), reverse: vi.fn() };
    setup(suggestionClient);
    fireEvent.change(screen.getByLabelText('Ciudad o distrito'), { target: { value: 'Lima' } });
    fireEvent.change(screen.getByLabelText('Dirección pública'), { target: { value: 'Av. Larco 345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar en el mapa' }));
    expect(await screen.findByText(/no está disponible ahora/)).toBeTruthy();
    expect(picker.focus).toMatchObject({ latitude: -12.0464 }); // el respaldo interno ya centró en Lima
  });
});

describe('F07.1 · completar al marcar en el mapa (FR-014)', () => {
  it('rellena calle y ciudad sin número y avisa «Ubicación aproximada»', async () => {
    const suggestionClient = { search: vi.fn(), reverse: vi.fn().mockResolvedValue({ calle: 'Jirón 28 de Julio', ciudad: 'Ayacucho' }) };
    setup(suggestionClient);
    fireEvent.click(screen.getByRole('button', { name: 'Clic en el mapa simulado' }));
    await waitFor(() => expect(screen.getByLabelText('Dirección pública').value).toBe('Jirón 28 de Julio'));
    expect(screen.getByLabelText('Ciudad o distrito').value).toBe('Ayacucho');
    expect(screen.getByText('Ubicación aproximada: completa el número.')).toBeTruthy();
    expect(screen.getByText(`Fuente: ${SOURCE_LABEL.map}`)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Dirección pública'), { target: { value: 'Jirón 28 de Julio 145' } }); // los campos siguen editables
    expect(screen.queryByText('Ubicación aproximada: completa el número.')).toBeNull();
  });
  it('sin resultado deja los campos como estaban, sin error; el GPS no consulta el servicio', async () => {
    const suggestionClient = { search: vi.fn(), reverse: vi.fn().mockResolvedValue(null) };
    setup(suggestionClient);
    fireEvent.change(screen.getByLabelText('Dirección pública'), { target: { value: 'Mi dirección' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clic en el mapa simulado' }));
    await waitFor(() => expect(suggestionClient.reverse).toHaveBeenCalledOnce());
    expect(screen.getByLabelText('Dirección pública').value).toBe('Mi dirección');
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'GPS simulado' }));
    expect(suggestionClient.reverse).toHaveBeenCalledOnce();
    expect(screen.getByText(`Fuente: ${SOURCE_LABEL.gps}`)).toBeTruthy();
  });
});

describe('F07.1 · formulario ordenado (FR-015)', () => {
  it('evidencia opcional con advertencia, coordenadas en avanzado y envío sin punto bloqueado', async () => {
    const propose = setup({ search: vi.fn(), reverse: vi.fn().mockResolvedValue(null) });
    expect(screen.getByPlaceholderText('Ej.: frente a la Plaza Mayor')).toBeTruthy();
    expect(screen.getByText('No escribas datos personales, documentos ni teléfonos.')).toBeTruthy();
    expect(screen.getByText('Opciones avanzadas: coordenadas').closest('details')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar propuesta' }).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Ciudad o distrito'), { target: { value: 'Ayacucho' } });
    fireEvent.change(screen.getByLabelText('Dirección pública'), { target: { value: 'Jr. 28 de Julio 145' } });
    fireEvent.click(screen.getByRole('button', { name: 'GPS simulado' }));
    fireEvent.click(screen.getByLabelText(/Confirmo que la dirección pública/));
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar propuesta' }).closest('form'));
    await waitFor(() => expect(propose).toHaveBeenCalledWith('alfa', { direccionPublicable: 'Jr. 28 de Julio 145', ciudad: 'Ayacucho',
      latitud: -13.16, longitud: -74.22, fuente: 'GPS del dispositivo' }));
  });
});
