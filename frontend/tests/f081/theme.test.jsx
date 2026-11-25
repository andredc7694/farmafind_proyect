// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { THEME_VALUES, applyTheme, chooseTheme, initTheme, readStoredTheme, storeTheme, syncThemeFromProfile } from '../../src/app/theme.js';
import { ThemeSwitcher } from '../../src/app/ThemeSwitcher.jsx';

beforeEach(() => { document.documentElement.removeAttribute('data-theme'); window.localStorage.clear(); });
afterEach(cleanup);

describe('F08.1 tema claro / oscuro / sistema', () => {
  it('aplica el tema al instante y entiende solo los tres valores', () => {
    expect(applyTheme('OSCURO')).toBe('OSCURO'); expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(applyTheme('CLARO')).toBe('CLARO'); expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(applyTheme('violeta')).toBe('SISTEMA'); expect(document.documentElement.getAttribute('data-theme')).toBe('system');
    expect(THEME_VALUES).toEqual(['SISTEMA', 'CLARO', 'OSCURO']);
  });

  it('un visitante lo recuerda solo en el navegador, con un único valor y sin datos personales', async () => {
    await chooseTheme('OSCURO', { signedIn: false });
    expect(window.localStorage.getItem('ff-theme')).toBe('OSCURO');
    expect(Object.keys(window.localStorage)).toEqual(['ff-theme']);
    expect(initTheme()).toBe('OSCURO'); expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(storeTheme('morado')).toBe(false); expect(readStoredTheme()).toBe('OSCURO');
  });

  it('sin almacenamiento disponible usa el tema del sistema y no falla', async () => {
    const broken = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
    expect(readStoredTheme(broken)).toBe('SISTEMA');
    expect(storeTheme('CLARO', broken)).toBe(false);
    expect(await chooseTheme('CLARO', { storage: broken })).toBe('CLARO');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('con sesión lo guarda en el perfil enviando solo el tema; si el perfil falla, el cambio local se conserva', async () => {
    const profile = { update: vi.fn().mockResolvedValue({}) };
    await chooseTheme('OSCURO', { signedIn: true, profile });
    expect(profile.update).toHaveBeenCalledWith({ theme: 'OSCURO' });
    const failing = { update: vi.fn().mockRejectedValue(new Error('500')) };
    expect(await chooseTheme('CLARO', { signedIn: true, profile: failing })).toBe('CLARO');
    expect(window.localStorage.getItem('ff-theme')).toBe('CLARO');
  });

  it('al iniciar sesión el perfil gana y se refleja en el navegador', () => {
    storeTheme('CLARO');
    expect(syncThemeFromProfile('OSCURO')).toBe('OSCURO');
    expect(window.localStorage.getItem('ff-theme')).toBe('OSCURO'); expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(syncThemeFromProfile('basura')).toBe('OSCURO');
  });

  it('el selector cambia el tema, lo aplica y lo guarda; con sesión toma el valor del perfil', async () => {
    const profile = { get: vi.fn().mockResolvedValue({ theme: 'OSCURO' }), update: vi.fn().mockResolvedValue({}) };
    render(<ThemeSwitcher signedIn profile={profile} />);
    await waitFor(() => expect(screen.getByLabelText('Tema').value).toBe('OSCURO'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    fireEvent.change(screen.getByLabelText('Tema'), { target: { value: 'CLARO' } });
    await waitFor(() => expect(profile.update).toHaveBeenCalledWith({ theme: 'CLARO' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('sin sesión el selector no consulta el perfil', async () => {
    const profile = { get: vi.fn(), update: vi.fn() };
    render(<ThemeSwitcher signedIn={false} profile={profile} />);
    fireEvent.change(screen.getByLabelText('Tema'), { target: { value: 'OSCURO' } });
    await waitFor(() => expect(window.localStorage.getItem('ff-theme')).toBe('OSCURO'));
    expect(profile.get).not.toHaveBeenCalled(); expect(profile.update).not.toHaveBeenCalled();
  });
});
