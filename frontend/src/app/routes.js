export const publicNavigation = [
  { href: '/', label: 'Inicio' },
  { href: '/search', label: 'Buscar medicamentos' },
  { href: '/mapa', label: 'Farmacias cercanas' },
  { href: '/assistant/conversation', label: 'FarmaFind AI' },
];

export const accountNavigation = [
  { href: '/identity', label: 'Mi cuenta' },
  { href: '/reservations', label: 'Mis reservas' },
];

export function pharmacyNavigation(memberships = []) {
  if (!memberships.length) return [];
  const links = [];
  if (memberships.some(item => item.delegationCodes?.includes('inventory.read'))) {
    links.push({ href: '/inventory', label: 'Inventario' });
  }
  if (memberships.some(item => item.delegationCodes?.some(code =>
    code === 'GEO_LOCATION_PROPOSE' || code === 'GEO_LOCATION_REVIEW'))) {
    links.push({ href: '/ubicacion', label: 'Ubicación de farmacia' });
  }
  return links;
}
