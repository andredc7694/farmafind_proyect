import { test as base, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { ensureFree, launch, stop } from '../../scripts/f00/process-supervisor.mjs';
import { waitForHttp, healthCheck } from '../../scripts/f00/http-checks.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const specs = {
  frontend: { port: 4173, url: 'http://127.0.0.1:4173/', args: ['node_modules/vite/bin/vite.js', 'preview', 'frontend', '--config', 'frontend/vite.config.js', '--host', '127.0.0.1', '--port', '4173', '--strictPort'] },
  api: { port: 3000, url: 'http://127.0.0.1:3000/health', service: 'farmafind-api', args: ['backend/dist/main.js'] },
  notifications: { port: 3001, url: 'http://127.0.0.1:3001/health', service: 'farmafind-notifications', args: ['notifications/dist/main.js'] },
};

export const test = base.extend({
  services: async ({}, use) => {
    const logDir = mkdtempSync(path.join(tmpdir(), 'farmafind browser '));
    const active = new Map();
    async function start(name) {
      const spec = specs[name];
      await ensureFree(spec.port);
      const args = spec.args.map(item => item.includes('/') && !item.startsWith('--') ? path.join(root, item) : item);
      const child = launch({ id: name, args, logDir });
      active.set(name, child);
      await waitForHttp(spec.url, child, 60000);
      if (spec.service) await healthCheck(spec.url, spec.service);
      return child;
    }
    async function shutdown(name) {
      await stop(active.get(name));
      active.delete(name);
      await ensureFree(specs[name].port);
    }
    try {
      for (const name of Object.keys(specs)) await start(name);
      await use({ url: name => specs[name].url, start, stop: shutdown, health: name => healthCheck(specs[name].url, specs[name].service) });
    } finally {
      for (const child of [...active.values()].reverse()) await stop(child);
      for (const spec of Object.values(specs)) await ensureFree(spec.port);
      if (!logDir.startsWith(path.join(tmpdir(), 'farmafind browser '))) throw new Error('Unsafe cleanup target');
      rmSync(logDir, { recursive: true, force: true });
    }
  },
});
export { expect };
