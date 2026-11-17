import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';

function canonical(request) {
  return JSON.stringify({ approvalId:request.approvalId, operation:request.operation, targetUserId:request.targetUserId,
    pharmacyId:request.pharmacyId ?? null, role:request.role, reason:request.reason,
    expiresAt:request.expiresAt, idempotencyKey:request.idempotencyKey });
}

export function validateBootstrapInput(databaseUrl, request) {
  const url=new URL(databaseUrl);
  if (url.hostname!=='127.0.0.1' || url.port!=='55431' || !/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(url.pathname))
    throw new Error('BOOT-01 solo admite una base F01 efimera local');
  const allowed=['INITIAL_PLATFORM_ADMIN','INITIAL_PHARMACY_OWNER','GRANT_PLATFORM_ROLE','REVOKE_PLATFORM_ROLE'];
  if (!allowed.includes(request.operation) || !/^[0-9a-f-]{36}$/i.test(request.approvalId) ||
      !/^[0-9a-f-]{36}$/i.test(request.targetUserId) || typeof request.reason!=='string' || request.reason.length<8 ||
      !Number.isFinite(Date.parse(request.expiresAt)) || Date.parse(request.expiresAt)<=Date.now() ||
      !/^[a-f0-9]{64}$/.test(request.integrityHash)) throw new Error('Expediente BOOT-01 invalido');
  const expected=createHash('sha256').update(canonical(request)).digest('hex');
  if (expected!==request.integrityHash) throw new Error('Integridad BOOT-01 invalida');
  if (request.operation==='INITIAL_PHARMACY_OWNER') {
    if (request.role!=='DUENO' || !/^[0-9a-f-]{36}$/i.test(request.pharmacyId ?? '')) throw new Error('Ambito BOOT-01 invalido');
  } else if (request.role!=='ADMINISTRADOR_PLATAFORMA' || request.pharmacyId != null) {
    throw new Error('Rol BOOT-01 invalido');
  }
  if (request.operation.startsWith('INITIAL_') &&
      (typeof request.idempotencyKey!=='string' || request.idempotencyKey.length<16)) throw new Error('Idempotencia BOOT-01 invalida');
  return url;
}

async function main() {
  const databaseUrl=process.env.F01_BOOTSTRAP_DATABASE_URL;
  const documentPath=process.argv[2];
  if (!databaseUrl || !documentPath) throw new Error('Uso: F01_BOOTSTRAP_DATABASE_URL=... node scripts/f01/bootstrap.mjs <expediente.local.json>');
  const request=JSON.parse(await readFile(documentPath,'utf8'));
  validateBootstrapInput(databaseUrl,request);
  const client=new Client({connectionString:databaseUrl}); await client.connect();
  try {
    await client.query('BEGIN'); await client.query('SET LOCAL ROLE f01_bootstrap_executor');
    await client.query('SELECT f01.record_privileged_approval($1,$2,$3,$4,$5,$6,$7,$8)',[
      request.approvalId,request.operation,request.targetUserId,request.pharmacyId ?? null,request.role,
      request.reason,request.expiresAt,request.integrityHash]);
    if (request.operation.startsWith('INITIAL_')) await client.query('SELECT f01.execute_initial_bootstrap($1,$2,$3)',
      [request.approvalId,request.idempotencyKey,randomUUID()]);
    await client.query('COMMIT');
    console.log(request.operation.startsWith('INITIAL_') ? 'BOOT-01 ejecutado en base efimera' : 'Aprobacion global registrada');
  } catch(error) { await client.query('ROLLBACK'); throw error; } finally { await client.end(); }
}

if (process.argv[1] && import.meta.url===new URL(`file:///${process.argv[1].replaceAll('\\','/')}`).href) {
  main().catch(error=>{ console.error(error instanceof Error ? error.message : 'BOOT-01 fallo'); process.exitCode=1; });
}
