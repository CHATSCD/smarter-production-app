const Database = require('better-sqlite3');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

let db = null;

function getDatabasePath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'keiths.db');
}

function initDatabase() {
  const dbPath = getDatabasePath();
  console.log('Database path:', dbPath);

  // Create database connection
  db = new Database(dbPath, { verbose: console.log });

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Initialize schema
  initSchema();

  return db;
}

function initSchema() {
  // Create users table
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

  // Create scheduling_settings table
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

  // Create shifts table
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

  // Create waste_logs table
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

  // Create production_logs table
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

  // Create swap_requests table
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

  // Create notifications table
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
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    seedData();
  }
}

function seedData() {
  const bcrypt = require('bcryptjs');
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

  console.log('Database seeded with initial data');
}

function getDatabase() {
  if (!db) {
    initDatabase();
  }
  return db;
}

module.exports = {
  initDatabase,
  getDatabase,
  getDatabasePath,
};
