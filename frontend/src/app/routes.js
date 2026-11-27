export const publicNavigation = [
  { href: '/', label: 'Inicio' },
  { href: '/search', label: 'Buscar medicamentos' },
  { href: '/farmacias/solicitar', label: 'Registrar mi farmacia' },
];

export const reservationsLink = { href: '/reservations', label: 'Mis reservas' };

/** Capacidades que abren alguna sección del panel de farmacia (la revisión de ubicaciones tiene su propio enlace). */
const panelCapabilities = ['inventory.read', 'inventory.history', 'inventory.import.preview', 'inventory.import.confirm',
  'reservation.read', 'reservation.settings', 'membership.manage', 'GEO_LOCATION_PROPOSE', 'GEO_LOCATION_REVIEW',
  'pharmacy.profile.read'];

export function pharmacyNavigation(memberships = []) {
  if (!memberships.length) return [];
  const links = [];
  if (memberships.some(item => item.delegationCodes?.some(code => panelCapabilities.includes(code)))) {
    links.push({ href: '/farmacias/panel', label: 'Panel de farmacia' });
  }
  // F07.1: la ubicación vive en «Mi farmacia» dentro del panel; /ubicacion sigue disponible por enlace directo.
  return links;
}
