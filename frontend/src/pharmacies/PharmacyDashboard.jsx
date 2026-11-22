import React from 'react';
import {IdentityApp} from '../identity/IdentityApp.jsx';

/** Reuse the F01 selector and F02 inventory controls; no new tenant authority. */
export function PharmacyDashboard(){
  return <main className="page-stack">
    <header><h1>Panel de farmacia</h1>
      <p>Selecciona una farmacia autorizada para consultar o importar su inventario.</p></header>
    <IdentityApp inventoryMode />
  </main>;
}
