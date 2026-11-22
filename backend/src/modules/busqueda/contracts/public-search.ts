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

export interface PublicOffer {
  readonly medicamento: PublicMedication;
  readonly farmacia: PublicPharmacy;
  readonly precioReferencialCentavos: number;
  readonly disponibilidadReferencial: 'DISPONIBLE';
  readonly ultimaRevision: string;
  readonly distanciaKm: number | null;
}

export interface PublicSearchResponse {
  readonly consulta: string;
  readonly ofertas: readonly PublicOffer[];
  readonly paginacion: { readonly pagina: number; readonly tamano: number; readonly total: number; readonly totalPaginas: number };
  readonly aviso: typeof PUBLIC_NOTICE;
}

export class PublicQueryError extends Error {
  constructor(readonly code: 'INVALID_QUERY' | 'INCOMPATIBLE_PARAMETERS', message: string) { super(message); }
}
