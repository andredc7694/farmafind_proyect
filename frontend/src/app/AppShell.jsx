import React, { useEffect, useState } from 'react';
import { createSessionClient } from '../identity/session-client.js';
import { createPharmacyApplicationClient } from '../pharmacies/application-client.js';
import { createProfileClient } from '../identity/profile-client.js';
import { navigationFor, accountLinksFor } from './navigation.js';
import { AccountMenu } from './AccountMenu.jsx';
import { ChatBubble } from '../assistant/ChatBubble.jsx';

const client = createSessionClient();
const applications = createPharmacyApplicationClient();
const profile = createProfileClient();

export function AppShell({ children, path = window.location.pathname }) {
  const [session, setSession] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [canReviewApplications, setCanReviewApplications] = useState(false);
  const [ownApplications, setOwnApplications] = useState([]);
  // The public home still renders when the API is unavailable. A live session
  // enables the reviewer link without storing identity or grants in the browser.
  const sessionAware = path !== '/bootstrap';

  useEffect(() => {
    if (!sessionAware) return undefined;
    let active = true;
    async function refresh() {
      try {
        const value = await client.session();
        if (!active) return;
        setSession(value);
        if (!value) { setMemberships([]); setCanReviewApplications(false); setOwnApplications([]); return; }
        const [own, review, requests] = await Promise.allSettled([
          client.memberships(), applications.canReview(), Promise.resolve().then(() => applications.own()),
        ]);
        if (!active) return;
        setMemberships(own.status === 'fulfilled' ? own.value : []);
        setCanReviewApplications(review.status === 'fulfilled');
        setOwnApplications(requests.status === 'fulfilled' && Array.isArray(requests.value) ? requests.value : []);
      } catch { if (active) { setSession(null); setMemberships([]); setCanReviewApplications(false); setOwnApplications([]); } }
    }
    void refresh();
    window.addEventListener('farmafind:session-changed', refresh);
    return () => { active = false; window.removeEventListener('farmafind:session-changed', refresh); };
  }, [sessionAware]);

  const actor = { session, memberships, canReview: canReviewApplications, applications: ownApplications };
  const links = navigationFor(actor);
  async function logout() { await client.logout(); window.location.assign('/'); }

  return <div className="site-frame">
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <header className="site-header">
      <div className="site-header-inner">
        <a className="brand" href="/" title="Ir al inicio de FarmaFind"><span className="brand-mark" aria-hidden="true">✚</span><span>farma<span>find</span><small>Salud cerca de ti</small></span></a>
        <nav className="site-nav" aria-label="Navegación principal">
          {links.map(link => <a key={link.href} href={link.href} aria-current={path === link.href ? 'page' : undefined}>{link.label}</a>)}
          <AccountMenu links={accountLinksFor(actor)} signedIn={Boolean(session)} profile={profile} onLogout={logout} />
        </nav>
      </div>
    </header>
    <div id="contenido" className="site-content">{children}</div>
    <ChatBubble path={path} />
    <footer className="site-footer"><div className="site-footer-inner">
      <div><strong>FarmaFind</strong><p>Información farmacéutica pública y referencial. La disponibilidad se confirma con cada farmacia.</p></div>
      <div><a href="/search">Buscar</a><a href="/assistant/conversation">Asistente</a></div>
      <p className="footer-caveat">FarmaFind no sustituye una consulta profesional de salud.</p>
    </div></footer>
  </div>;
}
