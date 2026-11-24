// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PointPicker } from '../../src/geolocation/PointPicker.jsx';
import { LocationAdmin } from '../../src/geolocation/LocationAdmin.jsx';

afterEach(cleanup);

function fakeLeaflet() {
  const handlers = {}; const marker = { setLatLng: vi.fn(), addTo: vi.fn(() => marker) };
  const map = { setView: vi.fn(() => map), on: vi.fn((name, fn) => { handlers[name] = fn; }), remove: vi.fn(), panTo: vi.fn() };
  const tiles = { on: vi.fn(), addTo: vi.fn() };
  const L = { map: vi.fn(() => map), tileLayer: vi.fn(() => tiles), circleMarker: vi.fn(() => marker) };
  return { L, map, handlers, marker, loader: vi.fn().mockResolvedValue({ default: L }) };
}
function Host({ getPosition, loadLeaflet, initial = null }) {
  const [point, setPoint] = useState(initial);
  return <><PointPicker value={point} onChange={setPoint} getPosition={getPosition} loadLeaflet={loadLeaflet} /><output data-testid="point">{point ? `${point.latitude},${point.longitude}` : 'ninguno'}</output></>;
}

describe('F08.1 elección del punto', () => {
  it('no carga el mapa ni pide mosaicos hasta un clic informado, y explica que el proveedor ve la IP', () => {
    const { loader } = fakeLeaflet();
    render(<Host loadLeaflet={loader} />);
    expect(loader).not.toHaveBeenCalled();
    expect(screen.getByText(/verá tu dirección IP/)).toBeTruthy();
    expect(screen.queryByRole('application')).toBeNull();
  });

  it('tras consentir muestra el mapa, un clic mueve el punto y las flechas lo ajustan con teclado', async () => {
    const { loader, handlers, map } = fakeLeaflet();
    render(<Host loadLeaflet={loader} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar el mapa para elegir el punto' }));
    await waitFor(() => expect(handlers.click).toBeTypeOf('function'));
    expect(map.setView).toHaveBeenCalled();
    handlers.click({ latlng: { lat: -12.05, lng: -77.04 } });
    await waitFor(() => expect(screen.getByTestId('point').textContent).toBe('-12.05,-77.04'));
    const area = screen.getByRole('application'); expect(area.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(area, { key: 'ArrowUp' }); fireEvent.keyDown(area, { key: 'ArrowRight' });
    expect(screen.getByTestId('point').textContent).toBe('-12.0495,-77.0395');
    fireEvent.keyDown(area, { key: 'a' }); expect(screen.getByTestId('point').textContent).toBe('-12.0495,-77.0395');
  });

  it('el GPS se usa una sola vez, se aplica el punto y si se niega hay un mensaje claro sin romper nada', async () => {
    const ok = vi.fn().mockResolvedValue({ latitude: -12.1, longitude: -77.1 });
    render(<Host getPosition={ok} loadLeaflet={fakeLeaflet().loader} />);
    fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación una vez' }));
    await waitFor(() => expect(screen.getByTestId('point').textContent).toBe('-12.1,-77.1'));
    expect(ok).toHaveBeenCalledTimes(1); expect(screen.getByText(/No se guarda como rastro/)).toBeTruthy();
    cleanup();
    render(<Host getPosition={vi.fn().mockRejectedValue(new Error('denegado'))} loadLeaflet={fakeLeaflet().loader} />);
    fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación una vez' }));
    expect(await screen.findByText(/No se pudo obtener la ubicación/)).toBeTruthy();
    expect(screen.getByTestId('point').textContent).toBe('ninguno');
  });

  it('el GPS usa una lectura puntual sin seguimiento ni posiciones antiguas', async () => {
    const getCurrentPosition = vi.fn((success) => success({ coords: { latitude: -12, longitude: -77 } })); const watchPosition = vi.fn();
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition, watchPosition } });
    render(<Host loadLeaflet={fakeLeaflet().loader} />);
    fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación una vez' }));
    await waitFor(() => expect(screen.getByTestId('point').textContent).toBe('-12,-77'));
    expect(getCurrentPosition.mock.calls[0][2]).toMatchObject({ maximumAge: 0 }); expect(watchPosition).not.toHaveBeenCalled();
  });

  it('si el mapa falla se ofrece escribir las coordenadas y no se guarda nada en el navegador', async () => {
    window.localStorage.clear();
    render(<Host loadLeaflet={vi.fn().mockRejectedValue(new Error('sin red'))} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar el mapa para elegir el punto' }));
    expect((await screen.findByRole('alert')).textContent).toContain('escribir las coordenadas');
    expect(window.localStorage.length).toBe(0);
  });
});

describe('F08.1 propuesta de ubicación del propietario', () => {
  it('el punto elegido llena los campos, exige confirmar la dirección y envía el mismo contrato de siempre', async () => {
    const client = { propose: vi.fn().mockResolvedValue({ id: 'p1', estado: 'PENDIENTE' }), review: vi.fn() };
    render(<LocationAdmin pharmacyId="alfa" delegationCodes={['GEO_LOCATION_PROPOSE']} client={client} />);
    fireEvent.change(screen.getByLabelText(/Latitud/), { target: { value: '-12.04' } });
    fireEvent.change(screen.getByLabelText(/Longitud/), { target: { value: '-77.03' } });
    const form = screen.getByRole('button', { name: 'Enviar propuesta' }).closest('form');
    expect(screen.getByLabelText(/Confirmo que la dirección pública y el punto/).required).toBe(true);
    for (const [label, value] of [['Dirección pública', 'Av. Ficticia 100'], ['Ciudad', 'Lima'], ['Fuente', 'Visita ficticia'], ['Referencia de evidencia no sensible', 'acta-001']]) {
      fireEvent.change(screen.getByLabelText(new RegExp(label)), { target: { value } });
    }
    fireEvent.click(screen.getByLabelText(/Confirmo que la dirección pública y el punto/));
    fireEvent.submit(form);
    await waitFor(() => expect(client.propose).toHaveBeenCalledWith('alfa', { direccionPublicable: 'Av. Ficticia 100', ciudad: 'Lima', latitud: -12.04, longitud: -77.03,
      fuente: 'Visita ficticia', evidenciaReferencia: 'acta-001' }));
    expect(Object.keys(client.propose.mock.calls[0][1])).not.toContain('confirmaDireccion');
  });

  it('sin la capacidad de proponer no se muestra el selector de punto', () => {
    render(<LocationAdmin pharmacyId="alfa" delegationCodes={['GEO_LOCATION_REVIEW']} client={{ propose: vi.fn(), review: vi.fn() }} />);
    expect(screen.queryByText('Elegir el punto')).toBeNull();
  });
});
