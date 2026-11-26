import React from 'react';
import { createRoot } from 'react-dom/client';
import { Bootstrap } from './Bootstrap.jsx';
import { IdentityApp } from './identity/IdentityApp.jsx';
import { PublicSearch } from './search/PublicSearch.jsx';
import { NearbyPharmacies } from './geolocation/NearbyPharmacies.jsx';
import { AppShell } from './app/AppShell.jsx';
import { Home } from './app/Home.jsx';
import { PharmacyApplication } from './pharmacies/PharmacyApplication.jsx';
import { PlatformApplications } from './pharmacies/PlatformApplications.jsx';
import { PharmacyDashboard } from './pharmacies/PharmacyDashboard.jsx';
import { initTheme } from './app/theme.js';
import './design/tokens.css';
import './style.css';

// El asistente vive solo en la burbuja flotante: sus rutas antiguas llevan a la búsqueda.
if (/^\/assistant(\/|$)/.test(window.location.pathname)) window.history.replaceState(null, '', '/search');
initTheme(); // aplica el tema guardado antes de pintar
// La ruta antigua del mapa vive ahora dentro de «Buscar medicamentos».
if (window.location.pathname === '/mapa') window.history.replaceState(null, '', `/search/mapa${window.location.search}${window.location.hash}`);
const screen = window.location.pathname === '/identity' ? <IdentityApp />
  : window.location.pathname === '/inventory' ? <IdentityApp inventoryMode />
  : window.location.pathname === '/reservations' ? <IdentityApp reservationsMode />
  : window.location.pathname === '/ubicacion' ? <IdentityApp locationMode />
  : window.location.pathname === '/search' ? <PublicSearch />
  : window.location.pathname === '/search/mapa' ? <NearbyPharmacies />
  : window.location.pathname === '/farmacias/solicitar' ? <PharmacyApplication />
  : window.location.pathname === '/admin/farmacias/solicitudes' ? <PlatformApplications />
  : window.location.pathname === '/farmacias/panel' ? <PharmacyDashboard />
  : window.location.pathname === '/bootstrap' ? <Bootstrap /> : <Home />;
createRoot(document.getElementById('root')).render(<React.StrictMode><AppShell>{screen}</AppShell></React.StrictMode>);
