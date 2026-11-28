import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgPublicOfferRepository } from '../../src/modules/busqueda/infrastructure/public-offer-repository.js';
import { SearchPublicOffers } from '../../src/modules/busqueda/application/search-public-offers.js';
import { F03PublicAssistantGateway } from '../../src/modules/busqueda/infrastructure/public-assistant-gateway.js';
import { ConverseAssistant } from '../../src/modules/asistente-ia/application/converse-assistant.js';
import { F03ConversationPublicTools } from '../../src/modules/asistente-ia/infrastructure/conversation-public-tools.js';
import { InMemoryReviewedSourceCatalog } from '../../src/modules/asistente-ia/infrastructure/reviewed-source-catalog.js';
import { MockConversationProvider } from '../../src/modules/asistente-ia/infrastructure/mock-conversation-provider.js';
import { createConversationRealFixture } from './fixtures/conversation-real-fixture.js';

describe('F06.1 PostgreSQL RLS real en base efímera', () => {
  let fixture: Awaited<ReturnType<typeof createConversationRealFixture>>;
  beforeAll(async () => { fixture = await createConversationRealFixture(); }, 30_000);
  afterAll(async () => { if (fixture) await fixture.close(); }, 30_000);

  it('runtime no tiene SUPERUSER/BYPASSRLS y las tablas privadas usan FORCE RLS', async () => {
    const role = (await fixture.base.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1',
      [fixture.roleName])).rows[0];
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
    const tables = (await fixture.database.query(`SELECT relrowsecurity,relforcerowsecurity FROM pg_class
      WHERE oid IN ('f02.inventario'::regclass,'f03.farmacia_publica'::regclass)`)).rows;
    expect(tables).toHaveLength(2);
    expect(tables.every(row => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
  });

  it('sin membresía autorizada no consulta inventario privado de Alfa ni Beta, incluso con farmacia_id', async () => {
    for (const pharmacyId of [fixture.alpha, fixture.beta]) {
      const client = await fixture.runtime.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.farmacia_id',$1,true)", [pharmacyId]);
        expect((await client.query('SELECT farmacia_id FROM f02.inventario')).rows).toEqual([]);
        expect((await client.query(`UPDATE f02.inventario SET precio_centavos=precio_centavos
          WHERE farmacia_id=$1 RETURNING id`, [pharmacyId])).rows).toEqual([]);
        await client.query('ROLLBACK');
      } finally { client.release(); }
    }
  });

  it('el asistente usa exclusivamente la proyección pública F03, sin campos privados ni SQL propio', async () => {
    const repository = new PgPublicOfferRepository(fixture.runtime);
    const search = new SearchPublicOffers(repository, null, { ttlSeconds: 30, candidateLimit: 200 });
    const tools = new F03ConversationPublicTools(new F03PublicAssistantGateway(search, repository));
    const assistant = new ConverseAssistant(new MockConversationProvider(), new InMemoryReviewedSourceCatalog([]),
      tools);
    const result = await assistant.execute({ consulta: `busca ${fixture.product}` }, 'corr-TEST');
    expect(result.estado).toBe('BUSQUEDA_PUBLICA');
    expect(result.fuentes).toHaveLength(2);
    expect(JSON.stringify(result.tarjetas)).toContain('Farmacia Alfa');
    expect(JSON.stringify(result.tarjetas)).toContain('Farmacia Beta');
    expect(JSON.stringify(result)).not.toMatch(/cantidad_fisica|cantidad_comprometida|password_hash|token_fingerprint/u);
    expect(result.fuentes.every(source => source.tipo === 'OFERTA_PUBLICA')).toBe(true);
  });
});
