-- 彩票记账通 数据库 Schema
-- SQLite DDL

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 门店/仓库
CREATE TABLE IF NOT EXISTS shops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  address TEXT DEFAULT '',
  contact_phone TEXT DEFAULT '',
  is_warehouse INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shops_status ON shops(status);

-- 用户
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('super_admin','admin','finance','staff')),
  shop_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);
CREATE INDEX IF NOT EXISTS idx_users_shop ON users(shop_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 设备（扫描枪/电脑投注机）
CREATE TABLE IF NOT EXISTS equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('scanner','betting_machine')),
  name TEXT NOT NULL,
  serial_number TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','assigned','in_maintenance','retired')),
  initial_balance REAL NOT NULL DEFAULT 0,
  current_balance REAL NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_equipment_type ON equipment(type);
CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);

-- 设备分配历史
CREATE TABLE IF NOT EXISTS equipment_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER NOT NULL,
  shop_id INTEGER NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  unassigned_at TEXT,
  assigned_by INTEGER,
  unassigned_by INTEGER,
  reason TEXT DEFAULT '',
  FOREIGN KEY (equipment_id) REFERENCES equipment(id),
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (assigned_by) REFERENCES users(id),
  FOREIGN KEY (unassigned_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_ea_equipment ON equipment_assignments(equipment_id, unassigned_at);
CREATE INDEX IF NOT EXISTS idx_ea_shop ON equipment_assignments(shop_id, unassigned_at);

-- 彩票品种目录
CREATE TABLE IF NOT EXISTS lottery_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  default_unit_price REAL NOT NULL,
  description TEXT DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 入库批次
CREATE TABLE IF NOT EXISTS lottery_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_number TEXT NOT NULL,
  lottery_type_id INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  total_quantity INTEGER NOT NULL,
  date_received TEXT NOT NULL,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER,
  FOREIGN KEY (lottery_type_id) REFERENCES lottery_types(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_batches_type ON lottery_batches(lottery_type_id);

-- 库存（按店铺+批次）
CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  shop_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  activated_quantity INTEGER NOT NULL DEFAULT 0,
  sold_quantity INTEGER NOT NULL DEFAULT 0,
  redeemed_quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(batch_id, shop_id),
  FOREIGN KEY (batch_id) REFERENCES lottery_batches(id),
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_shop ON inventory(shop_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batch ON inventory(batch_id);

-- 银行卡
CREATE TABLE IF NOT EXISTS bank_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('personal','corporate')),
  bank_name TEXT NOT NULL DEFAULT '',
  card_number TEXT NOT NULL DEFAULT '',
  balance REAL NOT NULL DEFAULT 0,
  shop_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);
CREATE INDEX IF NOT EXISTS idx_bank_cards_shop ON bank_cards(shop_id);

-- 银行流水
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('income','expense')),
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  shop_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER,
  FOREIGN KEY (card_id) REFERENCES bank_cards(id),
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_tx_card_date ON transactions(card_id, date);
CREATE INDEX IF NOT EXISTS idx_tx_shop_date ON transactions(shop_id, date);

-- 扫描枪记录
CREATE TABLE IF NOT EXISTS scanner_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER NOT NULL,
  shop_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('payment','redemption','activation')),
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER,
  FOREIGN KEY (equipment_id) REFERENCES equipment(id),
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_sr_equipment ON scanner_records(equipment_id, date);
CREATE INDEX IF NOT EXISTS idx_sr_shop ON scanner_records(shop_id, date);

-- 电脑投注机记录
CREATE TABLE IF NOT EXISTS betting_machine_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER NOT NULL,
  shop_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('recharge','computer_sale','adjustment')),
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER,
  FOREIGN KEY (equipment_id) REFERENCES equipment(id),
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_bmr_equipment ON betting_machine_records(equipment_id, date);
CREATE INDEX IF NOT EXISTS idx_bmr_shop ON betting_machine_records(shop_id, date);

-- 销售记录
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  shop_id INTEGER NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','wechat','alipay','redemption')),
  total_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','discrepancy')),
  description TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER,
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_sales_shop_date ON sales(shop_id, date);

-- 销售明细
CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  inventory_id INTEGER,
  lottery_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  amount REAL NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (inventory_id) REFERENCES inventory(id)
);

-- 调拨记录
CREATE TABLE IF NOT EXISTS transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  from_shop_id INTEGER NOT NULL,
  to_shop_id INTEGER NOT NULL,
  batch_id INTEGER NOT NULL,
  lottery_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  reason TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('pending','completed','cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER,
  FOREIGN KEY (from_shop_id) REFERENCES shops(id),
  FOREIGN KEY (to_shop_id) REFERENCES shops(id),
  FOREIGN KEY (batch_id) REFERENCES lottery_batches(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_transfers_from ON transfers(from_shop_id, date);
CREATE INDEX IF NOT EXISTS idx_transfers_to ON transfers(to_shop_id, date);

-- 收款核对
CREATE TABLE IF NOT EXISTS bank_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  card_id INTEGER NOT NULL,
  expected_amount REAL NOT NULL,
  actual_amount REAL NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','matched','discrepancy')),
  description TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER,
  FOREIGN KEY (card_id) REFERENCES bank_cards(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_receipts_card ON bank_receipts(card_id, date);

-- 每日结算
CREATE TABLE IF NOT EXISTS daily_settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL,
  settlement_date TEXT NOT NULL,
  cash_sales REAL NOT NULL DEFAULT 0,
  wechat_sales REAL NOT NULL DEFAULT 0,
  alipay_sales REAL NOT NULL DEFAULT 0,
  redemption_sales REAL NOT NULL DEFAULT 0,
  total_sales REAL NOT NULL DEFAULT 0,
  total_expenses REAL NOT NULL DEFAULT 0,
  net_amount REAL NOT NULL DEFAULT 0,
  inventory_value REAL NOT NULL DEFAULT 0,
  scanner_balance REAL NOT NULL DEFAULT 0,
  machine_balance REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed')),
  confirmed_by INTEGER,
  confirmed_at TEXT,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER,
  UNIQUE(shop_id, settlement_date),
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (confirmed_by) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_ds_shop_date ON daily_settlements(shop_id, settlement_date);

-- 撤店结算
CREATE TABLE IF NOT EXISTS closure_settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL UNIQUE,
  closure_date TEXT NOT NULL,
  remaining_inventory_value REAL NOT NULL DEFAULT 0,
  scanner_returned INTEGER NOT NULL DEFAULT 0,
  scanner_id INTEGER,
  machine_returned INTEGER NOT NULL DEFAULT 0,
  machine_id INTEGER,
  total_sales REAL NOT NULL DEFAULT 0,
  total_expenses REAL NOT NULL DEFAULT 0,
  net_financial REAL NOT NULL DEFAULT 0,
  final_balance REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed')),
  confirmed_by INTEGER,
  confirmed_at TEXT,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER,
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (scanner_id) REFERENCES equipment(id),
  FOREIGN KEY (machine_id) REFERENCES equipment(id),
  FOREIGN KEY (confirmed_by) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 店员交账记录
CREATE TABLE IF NOT EXISTS staff_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL,
  staff_id INTEGER NOT NULL,
  submission_date TEXT NOT NULL,
  cash_amount REAL NOT NULL DEFAULT 0,
  wechat_amount REAL NOT NULL DEFAULT 0,
  alipay_amount REAL NOT NULL DEFAULT 0,
  redemption_amount REAL NOT NULL DEFAULT 0,
  personal_card_id INTEGER,
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','discrepancy')),
  verified_by INTEGER,
  verified_at TEXT,
  verification_notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (staff_id) REFERENCES users(id),
  FOREIGN KEY (personal_card_id) REFERENCES bank_cards(id),
  FOREIGN KEY (verified_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_submissions_shop ON staff_submissions(shop_id, submission_date);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON staff_submissions(status);

-- 交账凭证附件
CREATE TABLE IF NOT EXISTS submission_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (submission_id) REFERENCES staff_submissions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_attachments_submission ON submission_attachments(submission_id);
