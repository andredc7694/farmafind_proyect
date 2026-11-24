import React, { useEffect, useState } from 'react';
import { createProfileClient } from './profile-client.js';

const defaultClient = createProfileClient();
const minimum = 12;
const themeLabels = [['SISTEMA', 'Según el dispositivo'], ['CLARO', 'Claro'], ['OSCURO', 'Oscuro']];

const failureText = (error, fallback) => error?.status === 429 ? 'Demasiados intentos. Espera unos minutos.'
  : error?.status === 401 ? 'La clave actual no es correcta.' : fallback;

/**
 * «Mi perfil»: datos propios, correo, clave y sesiones. Nunca muestra ni edita roles o permisos; la interfaz no
 * es un control de seguridad (el servidor valida cada cambio y solo conoce al usuario de la sesión).
 */
export function Profile({ api = defaultClient, onSessionClosed }) {
  const [state, setState] = useState('loading');
  const [profile, setProfile] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [form, setForm] = useState({ displayName: '', phone: '', avatarPreset: '', theme: 'SISTEMA', notifyReservations: true, notifySecurity: true });
  const [message, setMessage] = useState({});
  const [busy, setBusy] = useState(false);
  const [emailForm, setEmailForm] = useState({ newEmail: '', currentPassword: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', repeat: '' });
  const [verifyCode, setVerifyCode] = useState('');

  const say = (section, kind, text) => setMessage(current => ({ ...current, [section]: { kind, text } }));
  const fill = value => setForm({ displayName: value.displayName ?? '', phone: value.phone ?? '', avatarPreset: value.avatarPreset ?? '',
    theme: value.theme, notifyReservations: value.notifyReservations, notifySecurity: value.notifySecurity });

  useEffect(() => {
    let active = true;
    Promise.all([api.get(), api.listSessions()]).then(([own, list]) => {
      if (!active) return;
      setProfile(own); fill(own); setSessions(list); setState('ready');
    }).catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, [api]);

  async function guarded(section, work, success, failure) {
    setBusy(true); setMessage(current => ({ ...current, [section]: null }));
    try { await work(); say(section, 'ok', success); }
    catch (error) { say(section, 'error', failureText(error, failure)); }
    finally { setBusy(false); }
  }

  const saveProfile = event => {
    event.preventDefault();
    void guarded('profile', async () => {
      const own = await api.update({ displayName: form.displayName, phone: form.phone === '' ? null : form.phone,
        avatarPreset: form.avatarPreset === '' ? null : Number(form.avatarPreset), theme: form.theme,
        notifyReservations: form.notifyReservations, notifySecurity: form.notifySecurity });
      setProfile(own); fill(own);
    }, 'Datos guardados.', 'No se pudieron guardar los datos. Revisa el teléfono y el nombre.');
  };

  const requestCode = () => guarded('email', () => api.requestEmailVerification(), 'Te enviamos un código de verificación.',
    'No se pudo enviar el código. Inténtalo más tarde.');

  const verify = event => {
    event.preventDefault();
    void guarded('email', async () => {
      await api.verifyEmail(verifyCode.trim()); setVerifyCode(''); setProfile(await api.get());
    }, 'Correo verificado.', 'El código no es válido o ya venció.');
  };

  const changeEmail = event => {
    event.preventDefault();
    const value = { newEmail: emailForm.newEmail.trim(), currentPassword: emailForm.currentPassword };
    setEmailForm({ newEmail: '', currentPassword: '' });
    void guarded('email', () => api.changeEmail(value),
      'Si el correo está disponible, te enviamos un código. El cambio se aplica al verificarlo.', 'No se pudo pedir el cambio de correo.');
  };

  const changePassword = event => {
    event.preventDefault();
    if (passwordForm.newPassword.length < minimum) { say('password', 'error', `La clave nueva debe tener al menos ${minimum} caracteres.`); return; }
    if (passwordForm.newPassword !== passwordForm.repeat) { say('password', 'error', 'Las dos claves nuevas no coinciden.'); return; }
    const value = { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword };
    setPasswordForm({ currentPassword: '', newPassword: '', repeat: '' });
    void guarded('password', async () => { await api.changePassword(value); setSessions(await api.listSessions()); },
      'Clave cambiada. Las demás sesiones se cerraron.', 'No se pudo cambiar la clave.');
  };

  const closeOne = id => guarded('sessions', async () => { await api.revokeSession(id); setSessions(await api.listSessions()); },
    'Sesión cerrada.', 'No se pudo cerrar la sesión.');
  const closeOthers = () => guarded('sessions', async () => { await api.revokeOtherSessions(); setSessions(await api.listSessions()); },
    'Se cerraron las demás sesiones.', 'No se pudieron cerrar las demás sesiones.');

  if (state === 'loading') return <p role="status">Cargando tu perfil…</p>;
  if (state === 'error') return <p role="alert">No se pudo cargar tu perfil.</p>;

  const note = section => message[section] && <p role={message[section].kind === 'error' ? 'alert' : 'status'}>{message[section].text}</p>;
  return <section aria-labelledby="profile-title">
    <h2 id="profile-title">Mi perfil</h2>
    <form onSubmit={saveProfile} aria-label="Datos personales">
      <label htmlFor="pf-name">Nombre</label>
      <input id="pf-name" value={form.displayName} maxLength={120} onChange={event => setForm({ ...form, displayName: event.target.value })} />
      <label htmlFor="pf-phone">Teléfono (opcional)</label>
      <input id="pf-phone" value={form.phone} maxLength={20} inputMode="tel" onChange={event => setForm({ ...form, phone: event.target.value })} />
      <label htmlFor="pf-avatar">Avatar</label>
      <select id="pf-avatar" value={form.avatarPreset} onChange={event => setForm({ ...form, avatarPreset: event.target.value })}>
        <option value="">Sin avatar</option>
        {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Avatar {index + 1}</option>)}
      </select>
      <label htmlFor="pf-theme">Tema</label>
      <select id="pf-theme" value={form.theme} onChange={event => setForm({ ...form, theme: event.target.value })}>
        {themeLabels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <label htmlFor="pf-n-res"><input id="pf-n-res" type="checkbox" checked={form.notifyReservations}
        onChange={event => setForm({ ...form, notifyReservations: event.target.checked })} /> Avisos de reservas</label>
      <label htmlFor="pf-n-sec"><input id="pf-n-sec" type="checkbox" checked={form.notifySecurity}
        onChange={event => setForm({ ...form, notifySecurity: event.target.checked })} /> Avisos de seguridad</label>
      <button type="submit" disabled={busy}>Guardar datos</button>
      {note('profile')}
    </form>

    <h3>Correo</h3>
    <p>{profile.email ? <>Correo actual: <strong>{profile.email}</strong> — {profile.emailVerified ? 'verificado' : 'sin verificar'}</> : 'Esta cuenta no tiene correo.'}</p>
    {profile.email && !profile.emailVerified && <>
      <button type="button" disabled={busy} onClick={() => void requestCode()}>Enviar código de verificación</button>
      <form onSubmit={verify} aria-label="Verificar correo">
        <label htmlFor="pf-code">Código recibido</label>
        <input id="pf-code" value={verifyCode} onChange={event => setVerifyCode(event.target.value)} autoComplete="off" required />
        <button type="submit" disabled={busy}>Verificar</button>
      </form></>}
    <form onSubmit={changeEmail} aria-label="Cambiar correo">
      <label htmlFor="pf-new-email">{profile.email ? 'Correo nuevo' : 'Agregar un correo'}</label>
      <input id="pf-new-email" type="email" value={emailForm.newEmail} maxLength={254} required autoComplete="off"
        onChange={event => setEmailForm({ ...emailForm, newEmail: event.target.value })} />
      <label htmlFor="pf-email-pass">Tu clave actual</label>
      <input id="pf-email-pass" type="password" value={emailForm.currentPassword} autoComplete="current-password" required
        onChange={event => setEmailForm({ ...emailForm, currentPassword: event.target.value })} />
      <button type="submit" disabled={busy}>Pedir cambio de correo</button>
    </form>
    {note('email')}

    <h3>Clave</h3>
    <form onSubmit={changePassword} aria-label="Cambiar clave">
      <label htmlFor="pf-cur">Clave actual</label>
      <input id="pf-cur" type="password" autoComplete="current-password" required value={passwordForm.currentPassword}
        onChange={event => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} />
      <label htmlFor="pf-new">Clave nueva (mínimo {minimum} caracteres)</label>
      <input id="pf-new" type="password" autoComplete="new-password" required maxLength={128} value={passwordForm.newPassword}
        onChange={event => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} />
      <label htmlFor="pf-rep">Repite la clave nueva</label>
      <input id="pf-rep" type="password" autoComplete="new-password" required maxLength={128} value={passwordForm.repeat}
        onChange={event => setPasswordForm({ ...passwordForm, repeat: event.target.value })} />
      <button type="submit" disabled={busy}>Cambiar clave</button>
    </form>
    {note('password')}

    <h3>Mis sesiones</h3>
    <ul>{sessions.map(item => <li key={item.id}>
      {item.current ? 'Esta sesión' : 'Otra sesión'} — iniciada {new Date(item.createdAt).toLocaleString('es-PE')}{' '}
      {!item.current && <button type="button" disabled={busy} onClick={() => void closeOne(item.id)}>Cerrar</button>}
    </li>)}</ul>
    {sessions.some(item => !item.current) && <button type="button" disabled={busy} onClick={() => void closeOthers()}>Cerrar las demás sesiones</button>}
    {note('sessions')}
    {onSessionClosed && <button type="button" onClick={onSessionClosed}>Cerrar esta sesión</button>}
  </section>;
}
