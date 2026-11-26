import { accountNavigation, pharmacyNavigation, publicNavigation } from './routes.js';

/** F08.1: modelo de navegación por actor. Es solo presentación: cada acción privada la revalida el servidor. */
export function actorKind({ session = null, memberships = [], canReview = false } = {}) {
  if (!session) return 'visitante';
  const codes = memberships.flatMap(item => item.delegationCodes ?? []);
  if (canReview || codes.includes('GEO_LOCATION_REVIEW')) return 'revisor';
  if (memberships.some(item => ['DUENO', 'ADMINISTRADOR'].includes(item.roleCode))) return 'propietario';
  if (memberships.length > 0) return 'trabajador';
  return 'cliente';
}

/** Enlaces del menú principal, sin duplicados. Misma salida que antes de F08.1 para los mismos datos. */
export function navigationFor({ session = null, memberships = [], canReview = false } = {}) {
  const links = [...publicNavigation, ...(session ? accountNavigation : [{ href: '/identity', label: 'Mi cuenta' }]),
    ...pharmacyNavigation(memberships), ...(session && canReview ? [{ href: '/admin/farmacias/solicitudes', label: 'Revisar solicitudes' }] : [])];
  const seen = new Set();
  return links.filter(link => (seen.has(link.href) ? false : seen.add(link.href)));
}

const sections = [
  { id: 'resumen', label: 'Resumen', anyOf: ['reservation.read', 'inventory.read'] },
  { id: 'farmacia', label: 'Farmacia y ubicación', anyOf: ['GEO_LOCATION_PROPOSE', 'GEO_LOCATION_REVIEW'] },
  { id: 'inventario', label: 'Inventario', anyOf: ['inventory.read'] },
  { id: 'importar', label: 'Importar', anyOf: ['inventory.import.preview', 'inventory.import.confirm'] },
  { id: 'reservas', label: 'Reservas', anyOf: ['reservation.read'] },
  { id: 'historial', label: 'Historial', anyOf: ['reservation.read', 'inventory.history'] },
  { id: 'personal', label: 'Personal', anyOf: ['membership.manage'] },
  { id: 'configuracion', label: 'Configuración', anyOf: ['reservation.settings'] },
];

/** Secciones del panel de una farmacia, en el orden fijado por la spec y solo las que las capacidades permiten. */
export function panelSections(delegationCodes = []) {
  const held = new Set(delegationCodes);
  return sections.filter(section => section.anyOf.some(code => held.has(code))).map(({ id, label }) => ({ id, label }));
}
