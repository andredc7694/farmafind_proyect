import React from 'react';
import { PrivatePharmacyProfile } from './PrivatePharmacyProfile.jsx';
import { LocationAdmin } from '../geolocation/LocationAdmin.jsx';
import { OpeningHoursEditor } from '../geolocation/OpeningHours.jsx';

/**
 * F071-FR-001: pestaña «Mi farmacia». Reúne contacto (edición inmediata), dirección y ubicación
 * (revisadas por FarmaFind) y horario. Cada bloque aparece solo con su capacidad; el servidor revalida todo.
 */
export function MyPharmacy({ pharmacyId, codes = [] }) {
  const canProfile = codes.includes('pharmacy.profile.read');
  return <div className="page-stack my-pharmacy">
    <h2>Mi farmacia</h2>
    {canProfile && <PrivatePharmacyProfile pharmacyId={pharmacyId} capabilities={codes} />}
    <LocationAdmin pharmacyId={pharmacyId} delegationCodes={codes} />
    {canProfile && <OpeningHoursEditor pharmacyId={pharmacyId} canWrite={codes.includes('pharmacy.profile.write')} />}
  </div>;
}
