import React, { useEffect, useState } from 'react';
import { createSessionClient } from './session-client.js';
import { Profile } from './Profile.jsx';

const defaultSession = createSessionClient();

/** F071-FR-009 (D-05 A): «Mi perfil» en su propia página; mismas reglas que en /identity. */
export function ProfilePage({ sessionClient = defaultSession }) {
  const [state, setState] = useState('loading');
  useEffect(() => {
    let current = true;
    sessionClient.session().then(value => { if (current) setState(value && !value.restriction ? 'ready' : 'anonymous'); })
      .catch(() => { if (current) setState('anonymous'); });
    return () => { current = false; };
  }, [sessionClient]);
  return <main className="page-stack profile-page">
    <h1>Mi perfil</h1>
    {state === 'loading' && <p role="status">Cargando tu perfil…</p>}
    {state === 'anonymous' && <p role="status">Inicia sesión para ver tu perfil. <a href="/identity">Entrar o crear cuenta</a></p>}
    {state === 'ready' && <Profile onSessionClosed={() => window.location.assign('/identity')} />}
  </main>;
}
