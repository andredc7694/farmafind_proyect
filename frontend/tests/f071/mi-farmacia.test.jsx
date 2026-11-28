// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../../src/pharmacies/PrivatePharmacyProfile.jsx', () => ({ PrivatePharmacyProfile: () => <div data-testid="contact" /> }));
vi.mock('../../src/geolocation/PointPicker.jsx', () => ({ PointPicker: () => <div data-testid="picker" /> }));
vi.mock('../../src/identity/Profile.jsx', () => ({ Profile: () => <div data-testid="profile" /> }));
import { MyPharmacy } from '../../src/pharmacies/MyPharmacy.jsx';
import { LocationAdmin } from '../../src/geolocation/LocationAdmin.jsx';
import { OpeningHoursEditor, PublicOpeningHours } from '../../src/geolocation/OpeningHours.jsx';
import { LocationReview } from '../../src/geolocation/LocationReview.jsx';
import { ProfilePage } from '../../src/identity/ProfilePage.jsx';
import { accountLinksFor, navigationFor, panelSections } from '../../src/app/navigation.js';
import { limaIsoDay } from '../../src/geolocation/my-pharmacy-clients.js';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
globalThis.fetch = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) }));

const week = () => Array.from({ length: 7 }, (_, i) => ({ dia: i + 1, cerrado: i === 6, abre: i === 6 ? null : '08:00', cierra: i === 6 ? null : '20:00' }));

describe('F07.1 · navegación', () => {
  it('«Mi farmacia» aparece con el permiso de perfil o de ubicación', () => {
    expect(panelSections(['pharmacy.profile.read']).map(item => item.label)).toEqual(['Mi farmacia']);
    expect(panelSections(['GEO_LOCATION_PROPOSE']).map(item => item.label)).toEqual(['Mi farmacia']);
    expect(panelSections(['inventory.read']).map(item => item.label)).not.toContain('Mi farmacia');
  });
  it('«Revisar ubicaciones» solo si el servidor lo permite; «Mi perfil» va a su página', () => {
    const session = { userId: 'u' };
    expect(navigationFor({ session, canReviewLocations: true }).map(link => link.href)).toContain('/admin/farmacias/ubicaciones');
    expect(navigationFor({ session }).map(link => link.href)).not.toContain('/admin/farmacias/ubicaciones');
    expect(accountLinksFor({ session })[0]).toEqual({ href: '/mi-perfil', label: 'Mi perfil' });
  });
});

describe('F07.1 · pestaña «Mi farmacia» (FR-001)', () => {
  it('muestra contacto y horario con permiso de perfil; ubicación con permiso de ubicación', () => {
    render(<MyPharmacy pharmacyId="alfa" codes={['pharmacy.profile.read', 'GEO_LOCATION_PROPOSE']} />);
    expect(screen.getByTestId('contact')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Dirección y ubicación en el mapa' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Horario de atención' })).toBeTruthy();
    cleanup();
    render(<MyPharmacy pharmacyId="alfa" codes={['GEO_LOCATION_PROPOSE']} />);
    expect(screen.queryByTestId('contact')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Horario de atención' })).toBeNull();
  });
});

describe('F07.1 · estado, historial y límites (FR-004, FR-006)', () => {
  it('muestra el estado «En revisión» y el historial sin identificadores', async () => {
    const statusClient = { status: vi.fn().mockResolvedValue({ estado: 'EN_REVISION', publicada: null,
      pendiente: { propuestaId: 'p', direccion: 'Av. Ficticia 1', ciudad: 'lima', latitud: -12.05, longitud: -77.04 },
      historial: [{ fecha: '2026-11-26T12:00:00.000Z', accion: 'PROPUESTA', autor: 'Tú', motivo: null, direccion: 'Av. Ficticia 1' }] }) };
    render(<LocationAdmin pharmacyId="alfa" delegationCodes={['GEO_LOCATION_PROPOSE']} client={{ propose: vi.fn() }} statusClient={statusClient} />);
    expect(await screen.findByText('Estado: En revisión')).toBeTruthy();
    expect(screen.getByText(/En revisión: Av. Ficticia 1/)).toBeTruthy();
    expect(screen.getByText(/Propuesta enviada · Tú/)).toBeTruthy();
  });
  it('bloquea el envío con coordenadas fuera del Perú', async () => {
    const client = { propose: vi.fn() };
    render(<LocationAdmin pharmacyId="alfa" delegationCodes={['GEO_LOCATION_PROPOSE']} client={client}
      statusClient={{ status: vi.fn().mockRejectedValue(new Error('x')) }} />);
    fireEvent.change(screen.getByLabelText('Latitud'), { target: { value: '40.4' } });
    fireEvent.change(screen.getByLabelText('Longitud'), { target: { value: '-3.7' } });
    expect(screen.getByRole('alert').textContent).toContain('fuera del Perú');
    expect(screen.getByRole('button', { name: 'Enviar propuesta' }).disabled).toBe(true);
  });
});

describe('F07.1 · horario (FR-008)', () => {
  it('carga, valida y guarda con la versión actual', async () => {
    const client = { read: vi.fn().mockResolvedValue({ version: 2, dias: week() }),
      save: vi.fn().mockResolvedValue({ version: 3, dias: week() }) };
    render(<OpeningHoursEditor pharmacyId="alfa" canWrite client={client} />);
    const opens = await screen.findAllByLabelText('Abre');
    fireEvent.change(opens[0], { target: { value: '21:00' } });
    expect(screen.getByText('El cierre debe ser después de la apertura.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Guardar horario' }).disabled).toBe(true);
    fireEvent.change(opens[0], { target: { value: '09:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horario' }));
    await waitFor(() => expect(client.save).toHaveBeenCalledOnce());
    expect(client.save.mock.calls[0][1].version).toBe(2);
    expect(client.save.mock.calls[0][1].dias[0]).toEqual({ dia: 1, cerrado: false, abre: '09:00', cierra: '20:00' });
    expect(client.save.mock.calls[0][1].dias[6]).toEqual({ dia: 7, cerrado: true, abre: null, cierra: null });
    expect(await screen.findByText(/Horario guardado/)).toBeTruthy();
  });
  it('sin permiso de escritura solo lo muestra', async () => {
    render(<OpeningHoursEditor pharmacyId="alfa" client={{ read: vi.fn().mockResolvedValue({ version: 1, dias: week() }) }} />);
    expect(await screen.findByText('Domingo: Cerrado')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Guardar horario' })).toBeNull();
  });
  it('público: «Hoy» según la hora de Lima', () => {
    const now = new Date('2026-11-29T15:00:00.000Z'); // domingo en Lima
    expect(limaIsoDay(now)).toBe(7);
    render(<PublicOpeningHours days={week()} now={now} />);
    expect(screen.getByText('Hoy: Cerrado')).toBeTruthy();
  });
});

describe('F07.1 · revisión de plataforma (FR-005)', () => {
  const item = { propuestaId: 'p1', farmaciaId: 'f1', farmaciaNombre: 'Farmacia Alfa', direccionPublicable: 'Av. Ficticia 1', ciudad: 'lima',
    latitud: -12.05, longitud: -77.04, precisionMetros: null, fuente: 'Visita', evidenciaReferencia: null, version: 1, propuestaAt: '2026-11-26T12:00:00.000Z' };
  it('lista datos públicos y envía la decisión con versión, evidencia y motivo', async () => {
    const client = { list: vi.fn().mockResolvedValueOnce([item]).mockResolvedValueOnce([]), decide: vi.fn().mockResolvedValue({}) };
    render(<LocationReview client={client} />);
    expect(await screen.findByText('Farmacia Alfa')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Comprobé la dirección y el punto'));
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Coincide con la fachada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar decisión' }));
    await waitFor(() => expect(client.decide).toHaveBeenCalledWith('p1',
      { decision: 'APROBAR', version: 1, evidenciaConfirmada: true, motivo: 'Coincide con la fachada' }));
    expect(await screen.findByText(/verificada y publicada/)).toBeTruthy();
  });
  it('sin permiso lo dice', async () => {
    render(<LocationReview client={{ list: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { status: 403 })) }} />);
    expect((await screen.findByRole('alert')).textContent).toContain('No tienes permiso');
  });
});

describe('F07.1 · «Mi perfil» visible (FR-009)', () => {
  it('con sesión muestra el perfil; sin sesión invita a entrar', async () => {
    render(<ProfilePage sessionClient={{ session: vi.fn().mockResolvedValue({ userId: 'u' }) }} />);
    expect(await screen.findByTestId('profile')).toBeTruthy();
    cleanup();
    render(<ProfilePage sessionClient={{ session: vi.fn().mockResolvedValue(null) }} />);
    expect(await screen.findByText(/Inicia sesión para ver tu perfil/)).toBeTruthy();
  });
});
