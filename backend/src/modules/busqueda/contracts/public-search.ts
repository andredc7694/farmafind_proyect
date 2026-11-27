export const PUBLIC_NOTICE = 'Precio y disponibilidad referenciales; confirma existencias con la farmacia.';

export interface PublicMedication {
  readonly id: string;
  readonly nombreComercial: string;
  readonly principioActivo: string;
  readonly concentracion: string;
  readonly presentacion: string;
  readonly clasificacion: string;
}

export interface PublicPharmacy {
  readonly id: string;
  readonly nombre: string;
  readonly direccion: string;
}

/** F03.1 (spec 022, D-01 A): solo con ubicación verificada y F07 activo; en otro caso null. */
export interface PublicVerifiedLocation { readonly latitud: number; readonly longitud: number; }
export interface PublicOfferPharmacy extends PublicPharmacy { readonly ubicacion: PublicVerifiedLocation | null; }

export interface PublicOffer {
  readonly medicamento: PublicMedication;
  readonly farmacia: PublicOfferPharmacy;
  readonly precioReferencialCentavos: number;
  readonly disponibilidadReferencial: 'DISPONIBLE';
  readonly ultimaRevision: string;
  readonly distanciaKm: number | null;
}

/** F03.2 (spec 023, D-03 A): cómo coincidió la consulta. */
export type PublicMatch = 'EXACTA' | 'APROXIMADA' | 'NINGUNA' | 'FALTA_NOMBRE';
export const PUBLIC_MATCHES: readonly PublicMatch[] = ['EXACTA', 'APROXIMADA', 'NINGUNA', 'FALTA_NOMBRE'];

export interface PublicSearchResponse {
  readonly consulta: string;
  readonly ofertas: readonly PublicOffer[];
  readonly paginacion: { readonly pagina: number; readonly tamano: number; readonly total: number; readonly totalPaginas: number };
  readonly aviso: typeof PUBLIC_NOTICE;
  readonly coincidencia: PublicMatch;
}

export class PublicQueryError extends Error {
  constructor(readonly code: 'INVALID_QUERY' | 'INCOMPATIBLE_PARAMETERS', message: string) { super(message); }
}
