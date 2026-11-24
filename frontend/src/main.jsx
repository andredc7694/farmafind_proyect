import React from 'react';
import { createRoot } from 'react-dom/client';
import { Bootstrap } from './Bootstrap.jsx';
import { IdentityApp } from './identity/IdentityApp.jsx';
import { PublicSearch } from './search/PublicSearch.jsx';
import { AssistantView } from './assistant/AssistantView.jsx';
import { ConversationView } from './assistant/ConversationView.jsx';
import { NearbyPharmacies } from './geolocation/NearbyPharmacies.jsx';
import { AppShell } from './app/AppShell.jsx';
import { Home } from './app/Home.jsx';
import { PharmacyApplication } from './pharmacies/PharmacyApplication.jsx';
import { PlatformApplications } from './pharmacies/PlatformApplications.jsx';
import { PharmacyDashboard } from './pharmacies/PharmacyDashboard.jsx';
import { initTheme } from './app/theme.js';
import './design/tokens.css';
import './style.css';

initTheme(); // aplica el tema guardado antes de pintar
const screen = window.location.pathname === '/identity' ? <IdentityApp />
  : window.location.pathname === '/inventory' ? <IdentityApp inventoryMode />
  : window.location.pathname === '/reservations' ? <IdentityApp reservationsMode />
  : window.location.pathname === '/ubicacion' ? <IdentityApp locationMode />
  : window.location.pathname === '/search' ? <PublicSearch />
  : window.location.pathname === '/mapa' ? <NearbyPharmacies />
  : window.location.pathname === '/farmacias/solicitar' ? <PharmacyApplication />
  : window.location.pathname === '/admin/farmacias/solicitudes' ? <PlatformApplications />
  : window.location.pathname === '/farmacias/panel' ? <PharmacyDashboard />
  : window.location.pathname === '/assistant/conversation' ? <ConversationView />
  : window.location.pathname === '/assistant' ? <AssistantView />
  : window.location.pathname === '/bootstrap' ? <Bootstrap /> : <Home />;
createRoot(document.getElementById('root')).render(<React.StrictMode><AppShell>{screen}</AppShell></React.StrictMode>);
