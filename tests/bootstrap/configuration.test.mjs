import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateConfig as api } from '../../backend/src/config/index.ts';
import { validateConfig as notifications } from '../../notifications/src/config/index.ts';
import { validateFrontend } from '../../scripts/f00/frontend-config.mjs';
import { configProfile } from '../../scripts/f00/config-profile.mjs';
const profiles = JSON.parse(readFileSync(new URL('../fixtures/config/profiles.json', import.meta.url), 'utf8'));

for (const [component, validate, port] of [['api', api, '3000'], ['notifications', notifications, '3001']]) {
  describe(component, () => {
    const valid = profiles[component];
    it('acepta el perfil mínimo sin integraciones', () => {
      expect(validate(valid)).toEqual({ mode: 'bootstrap', host: '127.0.0.1', port: Number(port) });
    });
    for (const name of ['APP_MODE', 'HOST', 'PORT']) {
      it(`rechaza ${name} ausente sin imprimir valores`, () => {
        const copy = { ...valid }; delete copy[name];
        expect(() => validate(copy)).toThrow(name);
      });
    }
    for (const value of ['', '0', '-1', '65536', 'text', '3.5']) {
      it(`rechaza puerto inválido: ${value}`, () => expect(() => validate({ ...valid, PORT: value })).toThrow('PORT'));
    }
    it('rechaza puerto duplicado de otro componente antes de arrancar', () => {
      expect(() => validate(valid, [Number(port)])).toThrow('PORT');
    });
    it('rechaza host/modo inválidos sin exponer el valor', () => {
      expect(() => validate({ ...valid, HOST: '0.0.0.0' })).toThrow('HOST');
      try { validate({ ...valid, APP_MODE: 'PRIVATE_FIXTURE_VALUE' }); } catch (error) {
        expect(error.message).not.toContain('PRIVATE_FIXTURE_VALUE');
      }
    });
    it('ignora integraciones futuras, no las habilita', () => {
      expect(validate({ ...valid, DATABASE_URL: 'fictitious-disabled', REDIS_URL: 'fictitious-disabled' })).toEqual(validate(valid));
    });
    it('no acepta variables heredadas contradictorias como sustituto del perfil propio', () => {
      const inherited = { APP_MODE: 'production', HOST: '0.0.0.0', PORT: '9999', DATABASE_URL: 'PRIVATE_FIXTURE_VALUE' };
      expect(validate(valid)).toEqual({ mode: 'bootstrap', host: '127.0.0.1', port: Number(port) });
      expect(() => validate(inherited)).toThrow('APP_MODE');
    });
  });
}
it('frontend acepta solo un indicador público bootstrap', () => {
  expect(validateFrontend({ VITE_APP_MODE: 'bootstrap' })).toEqual({ VITE_APP_MODE: 'bootstrap' });
  expect(() => validateFrontend({})).toThrow('VITE_APP_MODE');
  expect(() => validateFrontend({ VITE_APP_MODE: 'production' })).toThrow('VITE_APP_MODE');
  expect(() => validateFrontend({ VITE_APP_MODE: 'bootstrap', VITE_SECRET: 'fixture' })).toThrow('VITE_SECRET');
});
it('los perfiles conservan visibilidad y errores sin valores privados', () => {
  expect(configProfile({ profileId: 'A:api', visibility: 'private', source: 'fixture', variables: [], validation: 'valid' }).visibility).toBe('private');
  expect(() => configProfile({ profileId: '', visibility: 'unknown' })).toThrow();
});
