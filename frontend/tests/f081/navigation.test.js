import { describe, expect, it } from 'vitest';
import { actorKind, navigationFor, panelSections } from '../../src/app/navigation.js';
import { accountNavigation, pharmacyNavigation, publicNavigation } from '../../src/app/routes.js';

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

  it('el visitante ve solo el menú público mínimo y el acceso', () => {
    const links = navigationFor();
    expect(links.map(link => link.href)).toEqual([...publicNavigation.map(link => link.href), '/identity']);
    expect(links.some(link => /panel|ubicacion|reservations|admin/.test(link.href))).toBe(false);
  });

  it('un cliente ve su cuenta y sus reservas, nunca paneles de farmacia ni de revisión', () => {
    const hrefs = navigationFor({ session: { id: 'u' } }).map(link => link.href);
    expect(hrefs).toEqual([...publicNavigation, ...accountNavigation].map(link => link.href));
  });

  it('mantiene el resultado anterior para propietario y revisor (sin regresión) y no duplica enlaces', () => {
    const hrefs = navigationFor({ session: { id: 'u' }, memberships: owner, canReview: true }).map(link => link.href);
    expect(hrefs).toEqual([...publicNavigation, ...accountNavigation, ...pharmacyNavigation(owner), { href: '/admin/farmacias/solicitudes' }].map(link => link.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(navigationFor({ session: { id: 'u' }, memberships: [...owner, ...owner] }).map(link => link.href).filter(href => href === '/farmacias/panel')).toHaveLength(1);
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
