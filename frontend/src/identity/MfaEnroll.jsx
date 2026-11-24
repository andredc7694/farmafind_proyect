import React, { useState } from 'react';

const codePattern = /^[0-9]{6}$/;

function CodeForm({ label, button, busy, onSubmit }) {
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState(null);
  function submit(event) {
    event.preventDefault();
    const value = code.trim();
    if (!codePattern.test(value)) { setProblem('El código tiene 6 dígitos.'); return; }
    setProblem(null); setCode('');
    onSubmit(value);
  }
  return <form onSubmit={submit}>
    <label htmlFor="mfa-code">{label}</label>
    <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={6}
      onChange={event => setCode(event.target.value)} required />
    {problem && <p role="alert">{problem}</p>}
    <button type="submit" disabled={busy}>{button}</button>
  </form>;
}

/**
 * Segundo factor (TOTP) del administrador general. mode="verify": sesión restringida tras iniciar sesión.
 * mode="enroll": alta; el secreto se muestra una sola vez y no se guarda en el navegador.
 * La interfaz no decide nada: el servidor autoriza cada paso.
 */
export function MfaEnroll({ mode, api, onDone, onLogout }) {
  const [enrollment, setEnrollment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [done, setDone] = useState(false);

  async function begin() {
    setBusy(true); setMessage(null);
    try { setEnrollment(await api.enrollMfa()); }
    catch (error) {
      setMessage(error?.status === 403 ? 'Esta cuenta no requiere segundo factor.'
        : error?.status === 409 ? 'El segundo factor ya está activo.' : 'No se pudo iniciar el alta. Inténtalo de nuevo.');
    } finally { setBusy(false); }
  }

  async function submit(call, success) {
    setBusy(true); setMessage(null);
    try { await call(); setEnrollment(null); setDone(true); if (success) success(); }
    catch (error) {
      setMessage(error?.status === 429 ? 'Demasiados intentos. Espera unos minutos.' : 'El código no es válido. Revisa la hora de tu dispositivo.');
    } finally { setBusy(false); }
  }

  if (mode === 'verify') {
    return <section className="account-panel" aria-labelledby="mfa-title">
      <h2 id="mfa-title">Segundo factor</h2>
      <p>Escribe el código de 6 dígitos de tu aplicación de autenticación para continuar.</p>
      <CodeForm label="Código de verificación" button="Verificar" busy={busy}
        onSubmit={code => void submit(() => api.verifyMfa(code), onDone)} />
      {message && <p role="alert">{message}</p>}
      <button type="button" onClick={onLogout}>Cerrar sesión</button>
    </section>;
  }

  return <details className="account-panel">
    <summary>Segundo factor (administradores de la plataforma)</summary>
    {done && <p role="status">Segundo factor activo en esta sesión.</p>}
    {!done && !enrollment && <button type="button" disabled={busy} onClick={() => void begin()}>Activar segundo factor</button>}
    {enrollment && <>
      <p>Agrega esta clave en tu aplicación de autenticación. <strong>Se muestra una sola vez.</strong></p>
      <p><code aria-label="Clave del segundo factor">{enrollment.secret}</code></p>
      <p><a href={enrollment.otpauthUri}>Abrir en la aplicación de autenticación</a></p>
      <CodeForm label="Primer código generado" button="Activar" busy={busy}
        onSubmit={code => void submit(() => api.activateMfa(code), onDone)} />
    </>}
    {message && <p role="alert">{message}</p>}
  </details>;
}
