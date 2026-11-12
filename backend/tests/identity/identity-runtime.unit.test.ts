import { describe, expect, it } from 'vitest';
import { validateLocalIdentityRuntime } from '../../src/config/identity-runtime.js';

const config = {
  APP_MODE: 'identity', HOST: '127.0.0.1', PORT: '3000',
  F01_AUTH_DATABASE_URL: 'postgresql://auth:fictional@127.0.0.1:55431/farmafind_f01_test',
  F01_DATABASE_URL: 'postgresql://tenant:fictional@127.0.0.1:55431/farmafind_f01_test',
  F01_CSRF_KEY_HEX: 'a'.repeat(64), F01_ABUSE_KEY_HEX: 'b'.repeat(64),
  F01_ALLOWED_ORIGIN: 'http://127.0.0.1:5173',
  F01_CSRF_TRUSTED_ORIGIN: 'http://127.0.0.1:5173',
  F01_COOKIE_SECURE: 'false', F01_ALLOW_HTTP_LOOPBACK: 'true',
};

describe('composición F01 limitada a base ficticia local', () => {
  it('acepta credenciales separadas y claves independientes sin publicarlas', () => {
    const parsed = validateLocalIdentityRuntime(config);
    expect(parsed.authDatabaseUrl).not.toBe(parsed.tenantDatabaseUrl);
    expect(parsed.csrfKey.equals(parsed.abuseKey)).toBe(false);
    expect(parsed.allowedOrigin).toBe('http://127.0.0.1:5173');
  });
  it('rechaza base remota, roles compartidos, claves insuficientes y modo F00', () => {
    expect(() => validateLocalIdentityRuntime({ ...config, F01_DATABASE_URL: config.F01_DATABASE_URL.replace('127.0.0.1', 'example.invalid') })).toThrow('aislado');
    expect(() => validateLocalIdentityRuntime({ ...config, F01_DATABASE_URL: config.F01_AUTH_DATABASE_URL })).toThrow('usuarios distintos');
    expect(() => validateLocalIdentityRuntime({ ...config, F01_CSRF_KEY_HEX: 'abcd' })).toThrow('32 bytes');
    expect(() => validateLocalIdentityRuntime({ ...config, F01_ABUSE_KEY_HEX: config.F01_CSRF_KEY_HEX })).toThrow('distintas');
    expect(() => validateLocalIdentityRuntime({ ...config, APP_MODE: 'bootstrap' })).toThrow('obligatorios');
  });
});
