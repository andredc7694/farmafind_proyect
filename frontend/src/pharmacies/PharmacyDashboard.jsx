import React from 'react';
import {PharmacyPanel} from './PharmacyPanel.jsx';

/** F08.1: panel por capacidades (Resumen, Farmacia, Inventario, Importar, Reservas, Historial, Personal, Configuración). */
export function PharmacyDashboard(){
  return <main className="page-stack"><PharmacyPanel /></main>;
}
