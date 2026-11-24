import React, { useState } from 'react';

const minimum = 12;

/** Primer ingreso con clave temporal: no se puede usar nada más hasta definir la clave definitiva. */
export function ForcedPasswordChange({ onSubmit, onLogout, busy = false, error = false }) {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [problem, setProblem] = useState(null);

  function submit(event) {
    event.preventDefault();
    if (password.length < minimum) { setProblem(`La clave debe tener al menos ${minimum} caracteres.`); return; }
    if (password !== repeat) { setProblem('Las dos claves no coinciden.'); return; }
    setProblem(null);
    const value = password;
    setPassword(''); setRepeat('');
    onSubmit(value);
  }

  return <section className="account-panel" aria-labelledby="forced-change-title">
    <h2 id="forced-change-title">Define tu clave definitiva</h2>
    <p>Ingresaste con una clave temporal. Antes de continuar debes elegir tu propia clave; la temporal ya no se podrá usar.</p>
    <form onSubmit={submit}>
      <label htmlFor="new-password">Clave nueva (mínimo {minimum} caracteres)</label>
      <input id="new-password" type="password" autoComplete="new-password" value={password}
        onChange={event => setPassword(event.target.value)} required maxLength={128} />
      <label htmlFor="repeat-password">Repite la clave nueva</label>
      <input id="repeat-password" type="password" autoComplete="new-password" value={repeat}
        onChange={event => setRepeat(event.target.value)} required maxLength={128} />
      {problem && <p role="alert">{problem}</p>}
      {error && !problem && <p role="alert">No se pudo guardar la clave. Inténtalo de nuevo.</p>}
      <button type="submit" disabled={busy}>Guardar clave y continuar</button>
      <button type="button" onClick={onLogout}>Cerrar sesión</button>
    </form>
  </section>;
}
