import { validateIdentityConfig } from './identity.js';
import type { LocalIdentityRuntimeConfig } from '../identity-app.js';

function key(env: Record<string, string | undefined>, name: string): Buffer {
  const value = env[name] ?? '';
  if (!/^[0-9a-f]{64,}$/i.test(value) || value.length % 2 !== 0) {
    throw new Error(`${name}: se requieren al menos 32 bytes hexadecimales`);
  }
  return Buffer.from(value, 'hex');
}

function localDatabase(value: string, name: string): URL {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' ||
      url.port !== '55431' || !/^\/farmafind_f01_test(?:_[a-f0-9]{12})?$/.test(url.pathname) ||
      !url.username || !url.password || url.search || url.hash) {
    throw new Error(`${name}: solo PostgreSQL de prueba aislado en 127.0.0.1:55431`);
  }
  return url;
}

/** This entry point is intentionally restricted to synthetic local databases. */
export function validateLocalIdentityRuntime(env: Record<string, string | undefined>): LocalIdentityRuntimeConfig {
  if (env.APP_MODE !== 'identity' || env.HOST !== '127.0.0.1' || env.PORT !== '3000') {
    throw new Error('F01: APP_MODE=identity, HOST=127.0.0.1 y PORT=3000 obligatorios');
  }
  const base = validateIdentityConfig(env);
  if (base.allowedOrigin !== 'http://127.0.0.1:5173' || base.cookieSecure || !base.allowHttpLoopback) {
    throw new Error('F01: origen HTTP local exacto requerido');
  }
  const authUrl = localDatabase(env.F01_AUTH_DATABASE_URL ?? '', 'F01_AUTH_DATABASE_URL');
  const tenantUrl = localDatabase(base.databaseUrl, 'F01_DATABASE_URL');
  if (authUrl.pathname !== tenantUrl.pathname || authUrl.username === tenantUrl.username) {
    throw new Error('F01: auth y tenant requieren misma base y usuarios distintos');
  }
  const csrfKey = key(env, 'F01_CSRF_KEY_HEX');
  const abuseKey = key(env, 'F01_ABUSE_KEY_HEX');
  if (csrfKey.equals(abuseKey)) throw new Error('F01: claves CSRF y abuso deben ser distintas');
  return { authDatabaseUrl: authUrl.toString(), tenantDatabaseUrl: tenantUrl.toString(),
    csrfKey, abuseKey, allowedOrigin: base.allowedOrigin, cookieSecure: false };
}
