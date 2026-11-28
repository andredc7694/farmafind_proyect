import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

interface MigrationClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
  end(): Promise<void>;
}

const reviewed = new Map<string,string>([
  ['001_applications.sql','0DC2EDB8326D5BF72558883EB06677D9E02A69FA82F557464157BC2456236C7D'],
  ['002_platform_permissions.sql','FC7427191D8EDC0680FBA2C12D9A8CCC94DE09DF91205BE5EBEA7AEB2590282C'],
  ['003_rls.sql','5B467815BAD93D298B1FF82EB474C89AB0EFEAB1F000EFC21AD00A8507CEBAFC'],
  ['004_activation.sql','090C26AD66FFA70A1F0E15F40D24AAD8D72C1A1A8E2A5692569234C848ED6004'],
  ['005_outbox.sql','5EA8CCA911F2C47DC794AF63CFE09A01A1DD42298DCC3679BC95F9CE5392C32A'],
  ['006_application_commands.sql','9EE07E3ECD6848B1E8F490734DACD9C6093F45D9613E394D3467B5F5C161975C'],
  ['007_review_queries.sql','6DBB267008A8E962D4A835F1D97D5DE83112D5086636A06DB8710D9B5B3CFA8B'],
  ['008_draft_edit.sql','18F734123F0E93EBCC3820E6CD69678B66F92A15B62239A9EF9AD4815E37571D'],
  ['009_owner_inventory_test.sql','4EECEDEFDDC98878F95E9BE28AEB0404FA4440307E4AB8B7C2822FB8DBD6D79D'],
  ['010_documents_test.sql','99B845D35A35B446762F3778D9AD6310FFC5E2E494BA1442142362DAE077E45B'],
  ['011_cancel_in_review.sql','D6EB9D78616C248A744FA180499E2DFACC927FF704E4F3C5536B318A21BDC8BD'],
  ['012_public_pharmacy_projection.sql','7072F13B01AB24495D24A1CDF7CBC9B0DF34AA1C635A443CF0F22E96FEEC0A18'],
  ['013_owner_reservations_test.sql','7CDA3E12731E7A9F8156DD93B8D8A6A33FAA8F545919F7CECF57B110B983839D'],
  ['014_private_profile_test.sql','9A0F2801DDC4CBD1BB73C94DED841152E59B9B3B5FFC1EA38AAE36F9A3996FC7'],
  ['015_application_notifications_test.sql','BF5C3300B818223DD99BFDC728CBAE0B360339BC9CB38C568661DF7FD275F857'],
  ['016_owner_staff_manage_test.sql','2667F61535861CB30852A3ACE1A867015A7AE68245EF254F9AFEBADCC7DF27AE'],
  ['017_owner_location_test.sql','CC87C9880E82DAC6796F11A0755FA8E880ED45CB68EECF35A93C6FCE7F131B9A'],
]);

/** F02.5 schema is deliberately unavailable to the persistent F01 database. */
export async function migrateF025TestDatabase(urlText:string,
  connect:(url:string)=>Promise<MigrationClient>):Promise<readonly string[]> {
  const url=new URL(urlText);
  if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!=='127.0.0.1'||
    url.port!=='55431'||!/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(url.pathname)||
    url.username!=='f01_migrator'||!url.password||url.search||url.hash) {
    throw new Error('F02.5: migraciones solo en PostgreSQL TEST efímero local');
  }
  const client=await connect(urlText);
  try {
    const identity=await client.query(`SELECT current_database() AS database,current_user AS role,
      current_setting('cluster_name') AS cluster,
      (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database
        WHERE datname=current_database())) AS marker`);
    const row=identity.rows[0];
    if(row?.database!==url.pathname.slice(1)||row.role!=='f01_migrator'||
      row.cluster!=='farmafind-f025-test'||row.marker!=='FarmaFind F07 TEST efimera') {
      throw new Error('F02.5: clúster o base TEST no autorizados');
    }
    await client.query('BEGIN');
    try {
      await client.query('CREATE SCHEMA IF NOT EXISTS f025');
      await client.query(`CREATE TABLE IF NOT EXISTS f025.schema_migrations
        (filename text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())`);
      const known=new Map((await client.query('SELECT filename,sha256 FROM f025.schema_migrations')).rows
        .map(item=>[String(item.filename),String(item.sha256)]));
      const applied:string[]=[];
      for(const [filename,expected] of reviewed){
        const sql=readFileSync(new URL(`../../../../migrations/f025/${filename}`,import.meta.url),'utf8');
        // Solo la comparación normaliza CRLF→LF (checkout de Windows); el SQL ejecutado no se modifica.
        const actual=createHash('sha256').update(sql.replaceAll('\r\n','\n')).digest('hex').toUpperCase();
        if(actual!==expected)throw new Error(`F02.5: SQL ${filename} cambió desde aprobación`);
        if(known.has(filename)){
          if(known.get(filename)!==expected)throw new Error(`F02.5: hash registrado de ${filename} no coincide`);
          continue;
        }
        await client.query(sql);
        await client.query('INSERT INTO f025.schema_migrations(filename,sha256) VALUES($1,$2)',[filename,expected]);
        applied.push(filename);
      }
      await client.query('COMMIT');
      return applied;
    }catch(error){await client.query('ROLLBACK');throw error;}
  }finally{await client.end();}
}
