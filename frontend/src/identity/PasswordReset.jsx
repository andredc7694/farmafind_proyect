import React, { useState } from 'react';

const minimum = 12;

/** Dos pasos: pedir el código por correo y definir la clave nueva. Nunca confirma si la cuenta existe. */
export function PasswordReset({ api, onDone, initialToken = '' }) {
  const [step, setStep] = useState(initialToken ? 'confirm' : 'request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [problem, setProblem] = useState(null);
  const [finished, setFinished] = useState(false);

  async function request(event) {
    event.preventDefault();
    setBusy(true); setProblem(null);
    try {
      await api.requestPasswordReset(email.trim());
      setMessage('Si existe una cuenta con ese correo, recibirás un código para restablecer tu clave. El código vence en 30 minutos.');
      setStep('confirm');
    } catch { setProblem('No se pudo procesar la solicitud. Revisa el correo e inténtalo de nuevo en unos minutos.'); }
    finally { setBusy(false); }
  }

  async function confirm(event) {
    event.preventDefault();
    if (password.length < minimum) { setProblem(`La clave debe tener al menos ${minimum} caracteres.`); return; }
    if (password !== repeat) { setProblem('Las dos claves no coinciden.'); return; }
    setBusy(true); setProblem(null);
    const value = password;
    setPassword(''); setRepeat('');
    try {
      await api.confirmPasswordReset({ token: token.trim(), newPassword: value });
      setToken(''); setFinished(true);
    } catch { setProblem('El código no es válido o ya venció. Solicita uno nuevo.'); }
    finally { setBusy(false); }
  }

  if (finished) return <section className="account-panel" aria-labelledby="reset-title">
    <h2 id="reset-title">Clave restablecida</h2>
    <p role="status">Tu clave se cambió y se cerraron tus otras sesiones. Ya puedes iniciar sesión.</p>
    <button type="button" onClick={onDone}>Ir a iniciar sesión</button>
  </section>;

  return <section className="account-panel" aria-labelledby="reset-title">
    <h2 id="reset-title">Restablecer clave</h2>
    {message && <p role="status">{message}</p>}
    {step === 'request' && <form onSubmit={request}>
      <label htmlFor="reset-email">Correo electrónico de tu cuenta</label>
      <input id="reset-email" type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} autoComplete="email" />
      {problem && <p role="alert">{problem}</p>}
      <button type="submit" disabled={busy}>Enviar código</button>{' '}
      <button type="button" onClick={() => setStep('confirm')}>Ya tengo un código</button>{' '}
      <button type="button" onClick={onDone}>Volver</button>
    </form>}
    {step === 'confirm' && <form onSubmit={confirm}>
      <label htmlFor="reset-token">Código recibido</label>
      <input id="reset-token" value={token} onChange={event => setToken(event.target.value)} required maxLength={200} autoComplete="off" />
      <label htmlFor="reset-password">Clave nueva (mínimo {minimum} caracteres)</label>
      <input id="reset-password" type="password" value={password} onChange={event => setPassword(event.target.value)} required maxLength={128} autoComplete="new-password" />
      <label htmlFor="reset-repeat">Repite la clave nueva</label>
      <input id="reset-repeat" type="password" value={repeat} onChange={event => setRepeat(event.target.value)} required maxLength={128} autoComplete="new-password" />
      {problem && <p role="alert">{problem}</p>}
      <button type="submit" disabled={busy}>Cambiar clave</button>{' '}
      <button type="button" onClick={() => { setStep('request'); setMessage(null); setProblem(null); }}>Pedir otro código</button>{' '}
      <button type="button" onClick={onDone}>Volver</button>
    </form>}
  </section>;
}
