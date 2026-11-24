/**
 * Lee el simulador local de correo de TEST (F01.1, D-06 opción A).
 * Uso: node scripts/f01/mailbox.mjs [destino]   (sin destino muestra todos)
 * Solo lee .cache/f01-mailbox/mailbox.jsonl (ignorado por Git); datos ficticios.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Bandeja de la DEMO F01.1 si existe; si no, la de pruebas. F01_MAILBOX_DIR (bajo .cache) la reemplaza.
const demo = path.join(process.cwd(), '.cache/f011-demo/mailbox/mailbox.jsonl');
const file = process.env.F01_MAILBOX_DIR ? path.join(path.resolve(process.env.F01_MAILBOX_DIR), 'mailbox.jsonl')
  : existsSync(demo) ? demo : path.join(process.cwd(), '.cache/f01-mailbox/mailbox.jsonl');
if (!path.resolve(file).split(path.sep).includes('.cache')) { console.error('La bandeja debe estar bajo .cache'); process.exit(1); }
const target = process.argv[2];
if (!existsSync(file)) { console.log('Bandeja vacía (aún no se envió ningún mensaje).'); process.exit(0); }
const entries = readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line))
  .filter(entry => !target || entry.to === target);
if (entries.length === 0) console.log('Sin mensajes para ese destino.');
for (const entry of entries) {
  console.log(`[${entry.createdAt}] ${entry.kind} → ${entry.to}\n  código: ${entry.code}\n  vence: ${entry.expiresAt}`);
}
