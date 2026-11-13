import React from 'react';
import { createRoot } from 'react-dom/client';
import { Bootstrap } from './Bootstrap.jsx';
import { IdentityApp } from './identity/IdentityApp.jsx';
import './style.css';

const screen = window.location.pathname === '/identity' ? <IdentityApp />
  : window.location.pathname === '/inventory' ? <IdentityApp inventoryMode /> : <Bootstrap />;
createRoot(document.getElementById('root')).render(<React.StrictMode>{screen}</React.StrictMode>);
