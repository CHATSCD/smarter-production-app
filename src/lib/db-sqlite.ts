import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

let db: Database.Database | null = null;

function getDatabasePath(): string {
  // In production (Electron), use userData path
  // In development, use local file
  if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
    // This will be set by Electron
    const userDataPath = process.env.APPDATA ||
      (process.platform === 'darwin'
        ? path.join(process.env.HOME || '', 'Library', 'Application Support', 'keiths-superstores')
        : path.join(process.env.HOME || '', '.config', 'keiths-superstores'));

    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    return path.join(userDataPath, 'keiths.db');
  }

  // Development mode - use local database
  const dbDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return path.join(dbDir, 'keiths.db');
}

function initDatabase(): Database.Database {
  if (db) return db;

  const dbPath = getDatabasePath();
  console.log('Initializing SQLite database at:', dbPath);

  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  // Initialize schema
  initSchema();

  return db;
}

function initSchema() {
  if (!db) return;

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'employee')),
      store_id TEXT,
      pin TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Scheduling settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduling_settings (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      store_id TEXT UNIQUE NOT NULL,
      require_approval INTEGER DEFAULT 1,
      max_hours_week INTEGER DEFAULT 40,
      min_shift_gap_hrs INTEGER DEFAULT 8,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Shifts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      store_id TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      role_required TEXT,
      station TEXT,
      assigned_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      claimed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'unassigned'
        CHECK (status IN ('unassigned','pending','approved','completed','locked')),
      waste_total REAL DEFAULT 0,
      production_total REAL DEFAULT 0,
      approval_required INTEGER DEFAULT 1,
      notes TEXT,
      event_flag INTEGER DEFAULT 0,
      event_note TEXT,
      created_by TEXT REFERENCES users(id),
      approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      clock_in TEXT,
      clock_out TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_shifts_store_date ON shifts(store_id, date);
    CREATE INDEX IF NOT EXISTS idx_shifts_assigned ON shifts(assigned_user_id);
    CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
  `);

  // Waste logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS waste_logs (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      item_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      reason TEXT,
      cost REAL DEFAULT 0,
      logged_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_waste_logs_shift ON waste_logs(shift_id);
  `);

  // Production logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS production_logs (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      item_name TEXT NOT NULL,
      quantity_produced REAL NOT NULL,
      cost REAL DEFAULT 0,
      logged_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_prod_logs_shift ON production_logs(shift_id);
  `);

  // Swap requests table
  db.exec(`
    CREATE TABLE IF NOT EXISTS swap_requests (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      from_user_id TEXT NOT NULL REFERENCES users(id),
      to_user_id TEXT REFERENCES users(id),
      status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending','approved','denied')),
      message TEXT,
      reviewed_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Notifications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      read INTEGER DEFAULT 0,
      shift_id TEXT REFERENCES shifts(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
  `);

  // Seed data if no users exist
  const result = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (result.count === 0) {
    seedData();
  }
}

function seedData() {
  if (!db) return;

  const passwordHash = bcrypt.hashSync('password123', 10);

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, store_id)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertUser.run('Admin User', 'admin@keiths.com', passwordHash, 'admin', 'store-01');
  insertUser.run('Manager Sue', 'manager@keiths.com', passwordHash, 'manager', 'store-01');
  insertUser.run('John Smith', 'john@keiths.com', passwordHash, 'employee', 'store-01');
  insertUser.run('Jane Doe', 'jane@keiths.com', passwordHash, 'employee', 'store-01');

  const insertSettings = db.prepare(`
    INSERT INTO scheduling_settings (store_id, require_approval)
    VALUES (?, ?)
  `);
  insertSettings.run('store-01', 1);

  console.log('✅ Database seeded with initial users');
}

export function getDb(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

// Query helper for compatibility with PostgreSQL code
export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const database = getDb();
  const stmt = database.prepare(sql);
  const rows = params ? stmt.all(...params) : stmt.all();
  return rows as T[];
}

// Query one helper
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

// For INSERT/UPDATE/DELETE operations
export async function execute(
  sql: string,
  params?: unknown[]
): Promise<{ changes: number; lastInsertRowid: number | bigint }> {
  const database = getDb();
  const stmt = database.prepare(sql);
  const result = params ? stmt.run(...params) : stmt.run();
  return result;
}
