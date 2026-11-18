import React from 'react';
import { createRoot } from 'react-dom/client';
import { Bootstrap } from './Bootstrap.jsx';
import { IdentityApp } from './identity/IdentityApp.jsx';
import { PublicSearch } from './search/PublicSearch.jsx';
import { AssistantView } from './assistant/AssistantView.jsx';
import { ConversationView } from './assistant/ConversationView.jsx';
import './style.css';

const screen = window.location.pathname === '/identity' ? <IdentityApp />
  : window.location.pathname === '/inventory' ? <IdentityApp inventoryMode />
  : window.location.pathname === '/reservations' ? <IdentityApp reservationsMode />
  : window.location.pathname === '/search' ? <PublicSearch />
  : window.location.pathname === '/assistant/conversation' ? <ConversationView />
  : window.location.pathname === '/assistant' ? <AssistantView /> : <Bootstrap />;
createRoot(document.getElementById('root')).render(<React.StrictMode>{screen}</React.StrictMode>);
