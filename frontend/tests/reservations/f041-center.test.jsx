// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PharmacyReservations } from '../../src/reservations/PharmacyReservations.jsx';
import { CreateReservation } from '../../src/reservations/CreateReservation.jsx';
import { OwnReservations } from '../../src/reservations/OwnReservations.jsx';
import { createPoller } from '../../src/reservations/polling.js';
import { buildPreference, describePreference } from '../../src/reservations/preference.js';
import { createReservationsClient } from '../../src/reservations/reservations-client.js';

afterEach(cleanup);
const response = (status, body = null, headers = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => String(body ?? ''),
  headers: { get: name => headers[name] ?? null } });

describe('F04.1 preferencia de recogida (cliente)', () => {
  const now = new Date('2026-11-24T15:00:00');
  it('arma 30/60/120 y franjas de hoy; rechaza franjas inválidas con un mensaje claro', () => {
    expect(buildPreference({ kind: 'none' }, now)).toEqual({ ok: true, value: undefined });
    expect(buildPreference({ kind: '60' }, now)).toEqual({ ok: true, value: { type: 'MINUTES', minutes: 60 } });
    expect(buildPreference({ kind: 'window', start: '15:30', end: '16:30' }, now).value).toMatchObject({ type: 'WINDOW' });
    for (const [start, end, text] of [['', '', 'hora de inicio'], ['15:30', '15:40', 'entre 15 y 120'], ['15:30', '18:00', 'entre 15 y 120'], ['14:00', '14:30', 'pasado']]) {
      const result = buildPreference({ kind: 'window', start, end }, now);
      expect(result.ok).toBe(false); expect(result.error).toContain(text);
    }
    expect(describePreference({ type: 'MINUTES', minutes: 30 })).toContain('no es una cita');
  });

  it('el formulario de creación ofrece la preferencia, avisa que no es cita y la envía; sin elegirla no envía nada', () => {
    const onCreate = vi.fn();
    render(<CreateReservation pharmacyId="a" medicationId="m" onCreate={onCreate} busy={false} />);
    fireEvent.submit(screen.getByText('Solicitar reserva', { selector: 'button' }).closest('form'));
    expect(onCreate).toHaveBeenLastCalledWith('m', 1, undefined);
    fireEvent.change(screen.getByLabelText(/¿Cuándo crees que podrías recoger/), { target: { value: '60' } });
    expect(screen.getByText(/no es una cita y no cambia el vencimiento/)).toBeTruthy();
    fireEvent.submit(screen.getByText('Solicitar reserva', { selector: 'button' }).closest('form'));
    expect(onCreate).toHaveBeenLastCalledWith('m', 1, { type: 'MINUTES', minutes: 60 });
    fireEvent.change(screen.getByLabelText(/¿Cuándo crees que podrías recoger/), { target: { value: 'window' } });
    fireEvent.submit(screen.getByText('Solicitar reserva', { selector: 'button' }).closest('form'));
    expect(screen.getByRole('alert').textContent).toContain('hora de inicio');
    expect(onCreate).toHaveBeenCalledTimes(2);
  });

  it('Mis reservas muestra la preferencia como orientación', () => {
    render(<OwnReservations busy={false} onCancel={() => {}} items={[{ id: '1', state: 'PENDIENTE', quantity: 1, pickupPreference: { type: 'MINUTES', minutes: 120 } }, { id: '2', state: 'PENDIENTE', quantity: 1, pickupPreference: null }]} />);
    expect(screen.getAllByText(/Preferencia estimada/)).toHaveLength(1);
  });

  it('el cliente HTTP envía la preferencia solo si existe y arma las consultas de lectura', async () => {
    const fetcher = vi.fn().mockImplementation(async url => url === '/api/v1/auth/csrf' ? response(200, { csrfToken: 't' }) : response(200, { generatedAt: 'x', items: [] }));
    const client = createReservationsClient(fetcher);
    await client.create('p', 'm', 2, { type: 'MINUTES', minutes: 30 }); await client.create('p', 'm', 2);
    const bodies = fetcher.mock.calls.filter(call => call[0] === '/api/v1/reservas').map(call => JSON.parse(call[1].body));
    expect(bodies[0]).toEqual({ pharmacyId: 'p', medicationId: 'm', quantity: 2, pickupPreference: { type: 'MINUTES', minutes: 30 } });
    expect(bodies[1]).toEqual({ pharmacyId: 'p', medicationId: 'm', quantity: 2 });
    await client.center('p', { estado: 'PENDIENTE', desde: undefined });
    await client.history('p', { limite: 25, cursor: 'abc' });
    const urls = fetcher.mock.calls.map(call => call[0]);
    expect(urls).toContain('/api/v1/farmacias/p/reservas/centro?estado=PENDIENTE');
    expect(urls).toContain('/api/v1/farmacias/p/reservas/historial?limite=25&cursor=abc');
  });
});

describe('F04.1 sondeo de la cola', () => {
  function harness(loads, visible = () => true) {
    const calls = []; const timers = []; const data = []; const statuses = [];
    const poller = createPoller({ load: vi.fn(async () => { const next = loads.shift(); if (next instanceof Error) throw next; return next; }),
      onData: value => data.push(value), onStatus: value => statuses.push(value), intervalMs: 30000, maxBackoffMs: 120000, isVisible: visible,
      schedule: (fn, ms) => { timers.push({ fn, ms }); calls.push(ms); return timers.length; }, cancel: () => undefined });
    return { poller, timers, calls, data, statuses, tickNext: async () => { const timer = timers.shift(); await timer.fn(); await Promise.resolve(); } };
  }
  const snapshot = (at, ids) => ({ generatedAt: at, items: ids.map(id => ({ id })) });

  it('repite cada 30 s, una petición a la vez, y descarta instantáneas más viejas', async () => {
    const h = harness([snapshot('2026-11-24T15:00:30Z', ['a']), snapshot('2026-11-24T15:00:00Z', ['viejo']), snapshot('2026-11-24T15:01:30Z', ['a', 'b'])]);
    h.poller.start(); await vi.waitFor(() => expect(h.data).toHaveLength(1));
    await h.tickNext(); await vi.waitFor(() => expect(h.statuses.length).toBe(2));
    await h.tickNext(); await vi.waitFor(() => expect(h.data).toHaveLength(2));
    expect(h.data.map(item => item.items.map(entry => entry.id))).toEqual([['a'], ['a', 'b']]); // la instantánea vieja no se aplicó
    expect(new Set(h.calls)).toEqual(new Set([30000]));
  });

  it('tras fallos espera 30→60→120 s (tope) y al recuperarse vuelve a 30 s, sin duplicar', async () => {
    const h = harness([new Error('red'), new Error('red'), new Error('red'), new Error('red'), snapshot('2026-11-24T15:10:00Z', ['a'])]);
    h.poller.start();
    for (let i = 0; i < 4; i++) { await vi.waitFor(() => expect(h.timers.length).toBeGreaterThan(0)); await h.tickNext(); }
    await vi.waitFor(() => expect(h.data).toHaveLength(1));
    expect(h.calls.slice(0, 4)).toEqual([30000, 60000, 120000, 120000]);
    expect(h.calls.at(-1)).toBe(30000);
    expect(h.statuses.filter(status => status.state === 'offline')).toHaveLength(4);
    expect(h.statuses.at(-1).state).toBe('ok');
  });

  it('con la pestaña oculta no consulta; stop() impide nuevas consultas', async () => {
    let visible = false; const h = harness([snapshot('2026-11-24T15:00:00Z', ['a'])], () => visible);
    h.poller.start(); await Promise.resolve();
    expect(h.data).toHaveLength(0); expect(h.calls).toEqual([30000]);
    visible = true; await h.tickNext(); await vi.waitFor(() => expect(h.data).toHaveLength(1));
    h.poller.stop(); await h.tickNext?.call(null).catch(() => undefined);
    expect(h.data).toHaveLength(1);
  });
});

describe('F04.1 centro de atención (pantalla)', () => {
  const item = (id, extra = {}) => ({ id, state: 'PENDIENTE', quantity: 1, medication: 'ficticio 10 mg', createdAt: '2026-11-24T15:00:00.000Z', expiresAt: new Date(Date.now() + 20 * 60000).toISOString(), pickupPreference: null, ...extra });
  const makeClient = overrides => ({ center: vi.fn().mockResolvedValue({ generatedAt: new Date().toISOString(), items: [item('1', { pickupPreference: { type: 'MINUTES', minutes: 60 } })] }),
    settings: vi.fn().mockResolvedValue({ pickupWindowHours: 4 }), saveSettings: vi.fn(), confirm: vi.fn().mockResolvedValue({}), shortage: vi.fn(), deliver: vi.fn(),
    history: vi.fn().mockResolvedValue({ items: [], nextCursor: null }), exportHistory: vi.fn().mockResolvedValue({ text: 'a', truncated: false }), ...overrides });

  it('muestra la cola con la preferencia como orientación y actualiza sola sin duplicar', async () => {
    const client = makeClient({ center: vi.fn().mockResolvedValueOnce({ generatedAt: new Date().toISOString(), items: [item('1')] })
      .mockResolvedValue({ generatedAt: new Date(Date.now() + 40000).toISOString(), items: [item('1'), item('2', { state: 'CONFIRMADA' })] }) });
    render(<PharmacyReservations client={client} pharmacyId="p" intervalMs={40} />);
    await screen.findByText('Centro de atención');
    await waitFor(() => expect(document.querySelectorAll('[data-reservation-id]').length).toBe(2));
    const ids = [...document.querySelectorAll('[data-reservation-id]')].map(node => node.getAttribute('data-reservation-id'));
    expect(new Set(ids).size).toBe(ids.length);
    expect(screen.getByText(/Se actualiza sola cada/)).toBeTruthy();
  });

  it('confirmar ejecuta una sola acción del usuario y refresca; el sondeo nunca confirma por su cuenta', async () => {
    const client = makeClient();
    render(<PharmacyReservations client={client} pharmacyId="p" intervalMs={30} />);
    await screen.findByText('Confirmar');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 120)); });
    expect(client.confirm).not.toHaveBeenCalled(); expect(client.shortage).not.toHaveBeenCalled(); expect(client.deliver).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Confirmar'));
    await waitFor(() => expect(client.confirm).toHaveBeenCalledTimes(1));
    expect(client.confirm).toHaveBeenCalledWith('p', '1');
  });

  it('la reserva vencida bloquea las acciones y el filtro se envía al servidor', async () => {
    const client = makeClient({ center: vi.fn().mockResolvedValue({ generatedAt: new Date().toISOString(), items: [item('9', { expiresAt: new Date(Date.now() - 60000).toISOString() })] }) });
    render(<PharmacyReservations client={client} pharmacyId="p" intervalMs={50} />);
    await screen.findByText(/vencida; se actualizará sola/);
    expect(screen.queryByText('Confirmar')).toBeNull();
    fireEvent.change(screen.getByLabelText('Mostrar'), { target: { value: 'CONFIRMADA' } });
    await waitFor(() => expect(client.center).toHaveBeenCalledWith('p', { estado: 'CONFIRMADA' }));
  });

  it('sin permiso de lectura no consulta nada', async () => {
    const client = makeClient();
    render(<PharmacyReservations client={client} pharmacyId="p" capabilities={['reservation.deliver']} />);
    expect(screen.getByRole('status').textContent).toContain('no está autorizada');
    expect(client.center).not.toHaveBeenCalled();
  });

  it('un corte de red muestra aviso y al volver la conexión se sincroniza', async () => {
    const client = makeClient({ center: vi.fn().mockResolvedValueOnce({ generatedAt: new Date().toISOString(), items: [item('1')] })
      .mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ generatedAt: new Date(Date.now() + 99000).toISOString(), items: [item('1'), item('3')] }) });
    render(<PharmacyReservations client={client} pharmacyId="p" intervalMs={30} />);
    await screen.findByText(/Sin conexión: se reintentará sola/);
    act(() => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(document.querySelectorAll('[data-reservation-id]').length).toBe(2));
    expect(screen.queryByText(/Sin conexión/)).toBeNull();
  });

  it('el historial pagina sin duplicar, filtra y descarga el CSV con aviso de que no incluye datos de clientes', async () => {
    const page = (ids, next) => ({ items: ids.map(id => ({ id, code: id, state: 'CANCELADA', quantity: 1, medication: 'ficticio', createdAt: '2026-11-24T15:00:00.000Z', closeReason: 'CANCELADA_POR_USUARIO', pickupPreference: null })), nextCursor: next });
    const client = makeClient({ history: vi.fn().mockResolvedValueOnce(page(['a', 'b'], 'c1')).mockResolvedValueOnce(page(['b', 'c'], null)) });
    URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn();
    render(<PharmacyReservations client={client} pharmacyId="p" intervalMs={10000} />);
    await screen.findByText('Centro de atención');
    fireEvent.click(screen.getByRole('tab', { name: 'Historial' }));
    await waitFor(() => expect(document.querySelectorAll('.reservation-queue li').length).toBe(2));
    fireEvent.click(screen.getByText('Cargar más'));
    await waitFor(() => expect(document.querySelectorAll('.reservation-queue li').length).toBe(3)); // «b» repetido no se duplica
    expect(client.history).toHaveBeenLastCalledWith('p', expect.objectContaining({ cursor: 'c1', limite: 25 }));
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'CANCELADA' } });
    fireEvent.click(screen.getByText('Descargar CSV'));
    expect((await screen.findByText(/sin datos personales/)).textContent).toContain('descargado');
    expect(client.exportHistory).toHaveBeenCalledWith('p', expect.objectContaining({ estado: 'CANCELADA' }));
    expect(within(screen.getByRole('tablist')).getAllByRole('tab')).toHaveLength(2);
  });
});
