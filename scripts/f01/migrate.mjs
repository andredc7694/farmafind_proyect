import { Client } from 'pg';
import { migrateTestDatabase } from '../../backend/dist/modules/usuarios/infrastructure/db/migrate.js';

const url = process.env.F01_TEST_DATABASE_URL;
if (!url) {
  console.error('F01: falta F01_TEST_DATABASE_URL para base de prueba local');
  process.exit(1);
}

try {
  const result = await migrateTestDatabase(url, async connectionString => {
    const client = new Client({ connectionString });
    await client.connect();
    return client;
  });
  console.log(`F01 migraciones: aplicadas ${result.applied.length}; ya presentes ${result.skipped.length}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'F01: fallo de migración');
  process.exitCode = 1;
}
