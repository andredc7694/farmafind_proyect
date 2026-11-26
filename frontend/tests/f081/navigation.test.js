import { describe, expect, it } from 'vitest';
import { actorKind, navigationFor, accountLinksFor, panelSections } from '../../src/app/navigation.js';
import { pharmacyNavigation, publicNavigation } from '../../src/app/routes.js';

const owner = [{ pharmacyId: 'a', roleCode: 'DUENO', delegationCodes: ['membership.manage', 'inventory.read', 'inventory.write', 'inventory.import.preview', 'inventory.import.confirm',
  'reservation.read', 'reservation.accept', 'reservation.deliver', 'reservation.settings', 'GEO_LOCATION_PROPOSE'] }];
const worker = [{ pharmacyId: 'a', roleCode: 'TRABAJADOR', delegationCodes: ['reservation.read', 'reservation.accept'] }];

describe('F08.1 modelo de navegación por actor', () => {
  it('clasifica al actor', () => {
    expect(actorKind()).toBe('visitante');
    expect(actorKind({ session: { id: 'u' } })).toBe('cliente');
    expect(actorKind({ session: { id: 'u' }, memberships: worker })).toBe('trabajador');
    expect(actorKind({ session: { id: 'u' }, memberships: owner })).toBe('propietario');
    expect(actorKind({ session: { id: 'u' }, canReview: true })).toBe('revisor');
    expect(actorKind({ session: { id: 'u' }, memberships: [{ roleCode: 'TRABAJADOR', delegationCodes: ['GEO_LOCATION_REVIEW'] }] })).toBe('revisor');
  });

  const u = { id: 'u' };
  const hrefs = actor => navigationFor(actor).map(link => link.href);
  const account = actor => accountLinksFor(actor).map(link => link.label);

  it('visitante: menú público sin «Farmacias cercanas» y acceso dentro de Mi cuenta', () => {
    expect(hrefs()).toEqual(['/', '/search', '/farmacias/solicitar', '/assistant/conversation']);
    expect(navigationFor().map(link => link.label)).not.toContain('Farmacias cercanas');
    expect(account()).toEqual(['Entrar o crear cuenta']);
  });

  it('cliente y solicitante ven sus reservas; el solicitante ve «Mi solicitud»', () => {
    expect(hrefs({ session: u })).toEqual([...publicNavigation.map(link => link.href), '/reservations']);
    const applicant = { session: u, applications: [{ estado: 'ENVIADA' }] };
    expect(actorKind(applicant)).toBe('solicitante');
    expect(navigationFor(applicant).map(link => link.label)).toContain('Mi solicitud');
    expect(navigationFor(applicant).map(link => link.label)).not.toContain('Registrar mi farmacia');
    expect(actorKind({ session: u, applications: [{ estado: 'RECHAZADA' }] })).toBe('cliente');
    expect(account({ session: u })).toEqual(['Mi perfil']);
  });

  it('propietario: su panel, y «Mis reservas» solo dentro de Mi cuenta', () => {
    expect(hrefs({ session: u, memberships: owner })).toEqual([...publicNavigation.map(link => link.href), ...pharmacyNavigation(owner).map(link => link.href)]);
    expect(account({ session: u, memberships: owner })).toEqual(['Mi perfil', 'Mis reservas']);
    expect(hrefs({ session: u, memberships: [...owner, ...owner] }).filter(href => href === '/farmacias/panel')).toHaveLength(1);
  });

  it('trabajador: solo su panel, aunque no tenga inventario; sin reservas de cliente', () => {
    expect(hrefs({ session: u, memberships: worker })).toEqual(['/farmacias/panel']);
    expect(account({ session: u, memberships: worker })).toEqual(['Mi perfil']);
  });

  it('administrador o revisor: ni reservas ni panel de inventario', () => {
    expect(hrefs({ session: u, canReview: true })).toEqual([...publicNavigation.map(link => link.href), '/admin/farmacias/solicitudes']);
    expect(account({ session: u, canReview: true })).toEqual(['Mi perfil']);
    const geo = { session: u, memberships: [{ roleCode: 'TRABAJADOR', delegationCodes: ['GEO_LOCATION_REVIEW'] }] };
    expect(hrefs(geo)).toEqual([...publicNavigation.map(link => link.href), '/ubicacion']);
  });

  it('el propietario recibe las secciones en el orden de la spec', () => {
    expect(panelSections(owner[0].delegationCodes).map(section => section.id))
      .toEqual(['resumen', 'farmacia', 'inventario', 'importar', 'reservas', 'historial', 'personal', 'configuracion']);
  });

  it('el trabajador solo ve las tareas de sus permisos (sin Personal ni Configuración) y sin duplicados', () => {
    expect(panelSections(worker[0].delegationCodes).map(section => section.id)).toEqual(['resumen', 'reservas', 'historial']);
    expect(panelSections(['inventory.read', 'inventory.read']).map(section => section.id)).toEqual(['resumen', 'inventario']);
    expect(panelSections([])).toEqual([]);
    for (const code of ['reservation.accept', 'reservation.deliver', 'inventory.write']) expect(panelSections([code])).toEqual([]);
  });

  it('un permiso por sí solo no concede secciones de otro permiso', () => {
    expect(panelSections(['membership.manage']).map(section => section.id)).toEqual(['personal']);
    expect(panelSections(['reservation.settings']).map(section => section.id)).toEqual(['configuracion']);
    expect(panelSections(['GEO_LOCATION_REVIEW']).map(section => section.id)).toEqual(['farmacia']);
  });
});
