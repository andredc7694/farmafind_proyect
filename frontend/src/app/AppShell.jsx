import React, { useEffect, useState } from 'react';
import { createSessionClient } from '../identity/session-client.js';
import { createPharmacyApplicationClient } from '../pharmacies/application-client.js';
import { accountNavigation, pharmacyNavigation, publicNavigation } from './routes.js';

const client = createSessionClient();
const applications = createPharmacyApplicationClient();

export function AppShell({ children, path = window.location.pathname }) {
  const [session, setSession] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [canReviewApplications, setCanReviewApplications] = useState(false);
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
        if (!value) { setMemberships([]); setCanReviewApplications(false); return; }
        const [own, review] = await Promise.allSettled([
          client.memberships(), applications.canReview(),
        ]);
        if (!active) return;
        setMemberships(own.status === 'fulfilled' ? own.value : []);
        setCanReviewApplications(review.status === 'fulfilled');
      } catch { if (active) { setSession(null); setMemberships([]); setCanReviewApplications(false); } }
    }
    void refresh();
    window.addEventListener('farmafind:session-changed', refresh);
    return () => { active = false; window.removeEventListener('farmafind:session-changed', refresh); };
  }, [sessionAware]);

  const links = [...publicNavigation, ...(session ? accountNavigation : [{ href: '/identity', label: 'Mi cuenta' }]),
    ...pharmacyNavigation(memberships),
    ...(session && canReviewApplications ? [
      { href: '/admin/farmacias/solicitudes', label: 'Revisar solicitudes' },
    ] : [])];

  return <div className="site-frame">
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <header className="site-header">
      <div className="site-header-inner">
        <a className="brand" href="/" aria-label="FarmaFind, ir al inicio"><span className="brand-mark" aria-hidden="true">✚</span><span>farma<span>find</span><small>Salud cerca de ti</small></span></a>
        <nav className="site-nav" aria-label="Navegación principal">
          {links.map(link => <a key={link.href} href={link.href} aria-current={path === link.href ? 'page' : undefined}>{link.label}</a>)}
        </nav>
      </div>
    </header>
    <div id="contenido" className="site-content">{children}</div>
    <footer className="site-footer"><div className="site-footer-inner">
      <div><strong>FarmaFind</strong><p>Información farmacéutica pública y referencial. La disponibilidad se confirma con cada farmacia.</p></div>
      <div><a href="/search">Buscar</a><a href="/mapa">Farmacias</a><a href="/assistant/conversation">Asistente</a></div>
      <p className="footer-caveat">FarmaFind no sustituye una consulta profesional de salud.</p>
    </div></footer>
  </div>;
}
