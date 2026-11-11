import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { inspectArchitecture } from '../../scripts/f00/check-architecture.mjs';
const scenarios = JSON.parse(readFileSync(new URL('../fixtures/architecture/scenarios.json', import.meta.url), 'utf8'));

function fixture(files, assertion) {
  const root = mkdtempSync(path.join(tmpdir(), 'farmafind architecture '));
  try {
    for (const [relative, content] of Object.entries(files)) {
      const target = path.join(root, relative);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
    return assertion(inspectArchitecture(root));
  } finally {
    if (!root.startsWith(path.join(tmpdir(), 'farmafind architecture '))) throw new Error('Unsafe cleanup target');
    rmSync(root, { recursive: true, force: true });
  }
}

describe('límites F00 de arquitectura', () => {
  it('acepta solo salud técnica y no exige módulos vacíos', () => fixture({
    'backend/src/app.ts': "import express from 'express'; app.get('/health', handler);",
    'notifications/src/app.ts': "import express from 'express'; app.get('/health', handler);",
  }, issues => expect(issues).toEqual([])));
  it('rechaza dominio que importa Express o infraestructura', () => fixture({
    'backend/src/modules/usuarios/domain/rule.ts': scenarios.domainExternal,
  }, issues => expect(issues.join(' ')).toContain('domain')));
  it('rechaza importación privada entre módulos', () => fixture({
    'backend/src/modules/farmacias/application/use-case.ts': scenarios.privateImport,
  }, issues => expect(issues.join(' ')).toContain('contratos')));
  it('rechaza Notificaciones usando instancia API y clientes externos', () => fixture({
    'notifications/src/app.ts': scenarios.notificationsCoupling,
  }, issues => { expect(issues.join(' ')).toContain('Notificaciones'); expect(issues.join(' ')).toContain('integración'); }));
  it('rechaza rutas de negocio añadidas al bootstrap', () => fixture({
    'backend/src/app.ts': scenarios.businessRoute,
  }, issues => expect(issues.join(' ')).toContain('ruta de negocio')));
});
