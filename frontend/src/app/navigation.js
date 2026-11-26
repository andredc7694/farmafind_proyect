import { pharmacyNavigation, publicNavigation, reservationsLink } from './routes.js';

const closedApplications = ['APROBADA', 'RECHAZADA', 'CANCELADA'];

/** F08.1: modelo de navegación por actor. Es solo presentación: cada acción privada la revalida el servidor. */
export function actorKind({ session = null, memberships = [], canReview = false, applications = [] } = {}) {
  if (!session) return 'visitante';
  if (canReview) return 'revisor';
  if (memberships.some(item => ['DUENO', 'ADMINISTRADOR'].includes(item.roleCode))) return 'propietario';
  if (memberships.flatMap(item => item.delegationCodes ?? []).includes('GEO_LOCATION_REVIEW')) return 'revisor';
  if (memberships.length > 0) return 'trabajador';
  if (applications.some(item => !closedApplications.includes(item.estado))) return 'solicitante';
  return 'cliente';
}

/** Enlaces del menú principal según el actor, sin duplicados. */
export function navigationFor({ session = null, memberships = [], canReview = false, applications = [] } = {}) {
  const kind = actorKind({ session, memberships, canReview, applications });
  const pharmacy = pharmacyNavigation(memberships);
  // El trabajador solo ve su panel (con las secciones que le delegaron).
  if (kind === 'trabajador') {
    const panel = pharmacy.filter(link => link.href === '/farmacias/panel');
    return panel.length ? panel : pharmacy;
  }
  const open = kind === 'solicitante'
    ? publicNavigation.map(link => (link.href === '/farmacias/solicitar' ? { ...link, label: 'Mi solicitud' } : link))
    : publicNavigation;
  const links = [...open,
    ...(kind === 'cliente' || kind === 'solicitante' ? [reservationsLink] : []),
    ...pharmacy,
    ...(session && canReview ? [{ href: '/admin/farmacias/solicitudes', label: 'Revisar solicitudes' }] : [])];
  const seen = new Set();
  return links.filter(link => (seen.has(link.href) ? false : seen.add(link.href)));
}

/** Enlaces dentro de «Mi cuenta». El propietario ve ahí sus reservas como cliente. */
export function accountLinksFor({ session = null, memberships = [], canReview = false } = {}) {
  if (!session) return [{ href: '/identity', label: 'Entrar o crear cuenta' }];
  return [{ href: '/identity', label: 'Mi perfil' },
    ...(actorKind({ session, memberships, canReview }) === 'propietario' ? [reservationsLink] : [])];
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
