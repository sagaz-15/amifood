import { env } from '../../../../../config/env.ts';
import { BcryptPasswordHasher } from '../../security/bcrypt-password-hasher.ts';
import { openDatabase, runMigrations } from './database.ts';
import { SEED_CREDENTIALS, seedDatabase } from './seed.ts';

const reset = process.argv.includes('--reset');
const db = openDatabase(env.dbFile);

try {
  runMigrations(db);
  const result = await seedDatabase(db, {
    csvPath: env.csvPath,
    reset,
    passwordHasher: new BcryptPasswordHasher(10),
  });

  if (!result.seeded) {
    console.log('La base ya tiene datos. Use "npm run seed:reset" para recrearlos.');
  } else {
    console.log('\nCredenciales de demostracion:');
    console.log(`  ADMIN      -> ${SEED_CREDENTIALS.admin.email} / ${SEED_CREDENTIALS.admin.password}`);
    console.log(`  ENCARGADO  -> ${SEED_CREDENTIALS.store.email} / ${SEED_CREDENTIALS.store.password}`);
  }
} finally {
  db.close();
}
