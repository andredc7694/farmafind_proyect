import React, { useEffect, useState } from 'react';
import { createSessionClient } from '../identity/session-client.js';
import { accountNavigation, pharmacyNavigation, publicNavigation } from './routes.js';

const client = createSessionClient();

export function AppShell({ children, path = window.location.pathname }) {
  const [session, setSession] = useState(null);
  const [memberships, setMemberships] = useState([]);
  // F00 exercises the root with the API deliberately stopped. Other routes may
  // resolve the current session without persisting identity in browser storage.
  const sessionAware = path !== '/' && path !== '/bootstrap';

  useEffect(() => {
    if (!sessionAware) return undefined;
    let active = true;
    async function refresh() {
      try {
        const value = await client.session();
        if (!active) return;
        setSession(value);
        if (!value) { setMemberships([]); return; }
        try { const own = await client.memberships(); if (active) setMemberships(own); }
        catch { if (active) setMemberships([]); }
      } catch { if (active) { setSession(null); setMemberships([]); } }
    }
    void refresh();
    window.addEventListener('farmafind:session-changed', refresh);
    return () => { active = false; window.removeEventListener('farmafind:session-changed', refresh); };
  }, [sessionAware]);

  const links = [...publicNavigation, ...(session ? accountNavigation : [{ href: '/identity', label: 'Mi cuenta' }]),
    ...pharmacyNavigation(memberships)];

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
