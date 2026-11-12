import { createHmac } from 'node:crypto';
import { assessLoginLimit, assessRegistrationLimit } from '../domain/abuse-policy.js';
import type { AbuseDecision } from '../domain/abuse-policy.js';
import type { AbuseRepository } from '../application/ports.js';

type Scope = 'LOGIN_ACCOUNT' | 'LOGIN_IP' | 'REGISTER_IP';
interface SqlClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

/** Must be used inside the f01_auth transaction so advisory locks cover check + record. */
export class PgAbuseRepository implements AbuseRepository {
  constructor(private readonly client: SqlClient, private readonly hmacKey: Buffer) {
    if (hmacKey.length < 32) throw new Error('Clave ABUSE-01 insuficiente');
  }

  private digest(scope: Scope, identifier: string): Buffer {
    return createHmac('sha256', this.hmacKey).update(scope).update('\0').update(identifier).digest();
  }

  private async lock(digests: readonly Buffer[]): Promise<void> {
    for (const hex of digests.map(value => value.toString('hex')).sort()) {
      await this.client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))', [hex]);
    }
  }

  private async dates(scope: Scope, digest: Buffer, now: Date): Promise<Date[]> {
    const result = await this.client.query(`SELECT occurred_at FROM f01.abuse_attempt
      WHERE scope=$1 AND key_digest=$2 AND occurred_at>$3 AND occurred_at<=$4
      ORDER BY occurred_at DESC LIMIT 5`, [scope, digest, new Date(now.getTime() - 15 * 60_000), now]);
    return result.rows.map(row => row.occurred_at as Date);
  }

  async assessLogin(account: string, ip: string, now: Date): Promise<AbuseDecision> {
    const accountDigest = this.digest('LOGIN_ACCOUNT', account);
    const ipDigest = this.digest('LOGIN_IP', ip);
    await this.lock([accountDigest, ipDigest]);
    const [accountFailures, ipFailures] = await Promise.all([
      this.dates('LOGIN_ACCOUNT', accountDigest, now), this.dates('LOGIN_IP', ipDigest, now),
    ]);
    return assessLoginLimit(accountFailures, ipFailures, now);
  }

  async recordLoginFailure(account: string, ip: string, now: Date): Promise<void> {
    for (const scope of ['LOGIN_ACCOUNT', 'LOGIN_IP'] as const) {
      await this.client.query(`INSERT INTO f01.abuse_attempt(scope,key_digest,occurred_at) VALUES($1,$2,$3)`,
        [scope, this.digest(scope, scope === 'LOGIN_ACCOUNT' ? account : ip), now]);
    }
  }

  async assessRegistration(ip: string, now: Date): Promise<AbuseDecision> {
    const digest = this.digest('REGISTER_IP', ip);
    await this.lock([digest]);
    return assessRegistrationLimit(await this.dates('REGISTER_IP', digest, now), now);
  }

  async recordRegistrationAttempt(ip: string, now: Date): Promise<void> {
    await this.client.query(`INSERT INTO f01.abuse_attempt(scope,key_digest,occurred_at) VALUES($1,$2,$3)`,
      ['REGISTER_IP', this.digest('REGISTER_IP', ip), now]);
  }
}
