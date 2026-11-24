/**
 * Reinicio técnico OFFLINE del segundo factor de un administrador general (F011-FR-012, D-05).
 * No es una ruta ni una pantalla de la aplicación. Solo bases TEST marcadas (farmafind_f01_test_<12 hex>);
 * nunca la base persistente farmafind_f01_test. Requiere un expediente local ignorado por Git bajo .cache/.
 *
 * Uso:  node scripts/f01/reset-mfa.mjs --expediente .cache/f011-reset/<archivo>.json
 *       (URL por F01_RESET_DATABASE_URL; si falta, se usa el fixture TEST marcado local)
 * Expediente: { "userId": "<uuid>", "motivo": "<8-500 caracteres>", "autorizadoPor": "<nombre>" }
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { fixtureAdminUrl } from './fixture-admin-url.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const markedDatabase = /^\/farmafind_f01_test_[a-f0-9]{12}$/;

/** Valida el expediente local: debe vivir bajo .cache/ (ignorado por Git) y tener los tres campos. */
export function readTicket(root, ticketPath) {
  assert(ticketPath, 'Falta --expediente');
  const cache = realpathSync(path.join(root, '.cache'));
  assert(existsSync(ticketPath), 'Expediente inexistente');
  const resolved = realpathSync(ticketPath);
  assert(resolved.startsWith(cache + path.sep), 'El expediente debe estar bajo .cache/ (ignorado por Git)');
  const ticket = JSON.parse(readFileSync(resolved, 'utf8'));
  assert(uuid.test(ticket.userId ?? ''), 'userId inválido');
  assert(typeof ticket.motivo === 'string' && ticket.motivo.trim().length >= 8 && ticket.motivo.length <= 500, 'motivo inválido');
  assert(typeof ticket.autorizadoPor === 'string' && ticket.autorizadoPor.trim().length >= 2, 'autorizadoPor inválido');
  return ticket;
}

/** Reinicia el factor: destruye el secreto, deja el estado REINICIADO, cierra todas las sesiones y audita MFA_RESET. */
export async function resetMfa(client, userId) {
  assert(uuid.test(userId), 'userId inválido');
  await client.query('BEGIN');
  try {
    const row = await client.query('SELECT estado FROM f01.mfa_totp WHERE usuario_id=$1 FOR UPDATE', [userId]);
    assert(row.rows.length === 1, 'El usuario no tiene segundo factor registrado');
    await client.query(`UPDATE f01.mfa_totp SET estado='REINICIADO', secreto_cifrado='\\x00'::bytea,
      ultimo_paso_usado=NULL, activado_at=NULL WHERE usuario_id=$1`, [userId]);
    const closed = await client.query(`UPDATE f01.sesion SET estado='REVOCADA', revoked_at=now()
      WHERE usuario_id=$1 AND estado='VIGENTE' RETURNING id`, [userId]);
    await client.query(`INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, accion, resultado, correlation_id)
      VALUES (NULL, $1, 'MFA_RESET', 'PERMITIDO', $2)`, [userId, randomUUID()]);
    await client.query('COMMIT');
    return { previousState: row.rows[0].estado, sessionsClosed: closed.rowCount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const root = process.cwd();
  const flag = process.argv.indexOf('--expediente');
  const ticket = readTicket(root, flag > 0 ? process.argv[flag + 1] : undefined);
  const url = new URL(process.env.F01_RESET_DATABASE_URL ?? fixtureAdminUrl(root));
  assert(markedDatabase.test(url.pathname), 'Solo bases TEST marcadas (farmafind_f01_test_<12 hex>); nunca farmafind_f01_test');
  assert(['127.0.0.1', 'localhost'].includes(url.hostname), 'Solo bases locales');
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const outcome = await resetMfa(client, ticket.userId);
    console.log(`Segundo factor reiniciado (estado previo ${outcome.previousState}); sesiones cerradas: ${outcome.sessionsClosed}. Auditoría MFA_RESET registrada.`);
    console.log('El administrador debe volver a enrolarse en su próximo inicio de sesión.');
  } finally { await client.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(`Reinicio rechazado: ${error.message}`); process.exit(1); });
}
