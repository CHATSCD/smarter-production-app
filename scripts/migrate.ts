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

    // Run the complete schema migration
    const migrationPath = join(process.cwd(), 'migrations', '001_complete_schema.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    console.log('🔄 Running complete schema migration...');
    await pool.query(sql);

    console.log('✅ Database schema created successfully!');
    console.log('📊 All tables created');
    console.log('👤 Seed users added (password: password123)');
    console.log('   - admin@keiths.com');
    console.log('   - manager@keiths.com');
    console.log('   - john@keiths.com');
    console.log('   - jane@keiths.com');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
