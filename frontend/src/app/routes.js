export const publicNavigation = [
  { href: '/', label: 'Inicio' },
  { href: '/search', label: 'Buscar medicamentos' },
  { href: '/farmacias/solicitar', label: 'Registrar mi farmacia' },
  { href: '/assistant/conversation', label: 'FarmaFind AI' },
];

export const reservationsLink = { href: '/reservations', label: 'Mis reservas' };

/** Capacidades que abren alguna sección del panel de farmacia (la revisión de ubicaciones tiene su propio enlace). */
const panelCapabilities = ['inventory.read', 'inventory.history', 'inventory.import.preview', 'inventory.import.confirm',
  'reservation.read', 'reservation.settings', 'membership.manage', 'GEO_LOCATION_PROPOSE'];

export function pharmacyNavigation(memberships = []) {
  if (!memberships.length) return [];
  const links = [];
  if (memberships.some(item => item.delegationCodes?.some(code => panelCapabilities.includes(code)))) {
    links.push({ href: '/farmacias/panel', label: 'Panel de farmacia' });
  }
  if (memberships.some(item => item.delegationCodes?.some(code =>
    code === 'GEO_LOCATION_PROPOSE' || code === 'GEO_LOCATION_REVIEW'))) {
    links.push({ href: '/ubicacion', label: 'Ubicación de farmacia' });
  }
  return links;
}
