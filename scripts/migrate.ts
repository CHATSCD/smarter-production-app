import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('neon.tech')
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    console.log('🔄 Connecting to database...');

    const migrationPath = join(process.cwd(), 'migrations', '001_initial.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    console.log('🔄 Running migration: 001_initial.sql');
    await pool.query(sql);

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
