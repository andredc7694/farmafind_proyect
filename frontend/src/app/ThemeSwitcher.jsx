import React, { useEffect, useState } from 'react';
import { THEME_LABELS, THEME_VALUES, chooseTheme, readStoredTheme, syncThemeFromProfile } from './theme.js';

/** Selector de tema para la cabecera. `profile` (opcional) es el cliente de perfil de F01.1; sin sesión no se usa. */
export function ThemeSwitcher({ signedIn = false, profile = null }) {
  const [theme, setTheme] = useState(() => readStoredTheme());

  useEffect(() => {
    if (!signedIn || !profile) return undefined;
    let active = true;
    Promise.resolve().then(() => profile.get()).then(own => { if (active && own?.theme) setTheme(syncThemeFromProfile(own.theme)); }).catch(() => undefined);
    return () => { active = false; };
  }, [signedIn, profile]);

  async function change(event) { setTheme(await chooseTheme(event.target.value, { signedIn, profile })); }

  return <div className="theme-switcher">
    <label htmlFor="theme-select">Tema</label>
    <select id="theme-select" value={theme} onChange={event => void change(event)}>
      {THEME_VALUES.map(value => <option key={value} value={value}>{THEME_LABELS[value]}</option>)}
    </select>
  </div>;
}
