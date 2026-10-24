import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { config } from './config.js';
import { MIGRATIONS_FOLDER } from './constants.js';
import { seed } from './seed.js';

export const db = drizzle(new pg.Pool({ connectionString: config.databaseUrl }));

export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export async function migrateAndSeed() {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  await seed(db);
}
