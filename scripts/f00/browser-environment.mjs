import os from 'node:os';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

export function browserEnvironment() {
  const build = Number(os.release().split('.')[2] || 0);
  const compatible = process.platform === 'win32' && build >= 22000;
  const executable = chromium.executablePath();
  return { compatible, browserPrepared: compatible && existsSync(executable), windowsBuild: build };
}
