export interface IdentityConfig {
  readonly databaseUrl: string;
  readonly allowedOrigin: string;
  readonly csrfTrustedOrigin: string;
  readonly cookieSecure: boolean;
  readonly allowHttpLoopback: boolean;
}

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name}: valor obligatorio`);
  return value;
}

function booleanValue(env: Record<string, string | undefined>, name: string): boolean {
  const value = required(env, name);
  if (value !== 'true' && value !== 'false') throw new Error(`${name}: debe ser true o false`);
  return value === 'true';
}

function origin(value: string, name: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name}: origen inválido`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.origin !== value) {
    throw new Error(`${name}: se exige origen HTTP(S) exacto sin ruta, comodín ni credenciales`);
  }
  return parsed;
}

function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/** Pure validation only: no PostgreSQL connection or session is opened here. */
export function validateIdentityConfig(env: Record<string, string | undefined>): IdentityConfig {
  for (const name of Object.keys(env)) {
    if (name.startsWith('VITE_') && name !== 'VITE_APP_MODE') {
      throw new Error(`${name}: variable privada prohibida en frontend`);
    }
  }

  const databaseUrl = required(env, 'F01_DATABASE_URL');
  let database: URL;
  try {
    database = new URL(databaseUrl);
  } catch {
    throw new Error('F01_DATABASE_URL: URL PostgreSQL inválida');
  }
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.username || !database.password || database.pathname.length < 2) {
    throw new Error('F01_DATABASE_URL: se exige conexión PostgreSQL completa');
  }

  const allowed = origin(required(env, 'F01_ALLOWED_ORIGIN'), 'F01_ALLOWED_ORIGIN');
  const csrf = origin(required(env, 'F01_CSRF_TRUSTED_ORIGIN'), 'F01_CSRF_TRUSTED_ORIGIN');
  if (allowed.origin !== csrf.origin) throw new Error('F01_CSRF_TRUSTED_ORIGIN: debe coincidir con el origen permitido');

  const cookieSecure = booleanValue(env, 'F01_COOKIE_SECURE');
  const allowHttpLoopback = booleanValue(env, 'F01_ALLOW_HTTP_LOOPBACK');
  if (allowed.protocol === 'http:' && (!isLoopback(allowed.hostname) || cookieSecure || !allowHttpLoopback)) {
    throw new Error('F01_ALLOWED_ORIGIN: HTTP solo permitido en loopback con excepción explícita y cookie local');
  }
  if (allowed.protocol === 'https:' && (!cookieSecure || allowHttpLoopback)) {
    throw new Error('F01_COOKIE_SECURE: HTTPS exige cookie segura y sin excepción HTTP local');
  }

  return { databaseUrl, allowedOrigin: allowed.origin, csrfTrustedOrigin: csrf.origin, cookieSecure, allowHttpLoopback };
}
