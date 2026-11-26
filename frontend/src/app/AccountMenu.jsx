import React, { useEffect, useRef, useState } from 'react';
import { ThemeSwitcher } from './ThemeSwitcher.jsx';

/**
 * «Mi cuenta» desplegable: perfil, accesos personales, tema y cerrar sesión. Solo presentación: el servidor autoriza.
 * El tema queda aquí también para quien no ha iniciado sesión.
 */
export function AccountMenu({ links, signedIn, profile, onLogout }) {
  const menu = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const outside = event => { if (menu.current?.open && !menu.current.contains(event.target)) menu.current.open = false; };
    document.addEventListener('click', outside);
    return () => document.removeEventListener('click', outside);
  }, []);

  function onKeyDown(event) {
    if (event.key !== 'Escape' || !menu.current?.open) return;
    menu.current.open = false;
    menu.current.querySelector('summary')?.focus();
  }
  async function logout() {
    setFailed(false);
    try { await onLogout(); } catch { setFailed(true); }
  }

  return <details ref={menu} className="account-menu" onKeyDown={onKeyDown}>
    <summary>Mi cuenta</summary>
    <div className="account-menu-panel">
      {links.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}
      <ThemeSwitcher signedIn={signedIn} profile={profile} />
      {signedIn && <button type="button" className="secondary-button" onClick={() => void logout()}>Cerrar sesión</button>}
      {failed && <p role="alert">No se pudo cerrar la sesión. Inténtalo de nuevo.</p>}
    </div>
  </details>;
}
