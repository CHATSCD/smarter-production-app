import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    // Test basic connection
    const result = await pool.query('SELECT NOW() as time, version() as version');

    // Check if users table exists
    const tableCheck = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    // Try to count users
    let userCount = 0;
    try {
      const userResult = await pool.query('SELECT COUNT(*) as count FROM users');
      userCount = parseInt(userResult.rows[0].count);
    } catch (e) {
      // Table might not exist yet
    }

    return NextResponse.json({
      success: true,
      database: {
        connected: true,
        time: result.rows[0].time,
        version: result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1],
      },
      tables: tableCheck.rows.map(r => r.table_name),
      userCount,
      message: userCount === 0
        ? '⚠️ Database connected but no users found. Run migrations!'
        : '✅ Database ready with users',
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      hint: 'Check DATABASE_URL env variable and run migrations',
    }, { status: 500 });
  }
}
