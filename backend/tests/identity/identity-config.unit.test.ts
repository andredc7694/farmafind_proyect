import { describe, expect, it } from 'vitest';
import { validateIdentityConfig } from '../../src/config/identity.js';

const local = {
  F01_DATABASE_URL: 'postgresql://fictional_user:fictional_password@127.0.0.1:5432/farmafind_f01_test',
  F01_ALLOWED_ORIGIN: 'http://127.0.0.1:5173',
  F01_CSRF_TRUSTED_ORIGIN: 'http://127.0.0.1:5173',
  F01_COOKIE_SECURE: 'false',
  F01_ALLOW_HTTP_LOOPBACK: 'true',
};

describe('configuración F01 sin conexiones externas', () => {
  it('admite HTTP únicamente en loopback con excepción explícita', () => {
    const config = validateIdentityConfig(local);
    expect(config.allowedOrigin).toBe('http://127.0.0.1:5173');
    expect(config.cookieSecure).toBe(false);
  });

  it('rechaza HTTP remoto incluso si se activa la excepción', () => {
    expect(() => validateIdentityConfig({ ...local, F01_ALLOWED_ORIGIN: 'http://example.invalid', F01_CSRF_TRUSTED_ORIGIN: 'http://example.invalid' })).toThrow('loopback');
  });

  it('rechaza HTTP local sin la excepción o con cookie segura incompatible', () => {
    expect(() => validateIdentityConfig({ ...local, F01_ALLOW_HTTP_LOOPBACK: 'false' })).toThrow('loopback');
    expect(() => validateIdentityConfig({ ...local, F01_COOKIE_SECURE: 'true' })).toThrow('loopback');
  });

  it('admite HTTPS con cookie segura y sin excepción local', () => {
    const config = validateIdentityConfig({ ...local, F01_ALLOWED_ORIGIN: 'https://farmafind.example', F01_CSRF_TRUSTED_ORIGIN: 'https://farmafind.example', F01_COOKIE_SECURE: 'true', F01_ALLOW_HTTP_LOOPBACK: 'false' });
    expect(config.cookieSecure).toBe(true);
  });

  it('rechaza origen CSRF distinto, comodines y credenciales en origen', () => {
    expect(() => validateIdentityConfig({ ...local, F01_CSRF_TRUSTED_ORIGIN: 'http://localhost:5173' })).toThrow('coincidir');
    expect(() => validateIdentityConfig({ ...local, F01_ALLOWED_ORIGIN: '*' })).toThrow('origen inválido');
    expect(() => validateIdentityConfig({ ...local, F01_ALLOWED_ORIGIN: 'http://user:pass@127.0.0.1:5173' })).toThrow('origen HTTP(S) exacto');
  });

  it('no acepta secretos bajo VITE_ ni expone el valor de conexión en errores', () => {
    expect(() => validateIdentityConfig({ ...local, VITE_DATABASE_URL: 'fictional-secret' })).toThrow('VITE_DATABASE_URL');
    expect(() => validateIdentityConfig({ ...local, F01_DATABASE_URL: 'fictional-secret' })).toThrow('URL PostgreSQL inválida');
  });

  it('rechaza conexión vacía y booleanos ambiguos', () => {
    expect(() => validateIdentityConfig({ ...local, F01_DATABASE_URL: '' })).toThrow('valor obligatorio');
    expect(() => validateIdentityConfig({ ...local, F01_COOKIE_SECURE: '0' })).toThrow('true o false');
  });
});
