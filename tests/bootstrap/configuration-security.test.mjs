import { it, expect } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { validateConfig as api } from '../../backend/src/config/index.ts';
import { validateConfig as notifications } from '../../notifications/src/config/index.ts';
import { validateFrontend } from '../../scripts/f00/frontend-config.mjs';
import { createReport, redactReport, writeReport } from '../../scripts/f00/report.mjs';

const secret = 'F00_PRIVATE_FIXTURE_DO_NOT_PUBLISH';

it('errores de perfiles no exponen valores privados ficticios', () => {
  for (const validate of [api, notifications]) {
    try { validate({ APP_MODE: secret, HOST: secret, PORT: secret }); } catch (error) {
      expect(error.message).not.toContain(secret);
      expect(error.message).toContain('APP_MODE');
    }
  }
  try { validateFrontend({ VITE_APP_MODE: 'bootstrap', VITE_SECRET: secret }); } catch (error) {
    expect(error.message).not.toContain(secret);
  }
});

it('integraciones futuras no activan clientes ni aparecen en el bundle fuente', () => {
  const profile = { APP_MODE: 'bootstrap', HOST: '127.0.0.1', PORT: '3000', DATABASE_URL: secret, REDIS_URL: secret, AI_API_KEY: secret, AWS_ACCESS_KEY_ID: secret };
  expect(api(profile)).toEqual(api({ APP_MODE: 'bootstrap', HOST: '127.0.0.1', PORT: '3000' }));
  const publicFiles = ['frontend/src/main.jsx', 'frontend/src/Bootstrap.jsx', 'frontend/vite.config.js'];
  for (const file of publicFiles) expect(readFileSync(file, 'utf8')).not.toContain(secret);
});

it('el reporte redacta marcador y ruta de usuario al publicarse', () => {
  const report = createReport({ preparationId: 'A', scope: 'local', source: { hash: 'fixture' } });
  report.errors.push(`PORT: ${secret} en C:\\Users\\Persona\\proyecto`);
  const published = JSON.stringify(redactReport(report, [secret]));
  expect(published).not.toContain(secret);
  expect(published).not.toContain('Persona');
  expect(published).toContain('PORT');
  const dir = mkdtempSync(path.join(tmpdir(), 'farmafind security '));
  try {
    const output = writeReport(report, dir, [secret]);
    expect(readFileSync(output, 'utf8')).not.toContain(secret);
  } finally {
    if (!dir.startsWith(path.join(tmpdir(), 'farmafind security '))) throw new Error('Unsafe cleanup target');
    rmSync(dir, { recursive: true, force: true });
  }
});

it('el bundle compilado no incorpora variables privadas heredadas ficticias', () => {
  const root = path.resolve('.');
  const directory = mkdtempSync(path.join(tmpdir(), 'farmafind bundle '));
  try {
    const result = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--config', path.join(root, 'frontend/vite.config.js'), '--outDir', directory], {
      cwd: path.join(root, 'frontend'), encoding: 'utf8', windowsHide: true,
      env: { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, PATH: process.env.PATH, TEMP: process.env.TEMP, TMP: process.env.TMP, DATABASE_URL: secret, REDIS_URL: secret, AI_API_KEY: secret, AWS_ACCESS_KEY_ID: secret },
    });
    expect(result.status, result.stderr).toBe(0);
    const assets = path.join(directory, 'assets');
    for (const name of readdirSync(assets)) expect(readFileSync(path.join(assets, name), 'utf8')).not.toContain(secret);
  } finally {
    if (!directory.startsWith(path.join(tmpdir(), 'farmafind bundle '))) throw new Error('Unsafe cleanup target');
    rmSync(directory, { recursive: true, force: true });
  }
});
