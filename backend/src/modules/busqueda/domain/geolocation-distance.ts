import { distanceKm } from './public-offer.js';

export interface Positioned { readonly id: string; readonly latitude: number | null; readonly longitude: number | null; }
export interface NearbyPosition<T extends Positioned> { readonly candidate: T; readonly id: string; readonly distanceKm: number; }

/** Straight-line estimate, never route distance or travel time. */
export const straightLineKm = distanceKm;

export function orderNearby<T extends Positioned>(candidates: readonly T[],
  origin: { readonly latitude:number; readonly longitude:number }, radiusKm:number): readonly NearbyPosition<T>[] {
  if (candidates.length>200) throw new Error('F07: máximo 200 candidatas');
  if (!Number.isFinite(origin.latitude) || !Number.isFinite(origin.longitude) || !Number.isFinite(radiusKm))
    throw new Error('F07: ubicación inválida');
  return candidates.flatMap(candidate => {
    if (candidate.latitude===null || candidate.longitude===null) return [];
    const value=straightLineKm(origin.latitude,origin.longitude,candidate.latitude,candidate.longitude);
    return value<=radiusKm ? [{candidate,id:candidate.id,distanceKm:value}] : [];
  }).sort((left,right)=>left.distanceKm-right.distanceKm || left.id.localeCompare(right.id));
}
