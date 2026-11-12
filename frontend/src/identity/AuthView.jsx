import React from 'react';

function submitCredentials(event, action) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const credentials = { email: String(data.get('email') ?? ''), password: String(data.get('password') ?? '') };
  form.reset();
  action(credentials);
}

/** Presentation only; session, CSRF and authorization remain server responsibilities. */
export function AuthView({ status = 'anonymous', error = false, notice = null, profile = null,
  onRegister, onLogin, onLogout }) {
  if (status === 'authenticated') {
    return <section aria-labelledby="identity-title">
      <h2 id="identity-title">Sesión activa</h2>
      {profile?.email && <p>Correo de tu perfil: <strong>{profile.email}</strong></p>}
      <button type="button" onClick={onLogout}>Cerrar sesión</button>
    </section>;
  }

  return <section aria-labelledby="identity-title">
    <h2 id="identity-title">Acceso a FarmaFind</h2>
    {status === 'expired' && <p role="status">Tu sesión terminó o expiró. Inicia sesión nuevamente.</p>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">No se pudo completar la solicitud. Revisa los datos e inténtalo de nuevo.</p>}
    <form onSubmit={event => submitCredentials(event, onRegister)}>
      <h3>Crear cuenta</h3>
      <label htmlFor="register-email">Correo electrónico</label>
      <input id="register-email" name="email" type="email" autoComplete="email" required maxLength={254} />
      <label htmlFor="register-password">Contraseña</label>
      <input id="register-password" name="password" type="password" autoComplete="new-password" required />
      <button type="submit" disabled={status === 'loading'}>Crear cuenta</button>
    </form>
    <form onSubmit={event => submitCredentials(event, onLogin)}>
      <h3>Iniciar sesión</h3>
      <label htmlFor="login-email">Correo electrónico</label>
      <input id="login-email" name="email" type="email" autoComplete="username" required />
      <label htmlFor="login-password">Contraseña</label>
      <input id="login-password" name="password" type="password" autoComplete="current-password" required />
      <button type="submit" disabled={status === 'loading'}>Iniciar sesión</button>
    </form>
  </section>;
}
