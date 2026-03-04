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

    // Run all migrations in order
    const migrations = ['001_initial.sql', '002_add_company_support.sql'];

    for (const migrationFile of migrations) {
      const migrationPath = join(process.cwd(), 'migrations', migrationFile);
      const sql = readFileSync(migrationPath, 'utf8');

      console.log(`🔄 Running migration: ${migrationFile}`);
      await pool.query(sql);
      console.log(`✅ ${migrationFile} completed`);
    }

    console.log('✅ All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
