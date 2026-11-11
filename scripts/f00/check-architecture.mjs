import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const external = /(?:from\s*|require\s*\(|import\s*\(\s*)['"](?:pg|redis|ioredis|@aws-sdk|openai|@prisma|typeorm|sequelize)(?:['"/])/;
const businessRoute = /\b(?:app|router)\s*\.\s*(?:get|post|put|patch|delete)\s*\(\s*['"]\/(?:usuarios|farmacias|medicamentos|busqueda|inventario|reservas|administracion|ai)(?:\/|['"])/i;

export function inspectArchitecture(root) {
  const issues = [];
  for (const workspace of ['backend', 'notifications']) {
    const sourceRoot = path.join(root, workspace, 'src');
    if (!existsSync(sourceRoot)) continue;
    function visit(dir) {
      for (const item of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) { visit(full); continue; }
        if (!item.name.endsWith('.ts')) continue;
        const relative = path.relative(root, full).replaceAll('\\', '/');
        const text = readFileSync(full, 'utf8');
        if (external.test(text)) issues.push(`${relative}: integración operativa fuera de F00`);
        if (businessRoute.test(text)) issues.push(`${relative}: ruta de negocio fuera de F00`);
        if (workspace === 'notifications' && /(?:from|import\s*\()\s*['"][^'"]*backend\//.test(text)) issues.push(`${relative}: Notificaciones depende de instancia API`);
        if (relative.includes('/domain/') && /(?:from|import\s*\()\s*['"][^'"]*(?:express|infrastructure|presentation|application)/.test(text)) issues.push(`${relative}: domain depende de detalles externos`);
        const moduleMatch = relative.match(/\/modules\/([^/]+)\//);
        if (moduleMatch) {
          for (const [, imported] of text.matchAll(/(?:from|import\s*\()\s*['"]([^'"]+)['"]/g)) {
            const target = path.resolve(path.dirname(full), imported);
            const other = target.replaceAll('\\', '/').match(/\/modules\/([^/]+)\/([^/]+)/);
            if (other && other[1] !== moduleMatch[1] && other[2] !== 'contracts') issues.push(`${relative}: acceso privado entre módulos; usar contratos`);
          }
        }
      }
    }
    visit(sourceRoot);
  }
  return issues;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const issues = inspectArchitecture(root);
  if (issues.length) { console.error(issues.join('\n')); process.exitCode = 1; }
  else console.log('check:architecture: 0 violaciones en el código F00; RLS y seguridad de negocio no evaluados');
}
