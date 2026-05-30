import initSqlJs from 'sql.js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__dirname, '../../../data')
const DB_PATH = resolve(DATA_DIR, 'lottery.db')

let db = null
let saveTimer = null

export async function initDb() {
  if (db) return db

  const SQL = await initSqlJs()

  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  db.run('PRAGMA foreign_keys = ON')

  const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='shops'")
  if (result.length === 0) {
    const schema = readFileSync(resolve(__dirname, 'schema.sql'), 'utf-8')
    const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0)
    for (const stmt of statements) {
      try { db.run(stmt) } catch (e) { console.warn('Schema warning:', e.message) }
    }
    seed()
  } else {
    // Migration: ensure new tables exist for existing databases
    try { db.run(`CREATE TABLE IF NOT EXISTS staff_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, shop_id INTEGER NOT NULL, staff_id INTEGER NOT NULL,
      submission_date TEXT NOT NULL, cash_amount REAL NOT NULL DEFAULT 0, wechat_amount REAL NOT NULL DEFAULT 0,
      alipay_amount REAL NOT NULL DEFAULT 0, redemption_amount REAL NOT NULL DEFAULT 0, personal_card_id INTEGER,
      notes TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','discrepancy')),
      verified_by INTEGER, verified_at TEXT, verification_notes TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (shop_id) REFERENCES shops(id), FOREIGN KEY (staff_id) REFERENCES users(id),
      FOREIGN KEY (personal_card_id) REFERENCES bank_cards(id), FOREIGN KEY (verified_by) REFERENCES users(id))`) } catch (e) { console.warn('Migration warning:', e.message) }
    try { db.run('CREATE INDEX IF NOT EXISTS idx_submissions_shop ON staff_submissions(shop_id, submission_date)') } catch {}
    try { db.run('CREATE INDEX IF NOT EXISTS idx_submissions_status ON staff_submissions(status)') } catch {}
    try { db.run(`CREATE TABLE IF NOT EXISTS submission_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, submission_id INTEGER NOT NULL,
      file_path TEXT NOT NULL, file_name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (submission_id) REFERENCES staff_submissions(id) ON DELETE CASCADE)`) } catch (e) { console.warn('Migration warning:', e.message) }
    try { db.run('CREATE INDEX IF NOT EXISTS idx_attachments_submission ON submission_attachments(submission_id)') } catch {}
    // Migration: relax users role CHECK to support finance
    migrateUsersRole()
  }

  return db
}

function migrateUsersRole() {
  try {
    const info = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
    if (info.length > 0 && info[0].values[0][0]) {
      const ddl = info[0].values[0][0]
      if (!ddl.includes("'finance'")) {
        db.run('PRAGMA foreign_keys = OFF')
        db.run(`CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
          display_name TEXT NOT NULL, role TEXT NOT NULL, shop_id INTEGER, is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (shop_id) REFERENCES shops(id))`)
        db.run('INSERT INTO users_new SELECT * FROM users')
        db.run('DROP TABLE users')
        db.run('ALTER TABLE users_new RENAME TO users')
        db.run('CREATE INDEX IF NOT EXISTS idx_users_shop ON users(shop_id)')
        db.run('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)')
        db.run('PRAGMA foreign_keys = ON')
        console.log('Migrated users table to support finance role')
      }
    }
  } catch (e) { console.warn('Users migration warning:', e.message) }
}

function seed() {
  const existing = db.exec("SELECT id FROM shops WHERE is_warehouse = 1")
  if (existing.length === 0) {
    db.run("INSERT INTO shops (name, address, is_warehouse) VALUES ('总仓库', '', 1)")
  }

  const adminExists = db.exec("SELECT id FROM users WHERE username = 'admin'")
  if (adminExists.length === 0) {
    const hash = bcrypt.hashSync('admin123', 10)
    db.run("INSERT INTO users (username, password_hash, display_name, role) VALUES ('admin', ?, '超级管理员', 'super_admin')", [hash])
  }

  save()
}

export function save() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
      const data = db.export()
      const buffer = Buffer.from(data)
      writeFileSync(DB_PATH, buffer)
    } catch (e) {
      console.error('Failed to save database:', e.message)
    }
  }, 300)
}

export function run(sql, params = []) {
  db.run(sql, params)
  const info = db.exec("SELECT last_insert_rowid() as id")
  const lastInsertRowid = info.length > 0 ? info[0].values[0][0] : 0
  save()
  return { lastInsertRowid, changes: db.getRowsModified() }
}

export function get(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  if (stmt.step()) {
    const columns = stmt.getColumnNames()
    const values = stmt.get()
    stmt.free()
    const obj = {}
    columns.forEach((col, i) => { obj[col] = values[i] })
    return obj
  }
  stmt.free()
  return null
}

export function all(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const results = []
  const columns = stmt.getColumnNames()
  while (stmt.step()) {
    const values = stmt.get()
    const obj = {}
    columns.forEach((col, i) => { obj[col] = values[i] })
    results.push(obj)
  }
  stmt.free()
  return results
}

export function transaction(fn) {
  db.run('BEGIN TRANSACTION')
  try {
    const result = fn()
    db.run('COMMIT')
    save()
    return result
  } catch (e) {
    db.run('ROLLBACK')
    throw e
  }
}
