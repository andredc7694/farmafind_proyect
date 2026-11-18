/** Datos sintéticos exclusivos de pruebas F06.1; no describen un medicamento real. */
export const SYNTHETIC_SOURCE = Object.freeze({
  authority: 'Autoridad Ficticia TEST',
  jurisdiction: 'TEST',
  reference: 'test://ficha/sintetica-001',
  title: 'Ficha sintética 001',
  version: '1',
  reviewedAt: '2026-11-17T00:00:00.000Z',
  validUntil: '2099-01-01T00:00:00.000Z',
  reusePermission: 'TEST_ONLY',
  professionalReviewer: 'Revisor Ficticio TEST',
  approvedForTest: true,
  productName: 'Producto Ficticio Alfa',
  educationalStatement: 'Contenido educativo sintético sin aplicación clínica.',
  educationalWarning: 'Advertencia sintética: consultar una fuente profesional.',
  categoryKey: 'molestia ficticia',
});

export const INCOMPLETE_SOURCE = Object.freeze({
  ...SYNTHETIC_SOURCE,
  reference: 'test://ficha/incompleta',
  reusePermission: '',
});

export const SYNTHETIC_PUBLIC_OFFERS = Object.freeze([
  { medication: 'Producto Ficticio Alfa', pharmacy: 'Farmacia Ficticia Alfa', priceCents: 1000, reviewedAt: '2026-11-17T00:00:00.000Z' },
  { medication: 'Producto Ficticio Alfa', pharmacy: 'Farmacia Ficticia Beta', priceCents: 1200, reviewedAt: '2026-11-17T00:00:00.000Z' },
]);
