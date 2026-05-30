import { Router } from 'express'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import { get, run, all, transaction } from '../db/index.js'
import { requireRole } from '../middleware/auth.js'
import { existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOAD_DIR = resolve(__dirname, '../../../uploads')
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, unique + '-' + file.originalname)
  }
})
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } })

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(e => res.status(500).json({ error: e.message }))

// ===== SHOPS =====
const shopsRouter = Router()
shopsRouter.get('/', wrap((req, res) => {
  const shops = req.user.role === 'super_admin'
    ? all('SELECT * FROM shops ORDER BY is_warehouse DESC, name ASC')
    : all('SELECT * FROM shops WHERE id = ?', [req.user.shopId])
  res.json(shops.map(s => ({ id: s.id, name: s.name, address: s.address, contactPhone: s.contact_phone, isWarehouse: s.is_warehouse, status: s.status, createdAt: s.created_at })))
}))

shopsRouter.get('/:id', wrap((req, res) => {
  const shop = get('SELECT * FROM shops WHERE id = ?', [req.params.id])
  if (!shop) return res.status(404).json({ error: '店铺不存在' })
  const equipment = all(`SELECT e.*, ea.assigned_at FROM equipment e JOIN equipment_assignments ea ON e.id = ea.equipment_id WHERE ea.shop_id = ? AND ea.unassigned_at IS NULL`, [shop.id])
  res.json({ id: shop.id, name: shop.name, address: shop.address, contactPhone: shop.contact_phone, isWarehouse: shop.is_warehouse, status: shop.status, createdAt: shop.created_at, equipment: equipment.map(e => ({ id: e.id, type: e.type, name: e.name, serialNumber: e.serial_number, status: e.status, initialBalance: e.initial_balance, currentBalance: e.current_balance, assignedAt: e.assigned_at })) })
}))

shopsRouter.post('/', requireRole('super_admin'), wrap((req, res) => {
  const { name, address, contactPhone } = req.body
  if (!name) return res.status(400).json({ error: '店铺名称必填' })
  try {
    const result = run('INSERT INTO shops (name, address, contact_phone) VALUES (?, ?, ?)', [name, address || '', contactPhone || ''])
    res.json({ id: result.lastInsertRowid, name, address: address || '', contactPhone: contactPhone || '', isWarehouse: 0, status: 'active' })
  } catch (err) { if (err.message.includes('UNIQUE')) return res.status(400).json({ error: '店铺名称已存在' }); throw err }
}))

shopsRouter.put('/:id', requireRole('super_admin'), wrap((req, res) => {
  const { name, address, contactPhone } = req.body
  run('UPDATE shops SET name = COALESCE(?, name), address = COALESCE(?, address), contact_phone = COALESCE(?, contact_phone), updated_at = datetime("now") WHERE id = ?', [name, address, contactPhone, req.params.id])
  const shop = get('SELECT * FROM shops WHERE id = ?', [req.params.id])
  res.json({ id: shop.id, name: shop.name, address: shop.address, contactPhone: shop.contact_phone, isWarehouse: shop.is_warehouse, status: shop.status })
}))

shopsRouter.get('/:id/inventory', wrap((req, res) => {
  const items = all(`SELECT i.*, lb.batch_number, lt.name as lottery_name, lb.unit_price FROM inventory i JOIN lottery_batches lb ON i.batch_id = lb.id JOIN lottery_types lt ON lb.lottery_type_id = lt.id WHERE i.shop_id = ? ORDER BY lt.name ASC`, [req.params.id])
  res.json(items.map(i => ({ id: i.id, batchId: i.batch_id, lotteryName: i.lottery_name, batchNumber: i.batch_number, unitPrice: i.unit_price, quantity: i.quantity, activatedQuantity: i.activated_quantity, soldQuantity: i.sold_quantity, redeemedQuantity: i.redeemed_quantity, unsoldQuantity: i.activated_quantity - i.sold_quantity, unsoldValue: (i.activated_quantity - i.sold_quantity) * i.unit_price })))
}))

// ===== USERS =====
const usersRouter = Router()
usersRouter.get('/', wrap((req, res) => {
  const users = req.user.role === 'super_admin'
    ? all('SELECT u.*, s.name as shop_name FROM users u LEFT JOIN shops s ON u.shop_id = s.id ORDER BY u.id')
    : all('SELECT u.*, s.name as shop_name FROM users u LEFT JOIN shops s ON u.shop_id = s.id WHERE u.shop_id = ? ORDER BY u.id', [req.user.shopId])
  res.json(users.map(u => ({ id: u.id, username: u.username, displayName: u.display_name, role: u.role, shopId: u.shop_id, shopName: u.shop_name, isActive: u.is_active, createdAt: u.created_at })))
}))

usersRouter.post('/', requireRole('admin', 'super_admin'), wrap((req, res) => {
  const { username, password, displayName, role, shopId } = req.body
  if (!username || !password || !displayName || !role) return res.status(400).json({ error: '请填写完整信息' })
  const effectiveRole = req.user.role === 'admin' ? 'staff' : role
  const effectiveShopId = req.user.role === 'admin' ? req.user.shopId : shopId
  if (effectiveRole !== 'staff' && req.user.role === 'admin') return res.status(403).json({ error: '管理员只能创建店员账号' })
  const hash = bcrypt.hashSync(password, 10)
  try {
    const result = run('INSERT INTO users (username, password_hash, display_name, role, shop_id) VALUES (?, ?, ?, ?, ?)', [username, hash, displayName, effectiveRole, effectiveShopId || null])
    res.json({ id: result.lastInsertRowid, username, displayName, role: effectiveRole, shopId: effectiveShopId })
  } catch (err) { if (err.message.includes('UNIQUE')) return res.status(400).json({ error: '用户名已存在' }); throw err }
}))

usersRouter.put('/:id', requireRole('admin', 'super_admin'), wrap((req, res) => {
  const { displayName, role, shopId, isActive } = req.body
  const targetUser = get('SELECT * FROM users WHERE id = ?', [req.params.id])
  if (!targetUser) return res.status(404).json({ error: '用户不存在' })
  if (req.user.role === 'admin' && (targetUser.role !== 'staff' || targetUser.shop_id !== req.user.shopId)) return res.status(403).json({ error: '只能编辑本店铺的店员' })
  const effectiveRole = req.user.role === 'admin' ? 'staff' : (role || targetUser.role)
  const effectiveShopId = req.user.role === 'admin' ? req.user.shopId : (shopId !== undefined ? shopId : targetUser.shop_id)
  run('UPDATE users SET display_name = COALESCE(?, display_name), role = ?, shop_id = ?, is_active = COALESCE(?, is_active), updated_at = datetime("now") WHERE id = ?', [displayName, effectiveRole, effectiveShopId, isActive !== undefined ? (isActive ? 1 : 0) : null, req.params.id])
  res.json({ success: true })
}))

usersRouter.delete('/:id', requireRole('super_admin'), wrap((req, res) => {
  run('UPDATE users SET is_active = 0, updated_at = datetime("now") WHERE id = ?', [req.params.id])
  res.json({ success: true })
}))

// ===== BANK CARDS =====
const bankCardsRouter = Router()
bankCardsRouter.get('/', wrap((req, res) => {
  const cards = req.user.role !== 'super_admin'
    ? all('SELECT * FROM bank_cards WHERE (shop_id = ? OR shop_id IS NULL) AND is_active = 1 ORDER BY id', [req.user.shopId])
    : all('SELECT * FROM bank_cards WHERE is_active = 1 ORDER BY id')
  res.json(cards.map(c => ({ id: c.id, name: c.name, type: c.type, bankName: c.bank_name, cardNumber: c.card_number, balance: c.balance, shopId: c.shop_id })))
}))

bankCardsRouter.post('/', requireRole('admin', 'super_admin'), wrap((req, res) => {
  const { name, type, bankName, cardNumber, balance, shopId } = req.body
  if (!name || !type) return res.status(400).json({ error: '请填写卡片名称和类型' })
  const effectiveShopId = req.user.role === 'admin' ? req.user.shopId : (shopId || null)
  const result = run('INSERT INTO bank_cards (name, type, bank_name, card_number, balance, shop_id) VALUES (?, ?, ?, ?, ?, ?)', [name, type, bankName || '', cardNumber || '', balance || 0, effectiveShopId])
  res.json({ id: result.lastInsertRowid, name, type, bankName: bankName || '', cardNumber: cardNumber || '', balance: balance || 0, shopId: effectiveShopId })
}))

bankCardsRouter.delete('/:id', requireRole('super_admin'), wrap((req, res) => {
  run('UPDATE bank_cards SET is_active = 0, updated_at = datetime("now") WHERE id = ?', [req.params.id])
  res.json({ success: true })
}))

// ===== TRANSACTIONS =====
const transactionsRouter = Router()
transactionsRouter.get('/', wrap((req, res) => {
  let sql = `SELECT t.*, bc.name as card_name, s.name as shop_name FROM transactions t LEFT JOIN bank_cards bc ON t.card_id = bc.id LEFT JOIN shops s ON t.shop_id = s.id WHERE 1=1`
  const params = []
  if (req.query.cardId) { sql += ' AND t.card_id = ?'; params.push(req.query.cardId) }
  if (req.query.shopId) { sql += ' AND t.shop_id = ?'; params.push(req.query.shopId) }
  if (req.query.dateFrom) { sql += ' AND t.date >= ?'; params.push(req.query.dateFrom) }
  if (req.query.dateTo) { sql += ' AND t.date <= ?'; params.push(req.query.dateTo) }
  if (req.user.role !== 'super_admin' && !req.query.shopId) { sql += ' AND (t.shop_id = ? OR t.shop_id IS NULL)'; params.push(req.user.shopId) }
  sql += ' ORDER BY t.date DESC, t.id DESC LIMIT 200'
  res.json(all(sql, params).map(r => ({ id: r.id, cardId: r.card_id, cardName: r.card_name, type: r.type, category: r.category, amount: r.amount, date: r.date, description: r.description, shopId: r.shop_id, shopName: r.shop_name })))
}))

transactionsRouter.post('/', wrap((req, res) => {
  const { cardId, type, category, amount, date, description, shopId } = req.body
  if (!cardId || !type || !category || !amount || !date) return res.status(400).json({ error: '请填写完整信息' })
  const effectiveShopId = req.user.role === 'super_admin' ? (shopId || null) : req.user.shopId
  try {
    const result = transaction(() => {
      const card = get('SELECT balance FROM bank_cards WHERE id = ?', [cardId])
      if (!card) throw new Error('银行卡不存在')
      const newBalance = type === 'income' ? card.balance + amount : card.balance - amount
      run('UPDATE bank_cards SET balance = ?, updated_at = datetime("now") WHERE id = ?', [newBalance, cardId])
      return run('INSERT INTO transactions (card_id, type, category, amount, date, description, shop_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [cardId, type, category, amount, date, description || '', effectiveShopId, req.user.id]).lastInsertRowid
    })
    res.json({ id: result, cardId, type, category, amount, date, description, shopId: effectiveShopId })
  } catch (err) { res.status(400).json({ error: err.message }) }
}))

transactionsRouter.delete('/:id', requireRole('admin', 'super_admin'), wrap((req, res) => {
  try {
    transaction(() => {
      const old = get('SELECT * FROM transactions WHERE id = ?', [req.params.id])
      if (!old) throw new Error('记录不存在')
      const card = get('SELECT balance FROM bank_cards WHERE id = ?', [old.card_id])
      const newBalance = old.type === 'income' ? card.balance - old.amount : card.balance + old.amount
      run('UPDATE bank_cards SET balance = ?, updated_at = datetime("now") WHERE id = ?', [newBalance, old.card_id])
      run('DELETE FROM transactions WHERE id = ?', [req.params.id])
    })
    res.json({ success: true })
  } catch (err) { res.status(400).json({ error: err.message }) }
}))

// ===== EQUIPMENT =====
const equipmentRouter = Router()
equipmentRouter.get('/', wrap((req, res) => {
  const rows = all(`SELECT e.*, ea.shop_id as current_shop_id, s.name as current_shop_name, ea.assigned_at FROM equipment e LEFT JOIN equipment_assignments ea ON e.id = ea.equipment_id AND ea.unassigned_at IS NULL LEFT JOIN shops s ON ea.shop_id = s.id ORDER BY e.type, e.name`)
  res.json(rows.map(r => ({ id: r.id, type: r.type, name: r.name, serialNumber: r.serial_number, status: r.status, initialBalance: r.initial_balance, currentBalance: r.current_balance, notes: r.notes, currentShopId: r.current_shop_id, currentShopName: r.current_shop_name, assignedAt: r.assigned_at })))
}))

equipmentRouter.post('/', requireRole('super_admin'), wrap((req, res) => {
  const { type, name, serialNumber, initialBalance } = req.body
  if (!type || !name) return res.status(400).json({ error: '请填写设备类型和名称' })
  const result = run('INSERT INTO equipment (type, name, serial_number, initial_balance, current_balance) VALUES (?, ?, ?, ?, ?)', [type, name, serialNumber || '', initialBalance || 0, initialBalance || 0])
  res.json({ id: result.lastInsertRowid, type, name, serialNumber: serialNumber || '', initialBalance: initialBalance || 0, currentBalance: initialBalance || 0, status: 'available' })
}))

equipmentRouter.post('/:id/assign', requireRole('super_admin'), wrap((req, res) => {
  const { shopId, reason } = req.body
  if (!shopId) return res.status(400).json({ error: '请选择店铺' })
  try {
    transaction(() => {
      const current = get('SELECT * FROM equipment_assignments WHERE equipment_id = ? AND unassigned_at IS NULL', [req.params.id])
      if (current) throw new Error('设备已被分配，请先解绑')
      const equip = get('SELECT type FROM equipment WHERE id = ?', [req.params.id])
      const existing = get(`SELECT ea.id FROM equipment_assignments ea JOIN equipment e ON ea.equipment_id = e.id WHERE ea.shop_id = ? AND e.type = ? AND ea.unassigned_at IS NULL`, [shopId, equip.type])
      if (existing) throw new Error(`该店铺已有${equip.type === 'scanner' ? '扫描枪' : '投注机'}`)
      run('INSERT INTO equipment_assignments (equipment_id, shop_id, assigned_by, reason) VALUES (?, ?, ?, ?)', [Number(req.params.id), shopId, req.user.id, reason || ''])
      run('UPDATE equipment SET status = "assigned", updated_at = datetime("now") WHERE id = ?', [Number(req.params.id)])
    })
    res.json({ success: true })
  } catch (err) { res.status(400).json({ error: err.message }) }
}))

equipmentRouter.post('/:id/unassign', requireRole('super_admin'), wrap((req, res) => {
  const { reason } = req.body
  try {
    transaction(() => {
      const current = get('SELECT * FROM equipment_assignments WHERE equipment_id = ? AND unassigned_at IS NULL', [req.params.id])
      if (!current) throw new Error('设备未被分配')
      run('UPDATE equipment_assignments SET unassigned_at = datetime("now"), unassigned_by = ?, reason = COALESCE(?, reason) WHERE id = ?', [req.user.id, reason || '', current.id])
      run('UPDATE equipment SET status = "available", updated_at = datetime("now") WHERE id = ?', [Number(req.params.id)])
    })
    res.json({ success: true })
  } catch (err) { res.status(400).json({ error: err.message }) }
}))

equipmentRouter.get('/:id/balance', wrap((req, res) => {
  const equip = get('SELECT * FROM equipment WHERE id = ?', [req.params.id])
  if (!equip) return res.status(404).json({ error: '设备不存在' })
  if (equip.type === 'scanner') {
    const stats = get(`SELECT COALESCE(SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END), 0) as tp, COALESCE(SUM(CASE WHEN type = 'redemption' THEN amount ELSE 0 END), 0) as tr, COALESCE(SUM(CASE WHEN type = 'activation' THEN amount ELSE 0 END), 0) as ta FROM scanner_records WHERE equipment_id = ?`, [req.params.id])
    const balance = equip.initial_balance + (stats?.tp || 0) + (stats?.tr || 0) - (stats?.ta || 0)
    res.json({ balance, breakdown: { initial: equip.initial_balance, payments: stats?.tp || 0, redemptions: stats?.tr || 0, activations: stats?.ta || 0 } })
  } else {
    res.json({ balance: equip.current_balance })
  }
}))

// ===== SCANNER RECORDS =====
const scannerRecordsRouter = Router()
scannerRecordsRouter.get('/', wrap((req, res) => {
  let sql = `SELECT sr.*, e.name as equipment_name, s.name as shop_name FROM scanner_records sr LEFT JOIN equipment e ON sr.equipment_id = e.id LEFT JOIN shops s ON sr.shop_id = s.id WHERE 1=1`
  const params = []
  if (req.query.equipmentId) { sql += ' AND sr.equipment_id = ?'; params.push(req.query.equipmentId) }
  if (req.query.shopId) { sql += ' AND sr.shop_id = ?'; params.push(req.query.shopId) }
  sql += ' ORDER BY sr.date DESC, sr.id DESC'
  res.json(all(sql, params).map(r => ({ id: r.id, equipmentId: r.equipment_id, equipmentName: r.equipment_name, shopId: r.shop_id, shopName: r.shop_name, type: r.type, amount: r.amount, date: r.date, description: r.description })))
}))

scannerRecordsRouter.post('/', wrap((req, res) => {
  const { equipmentId, shopId, type, amount, date, description } = req.body
  if (!equipmentId || !type || !amount || !date) return res.status(400).json({ error: '请填写完整信息' })
  const effectiveShopId = req.user.role === 'super_admin' ? (shopId || null) : req.user.shopId
  const result = run('INSERT INTO scanner_records (equipment_id, shop_id, type, amount, date, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', [equipmentId, effectiveShopId, type, amount, date, description || '', req.user.id])
  res.json({ id: result.lastInsertRowid, equipmentId, shopId: effectiveShopId, type, amount, date, description })
}))

scannerRecordsRouter.delete('/:id', requireRole('admin', 'super_admin'), wrap((req, res) => {
  run('DELETE FROM scanner_records WHERE id = ?', [req.params.id])
  res.json({ success: true })
}))

// ===== BETTING MACHINE RECORDS =====
const bettingMachineRouter = Router()
bettingMachineRouter.get('/', wrap((req, res) => {
  let sql = `SELECT bmr.*, e.name as equipment_name, s.name as shop_name FROM betting_machine_records bmr LEFT JOIN equipment e ON bmr.equipment_id = e.id LEFT JOIN shops s ON bmr.shop_id = s.id WHERE 1=1`
  const params = []
  if (req.query.equipmentId) { sql += ' AND bmr.equipment_id = ?'; params.push(req.query.equipmentId) }
  if (req.query.shopId) { sql += ' AND bmr.shop_id = ?'; params.push(req.query.shopId) }
  sql += ' ORDER BY bmr.date DESC, bmr.id DESC'
  res.json(all(sql, params).map(r => ({ id: r.id, equipmentId: r.equipment_id, equipmentName: r.equipment_name, shopId: r.shop_id, shopName: r.shop_name, type: r.type, amount: r.amount, date: r.date, description: r.description })))
}))

bettingMachineRouter.post('/', wrap((req, res) => {
  const { equipmentId, shopId, type, amount, date, description } = req.body
  if (!equipmentId || !type || !amount || !date) return res.status(400).json({ error: '请填写完整信息' })
  const effectiveShopId = req.user.role === 'super_admin' ? (shopId || null) : req.user.shopId
  try {
    transaction(() => {
      const equip = get('SELECT current_balance FROM equipment WHERE id = ?', [equipmentId])
      if (!equip) throw new Error('设备不存在')
      let newBalance = equip.current_balance
      if (type === 'recharge' || (type === 'adjustment' && amount > 0)) newBalance += amount
      else newBalance -= amount
      run('UPDATE equipment SET current_balance = ?, updated_at = datetime("now") WHERE id = ?', [newBalance, equipmentId])
      run('INSERT INTO betting_machine_records (equipment_id, shop_id, type, amount, date, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', [equipmentId, effectiveShopId, type, amount, date, description || '', req.user.id])
    })
    res.json({ success: true })
  } catch (err) { res.status(400).json({ error: err.message }) }
}))

// ===== INVENTORY =====
const inventoryRouter = Router()
inventoryRouter.get('/lottery-types', wrap((req, res) => {
  res.json(all('SELECT * FROM lottery_types WHERE is_active = 1 ORDER BY name').map(t => ({ id: t.id, name: t.name, defaultUnitPrice: t.default_unit_price, description: t.description })))
}))

inventoryRouter.post('/lottery-types', requireRole('admin', 'super_admin'), wrap((req, res) => {
  const { name, defaultUnitPrice, description } = req.body
  if (!name || !defaultUnitPrice) return res.status(400).json({ error: '请填写彩票名称和默认单价' })
  try {
    const result = run('INSERT INTO lottery_types (name, default_unit_price, description) VALUES (?, ?, ?)', [name, defaultUnitPrice, description || ''])
    res.json({ id: result.lastInsertRowid, name, defaultUnitPrice, description: description || '' })
  } catch (err) { if (err.message.includes('UNIQUE')) return res.status(400).json({ error: '彩票名称已存在' }); throw err }
}))

inventoryRouter.get('/batches', wrap((req, res) => {
  const batches = all(`SELECT lb.*, lt.name as lottery_name FROM lottery_batches lb JOIN lottery_types lt ON lb.lottery_type_id = lt.id ORDER BY lb.date_received DESC`)
  res.json(batches.map(b => ({ id: b.id, batchNumber: b.batch_number, lotteryTypeId: b.lottery_type_id, lotteryName: b.lottery_name, unitPrice: b.unit_price, totalQuantity: b.total_quantity, dateReceived: b.date_received, notes: b.notes })))
}))

inventoryRouter.post('/batches', requireRole('admin', 'super_admin'), wrap((req, res) => {
  const { batchNumber, lotteryTypeId, unitPrice, totalQuantity, dateReceived, notes } = req.body
  if (!batchNumber || !lotteryTypeId || !unitPrice || !totalQuantity || !dateReceived) return res.status(400).json({ error: '请填写完整入库信息' })
  try {
    const batchId = transaction(() => {
      const result = run('INSERT INTO lottery_batches (batch_number, lottery_type_id, unit_price, total_quantity, date_received, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', [batchNumber, lotteryTypeId, unitPrice, totalQuantity, dateReceived, notes || '', req.user.id])
      const warehouse = get("SELECT id FROM shops WHERE is_warehouse = 1")
      run('INSERT INTO inventory (batch_id, shop_id, quantity, activated_quantity, sold_quantity, redeemed_quantity) VALUES (?, ?, ?, 0, 0, 0)', [result.lastInsertRowid, warehouse.id, totalQuantity])
      return result.lastInsertRowid
    })
    res.json({ id: batchId, batchNumber, lotteryTypeId, unitPrice, totalQuantity, dateReceived })
  } catch (err) { res.status(400).json({ error: err.message }) }
}))

inventoryRouter.get('/', wrap((req, res) => {
  let sql = `SELECT i.*, lb.batch_number, lt.name as lottery_name, lb.unit_price, s.name as shop_name FROM inventory i JOIN lottery_batches lb ON i.batch_id = lb.id JOIN lottery_types lt ON lb.lottery_type_id = lt.id JOIN shops s ON i.shop_id = s.id WHERE 1=1`
  const params = []
  if (req.query.shopId) { sql += ' AND i.shop_id = ?'; params.push(req.query.shopId) }
  sql += ' ORDER BY s.is_warehouse DESC, lt.name ASC'
  res.json(all(sql, params).map(r => ({ id: r.id, batchId: r.batch_id, batchNumber: r.batch_number, lotteryName: r.lottery_name, unitPrice: r.unit_price, shopId: r.shop_id, shopName: r.shop_name, quantity: r.quantity, activatedQuantity: r.activated_quantity, soldQuantity: r.sold_quantity, redeemedQuantity: r.redeemed_quantity, unsoldQuantity: r.activated_quantity - r.sold_quantity, unsoldValue: (r.activated_quantity - r.sold_quantity) * r.unit_price })))
}))

inventoryRouter.post('/:id/activate', wrap((req, res) => {
  const { quantity } = req.body
  const item = get('SELECT * FROM inventory WHERE id = ?', [req.params.id])
  if (!item) return res.status(404).json({ error: '库存记录不存在' })
  const activateQty = quantity || (item.quantity - item.activated_quantity)
  if (activateQty <= 0) return res.status(400).json({ error: '没有可激活的数量' })
  const newActivated = Math.min(item.activated_quantity + activateQty, item.quantity)
  run('UPDATE inventory SET activated_quantity = ?, updated_at = datetime("now") WHERE id = ?', [newActivated, req.params.id])
  res.json({ success: true, activatedQuantity: newActivated })
}))

// ===== SALES =====
const salesRouter = Router()
salesRouter.get('/', wrap((req, res) => {
  let sql = `SELECT s.*, sh.name as shop_name FROM sales s LEFT JOIN shops sh ON s.shop_id = sh.id WHERE 1=1`
  const params = []
  if (req.query.shopId) { sql += ' AND s.shop_id = ?'; params.push(req.query.shopId) }
  if (req.query.dateFrom) { sql += ' AND s.date >= ?'; params.push(req.query.dateFrom) }
  if (req.query.dateTo) { sql += ' AND s.date <= ?'; params.push(req.query.dateTo) }
  sql += ' ORDER BY s.date DESC, s.id DESC'
  const rows = all(sql, params)
  res.json(rows.map(r => {
    const items = all('SELECT * FROM sale_items WHERE sale_id = ?', [r.id])
    return { id: r.id, date: r.date, shopId: r.shop_id, shopName: r.shop_name, paymentMethod: r.payment_method, totalAmount: r.total_amount, status: r.status, description: r.description, items: items.map(i => ({ id: i.id, inventoryId: i.inventory_id, lotteryName: i.lottery_name, quantity: i.quantity, unitPrice: i.unit_price, amount: i.amount })) }
  }))
}))

salesRouter.post('/', wrap((req, res) => {
  const { date, shopId, paymentMethod, items, description } = req.body
  if (!date || !shopId || !paymentMethod || !items?.length) return res.status(400).json({ error: '请填写完整销售信息' })
  const effectiveShopId = req.user.role === 'super_admin' ? shopId : req.user.shopId
  try {
    const saleId = transaction(() => {
      const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
      const result = run('INSERT INTO sales (date, shop_id, payment_method, total_amount, status, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', [date, effectiveShopId, paymentMethod, totalAmount, 'pending', description || '', req.user.id])
      for (const item of items) {
        const amount = item.quantity * item.unitPrice
        run('INSERT INTO sale_items (sale_id, inventory_id, lottery_name, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?, ?)', [result.lastInsertRowid, item.inventoryId || null, item.lotteryName, item.quantity, item.unitPrice, amount])
        if (item.inventoryId) run('UPDATE inventory SET sold_quantity = sold_quantity + ?, updated_at = datetime("now") WHERE id = ?', [item.quantity, item.inventoryId])
      }
      return result.lastInsertRowid
    })
    res.json({ id: saleId, date, shopId: effectiveShopId, paymentMethod })
  } catch (err) { res.status(400).json({ error: err.message }) }
}))

salesRouter.put('/:id/verify', requireRole('admin', 'super_admin'), wrap((req, res) => {
  run('UPDATE sales SET status = "verified" WHERE id = ?', [req.params.id])
  res.json({ success: true })
}))

salesRouter.delete('/:id', requireRole('admin', 'super_admin'), wrap((req, res) => {
  try {
    transaction(() => {
      const items = all('SELECT * FROM sale_items WHERE sale_id = ?', [req.params.id])
      for (const item of items) {
        if (item.inventory_id) run('UPDATE inventory SET sold_quantity = MAX(0, sold_quantity - ?), updated_at = datetime("now") WHERE id = ?', [item.quantity, item.inventory_id])
      }
      run('DELETE FROM sale_items WHERE sale_id = ?', [req.params.id])
      run('DELETE FROM sales WHERE id = ?', [req.params.id])
    })
    res.json({ success: true })
  } catch (err) { res.status(400).json({ error: err.message }) }
}))

// ===== TRANSFERS =====
const transfersRouter = Router()
transfersRouter.get('/', wrap((req, res) => {
  const rows = all(`SELECT t.*, fs.name as from_shop_name, ts.name as to_shop_name FROM transfers t LEFT JOIN shops fs ON t.from_shop_id = fs.id LEFT JOIN shops ts ON t.to_shop_id = ts.id ORDER BY t.date DESC, t.id DESC`)
  res.json(rows.map(r => ({ id: r.id, date: r.date, fromShopId: r.from_shop_id, fromShopName: r.from_shop_name, toShopId: r.to_shop_id, toShopName: r.to_shop_name, batchId: r.batch_id, lotteryName: r.lottery_name, quantity: r.quantity, unitPrice: r.unit_price, reason: r.reason, status: r.status })))
}))

transfersRouter.post('/', requireRole('admin', 'super_admin'), wrap((req, res) => {
  const { date, fromShopId, toShopId, batchId, lotteryName, quantity, unitPrice, reason } = req.body
  if (!date || !fromShopId || !toShopId || !batchId || !quantity) return res.status(400).json({ error: '请填写完整调拨信息' })
  try {
    const id = transaction(() => {
      const source = get('SELECT * FROM inventory WHERE batch_id = ? AND shop_id = ?', [batchId, fromShopId])
      if (!source) throw new Error('源库存不存在')
      if (source.quantity - source.sold_quantity < quantity) throw new Error('源库存不足')
      run('UPDATE inventory SET quantity = quantity - ?, updated_at = datetime("now") WHERE id = ?', [quantity, source.id])
      const target = get('SELECT * FROM inventory WHERE batch_id = ? AND shop_id = ?', [batchId, toShopId])
      if (target) { run('UPDATE inventory SET quantity = quantity + ?, updated_at = datetime("now") WHERE id = ?', [quantity, target.id]) }
      else { run('INSERT INTO inventory (batch_id, shop_id, quantity, activated_quantity, sold_quantity, redeemed_quantity) VALUES (?, ?, ?, 0, 0, 0)', [batchId, toShopId, quantity]) }
      return run('INSERT INTO transfers (date, from_shop_id, to_shop_id, batch_id, lottery_name, quantity, unit_price, reason, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [date, fromShopId, toShopId, batchId, lotteryName, quantity, unitPrice, reason || '', req.user.id]).lastInsertRowid
    })
    res.json({ id })
  } catch (err) { res.status(400).json({ error: err.message }) }
}))

// ===== RECEIPTS =====
const receiptsRouter = Router()
receiptsRouter.get('/', wrap((req, res) => {
  const rows = all(`SELECT br.*, bc.name as card_name FROM bank_receipts br LEFT JOIN bank_cards bc ON br.card_id = bc.id ORDER BY br.date DESC, br.id DESC`)
  res.json(rows.map(r => ({ id: r.id, date: r.date, cardId: r.card_id, cardName: r.card_name, expectedAmount: r.expected_amount, actualAmount: r.actual_amount, source: r.source, status: r.status, description: r.description, difference: r.actual_amount - r.expected_amount })))
}))

receiptsRouter.post('/', wrap((req, res) => {
  const { date, cardId, expectedAmount, actualAmount, source, description } = req.body
  if (!date || !cardId || expectedAmount === undefined || actualAmount === undefined) return res.status(400).json({ error: '请填写完整信息' })
  let status = 'pending'
  if (actualAmount > 0) status = actualAmount === expectedAmount ? 'matched' : 'discrepancy'
  const result = run('INSERT INTO bank_receipts (date, card_id, expected_amount, actual_amount, source, status, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [date, cardId, expectedAmount, actualAmount, source || '', status, description || '', req.user.id])
  res.json({ id: result.lastInsertRowid, date, cardId, expectedAmount, actualAmount, source, status, description })
}))

receiptsRouter.put('/:id/match', requireRole('admin', 'super_admin'), wrap((req, res) => {
  run('UPDATE bank_receipts SET status = "matched" WHERE id = ?', [req.params.id])
  res.json({ success: true })
}))

// ===== SETTLEMENTS =====
const settlementsRouter = Router()
settlementsRouter.get('/', wrap((req, res) => {
  const rows = all(`SELECT ds.*, s.name as shop_name FROM daily_settlements ds LEFT JOIN shops s ON ds.shop_id = s.id ORDER BY ds.settlement_date DESC, ds.id DESC`)
  res.json(rows.map(r => ({ id: r.id, shopId: r.shop_id, shopName: r.shop_name, settlementDate: r.settlement_date, cashSales: r.cash_sales, wechatSales: r.wechat_sales, alipaySales: r.alipay_sales, redemptionSales: r.redemption_sales, totalSales: r.total_sales, totalExpenses: r.total_expenses, netAmount: r.net_amount, inventoryValue: r.inventory_value, scannerBalance: r.scanner_balance, machineBalance: r.machine_balance, status: r.status, notes: r.notes })))
}))

settlementsRouter.post('/calculate', requireRole('admin', 'super_admin'), wrap((req, res) => {
  const { shopId, date } = req.body
  if (!shopId || !date) return res.status(400).json({ error: '请选择店铺和日期' })
  res.json(calcSettlement(shopId, date))
}))

settlementsRouter.post('/', requireRole('admin', 'super_admin'), wrap((req, res) => {
  const { shopId, date, notes } = req.body
  if (!shopId || !date) return res.status(400).json({ error: '请选择店铺和日期' })
  const existing = get('SELECT id FROM daily_settlements WHERE shop_id = ? AND settlement_date = ?', [shopId, date])
  if (existing) return res.status(400).json({ error: '该店铺当日已有结算记录' })
  const data = calcSettlement(shopId, date)
  const result = run(`INSERT INTO daily_settlements (shop_id, settlement_date, cash_sales, wechat_sales, alipay_sales, redemption_sales, total_sales, total_expenses, net_amount, inventory_value, scanner_balance, machine_balance, status, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`, [shopId, date, data.cashSales, data.wechatSales, data.alipaySales, data.redemptionSales, data.totalSales, data.totalExpenses, data.netAmount, data.inventoryValue, data.scannerBalance, data.machineBalance, notes || '', req.user.id])
  res.json({ id: result.lastInsertRowid, ...data, status: 'pending' })
}))

settlementsRouter.put('/:id/confirm', requireRole('admin', 'super_admin'), wrap((req, res) => {
  run('UPDATE daily_settlements SET status = "confirmed", confirmed_by = ?, confirmed_at = datetime("now") WHERE id = ?', [req.user.id, req.params.id])
  res.json({ success: true })
}))

function calcSettlement(shopId, date) {
  const ss = get(`SELECT COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as cash, COALESCE(SUM(CASE WHEN payment_method = 'wechat' THEN total_amount ELSE 0 END), 0) as wechat, COALESCE(SUM(CASE WHEN payment_method = 'alipay' THEN total_amount ELSE 0 END), 0) as alipay, COALESCE(SUM(CASE WHEN payment_method = 'redemption' THEN total_amount ELSE 0 END), 0) as redemption FROM sales WHERE shop_id = ? AND date = ?`, [shopId, date]) || { cash: 0, wechat: 0, alipay: 0, redemption: 0 }
  const totalSales = (ss.cash || 0) + (ss.wechat || 0) + (ss.alipay || 0) + (ss.redemption || 0)
  const exp = get('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE shop_id = ? AND type = "expense" AND date = ?', [shopId, date]) || { total: 0 }
  const inv = get(`SELECT COALESCE(SUM((i.activated_quantity - i.sold_quantity) * lb.unit_price), 0) as value FROM inventory i JOIN lottery_batches lb ON i.batch_id = lb.id WHERE i.shop_id = ?`, [shopId]) || { value: 0 }
  const scannerRow = get(`SELECT e.id, e.initial_balance FROM equipment e JOIN equipment_assignments ea ON e.id = ea.equipment_id AND ea.unassigned_at IS NULL WHERE ea.shop_id = ? AND e.type = 'scanner'`, [shopId])
  let scannerBalance = 0
  if (scannerRow) {
    const ss2 = get(`SELECT COALESCE(SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END), 0) as tp, COALESCE(SUM(CASE WHEN type = 'redemption' THEN amount ELSE 0 END), 0) as tr, COALESCE(SUM(CASE WHEN type = 'activation' THEN amount ELSE 0 END), 0) as ta FROM scanner_records WHERE equipment_id = ?`, [scannerRow.id]) || { tp: 0, tr: 0, ta: 0 }
    scannerBalance = (scannerRow.initial_balance || 0) + (ss2.tp || 0) + (ss2.tr || 0) - (ss2.ta || 0)
  }
  const machineRow = get(`SELECT e.current_balance FROM equipment e JOIN equipment_assignments ea ON e.id = ea.equipment_id AND ea.unassigned_at IS NULL WHERE ea.shop_id = ? AND e.type = 'betting_machine'`, [shopId])
  const machineBalance = machineRow ? (machineRow.current_balance || 0) : 0
  return { shopId, settlementDate: date, cashSales: ss.cash || 0, wechatSales: ss.wechat || 0, alipaySales: ss.alipay || 0, redemptionSales: ss.redemption || 0, totalSales, totalExpenses: exp.total || 0, netAmount: totalSales - (exp.total || 0), inventoryValue: inv.value || 0, scannerBalance, machineBalance }
}

// ===== CLOSURES =====
const closuresRouter = Router()
closuresRouter.get('/', wrap((req, res) => {
  const rows = all(`SELECT cs.*, s.name as shop_name FROM closure_settlements cs LEFT JOIN shops s ON cs.shop_id = s.id ORDER BY cs.created_at DESC`)
  res.json(rows.map(r => ({ id: r.id, shopId: r.shop_id, shopName: r.shop_name, closureDate: r.closure_date, remainingInventoryValue: r.remaining_inventory_value, scannerReturned: r.scanner_returned, scannerId: r.scanner_id, machineReturned: r.machine_returned, machineId: r.machine_id, totalSales: r.total_sales, totalExpenses: r.total_expenses, netFinancial: r.net_financial, finalBalance: r.final_balance, status: r.status, notes: r.notes })))
}))

closuresRouter.post('/calculate', requireRole('super_admin'), wrap((req, res) => {
  const { shopId } = req.body
  if (!shopId) return res.status(400).json({ error: '请选择店铺' })
  res.json(calcClosure(shopId))
}))

closuresRouter.post('/', requireRole('super_admin'), wrap((req, res) => {
  const { shopId, notes } = req.body
  if (!shopId) return res.status(400).json({ error: '请选择店铺' })
  const existing = get('SELECT id FROM closure_settlements WHERE shop_id = ?', [shopId])
  if (existing) return res.status(400).json({ error: '该店铺已有撤店结算记录' })
  const data = calcClosure(shopId)
  const result = run(`INSERT INTO closure_settlements (shop_id, closure_date, remaining_inventory_value, scanner_returned, scanner_id, machine_returned, machine_id, total_sales, total_expenses, net_financial, final_balance, status, notes, created_by) VALUES (date('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`, [shopId, data.remainingInventoryValue, data.scannerReturned ? 1 : 0, data.scannerId, data.machineReturned ? 1 : 0, data.machineId, data.totalSales, data.totalExpenses, data.netFinancial, data.finalBalance, notes || '', req.user.id])
  res.json({ id: result.lastInsertRowid, ...data, status: 'pending' })
}))

closuresRouter.put('/:id/confirm', requireRole('super_admin'), wrap((req, res) => {
  try {
    transaction(() => {
      const closure = get('SELECT * FROM closure_settlements WHERE id = ?', [req.params.id])
      if (!closure) throw new Error('撤店记录不存在')
      if (closure.status === 'confirmed') throw new Error('已确认的撤店不可重复操作')
      run('UPDATE shops SET status = "closed", updated_at = datetime("now") WHERE id = ?', [closure.shop_id])
      const warehouse = get("SELECT id FROM shops WHERE is_warehouse = 1")
      const shopInventory = all('SELECT * FROM inventory WHERE shop_id = ?', [closure.shop_id])
      for (const item of shopInventory) {
        const whInventory = get('SELECT * FROM inventory WHERE batch_id = ? AND shop_id = ?', [item.batch_id, warehouse.id])
        if (whInventory) { run('UPDATE inventory SET quantity = quantity + ?, updated_at = datetime("now") WHERE id = ?', [item.quantity, whInventory.id]) }
        else { run('INSERT INTO inventory (batch_id, shop_id, quantity, activated_quantity, sold_quantity, redeemed_quantity) VALUES (?, ?, ?, ?, ?, ?)', [item.batch_id, warehouse.id, item.quantity, item.activated_quantity, item.sold_quantity, item.redeemed_quantity]) }
      }
      run('DELETE FROM inventory WHERE shop_id = ?', [closure.shop_id])
      run('UPDATE equipment_assignments SET unassigned_at = datetime("now"), unassigned_by = ? WHERE shop_id = ? AND unassigned_at IS NULL', [req.user.id, closure.shop_id])
      const equipIds = all('SELECT equipment_id FROM equipment_assignments WHERE shop_id = ? AND unassigned_at IS NOT NULL', [closure.shop_id])
      for (const e of equipIds) { run('UPDATE equipment SET status = "available", updated_at = datetime("now") WHERE id = ?', [e.equipment_id]) }
      run('UPDATE closure_settlements SET status = "confirmed", confirmed_by = ?, confirmed_at = datetime("now") WHERE id = ?', [req.user.id, req.params.id])
    })
    res.json({ success: true })
  } catch (err) { res.status(400).json({ error: err.message }) }
}))

function calcClosure(shopId) {
  const inv = get('SELECT COALESCE(SUM(i.quantity * lb.unit_price), 0) as value FROM inventory i JOIN lottery_batches lb ON i.batch_id = lb.id WHERE i.shop_id = ?', [shopId]) || { value: 0 }
  const scanner = get(`SELECT e.id FROM equipment e JOIN equipment_assignments ea ON e.id = ea.equipment_id AND ea.unassigned_at IS NULL WHERE ea.shop_id = ? AND e.type = 'scanner'`, [shopId])
  const machine = get(`SELECT e.id FROM equipment e JOIN equipment_assignments ea ON e.id = ea.equipment_id AND ea.unassigned_at IS NULL WHERE ea.shop_id = ? AND e.type = 'betting_machine'`, [shopId])
  const sales = get('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE shop_id = ?', [shopId]) || { total: 0 }
  const expenses = get('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE shop_id = ? AND type = "expense"', [shopId]) || { total: 0 }
  const bank = get('SELECT COALESCE(SUM(balance), 0) as total FROM bank_cards WHERE shop_id = ? AND is_active = 1', [shopId]) || { total: 0 }
  return { shopId, remainingInventoryValue: inv.value || 0, scannerReturned: !!scanner, scannerId: scanner?.id || null, machineReturned: !!machine, machineId: machine?.id || null, totalSales: sales.total || 0, totalExpenses: expenses.total || 0, netFinancial: (sales.total || 0) - (expenses.total || 0), finalBalance: bank.total || 0 }
}

// ===== DASHBOARD =====
const dashboardRouter = Router()
dashboardRouter.get('/summary', wrap((req, res) => {
  const today = new Date().toISOString().split('T')[0]
  const isSuperAdmin = req.user.role === 'super_admin'
  const shopFilter = isSuperAdmin ? '' : ' AND (shop_id = ? OR shop_id IS NULL)'
  const shopFilter2 = isSuperAdmin ? '' : ' AND shop_id = ?'
  const shopParam = isSuperAdmin ? [] : [req.user.shopId]

  const totalBalance = (get(`SELECT COALESCE(SUM(balance), 0) as t FROM bank_cards WHERE is_active = 1${shopFilter}`, shopParam) || {}).t || 0
  const personalBalance = (get(`SELECT COALESCE(SUM(balance), 0) as t FROM bank_cards WHERE is_active = 1 AND type = 'personal'${shopFilter}`, shopParam) || {}).t || 0
  const corporateBalance = (get(`SELECT COALESCE(SUM(balance), 0) as t FROM bank_cards WHERE is_active = 1 AND type = 'corporate'${shopFilter}`, shopParam) || {}).t || 0

  const txStats = get(`SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income, COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense FROM transactions WHERE date = ?${shopFilter}`, [today, ...shopParam]) || { income: 0, expense: 0 }
  const todaySales = (get(`SELECT COALESCE(SUM(total_amount), 0) as t FROM sales WHERE date = ?${shopFilter2}`, [today, ...shopParam]) || {}).t || 0

  const invFilter = isSuperAdmin ? '' : ' AND i.shop_id = ?'
  const inventoryValue = (get(`SELECT COALESCE(SUM((i.activated_quantity - i.sold_quantity) * lb.unit_price), 0) as v FROM inventory i JOIN lottery_batches lb ON i.batch_id = lb.id WHERE i.shop_id != (SELECT id FROM shops WHERE is_warehouse = 1)${invFilter}`, shopParam) || {}).v || 0

  const receiptStats = get(`SELECT COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending, COALESCE(SUM(CASE WHEN status = 'discrepancy' THEN 1 ELSE 0 END), 0) as disc FROM bank_receipts`) || { pending: 0, disc: 0 }

  res.json({ totalBalance, personalBalance, corporateBalance, todayIncome: txStats.income || 0, todayExpense: txStats.expense || 0, todaySales, inventoryValue, pendingReceipts: receiptStats.pending || 0, discrepancyReceipts: receiptStats.disc || 0 })
}))

dashboardRouter.get('/recent-transactions', wrap((req, res) => {
  const isSuperAdmin = req.user.role === 'super_admin'
  const sql = isSuperAdmin
    ? `SELECT t.*, bc.name as card_name, s.name as shop_name FROM transactions t LEFT JOIN bank_cards bc ON t.card_id = bc.id LEFT JOIN shops s ON t.shop_id = s.id ORDER BY t.date DESC, t.id DESC LIMIT 10`
    : `SELECT t.*, bc.name as card_name, s.name as shop_name FROM transactions t LEFT JOIN bank_cards bc ON t.card_id = bc.id LEFT JOIN shops s ON t.shop_id = s.id WHERE (t.shop_id = ? OR t.shop_id IS NULL) ORDER BY t.date DESC, t.id DESC LIMIT 10`
  const params = isSuperAdmin ? [] : [req.user.shopId]
  res.json(all(sql, params).map(r => ({ id: r.id, cardId: r.card_id, cardName: r.card_name, type: r.type, category: r.category, amount: r.amount, date: r.date, description: r.description, shopId: r.shop_id, shopName: r.shop_name })))
}))

dashboardRouter.get('/scanner-balances', wrap((req, res) => {
  const isSuperAdmin = req.user.role === 'super_admin'
  const sql = isSuperAdmin
    ? `SELECT e.id, e.name, e.initial_balance, s.name as shop_name, COALESCE(SUM(CASE WHEN sr.type = 'payment' THEN sr.amount ELSE 0 END), 0) as tp, COALESCE(SUM(CASE WHEN sr.type = 'redemption' THEN sr.amount ELSE 0 END), 0) as tr, COALESCE(SUM(CASE WHEN sr.type = 'activation' THEN sr.amount ELSE 0 END), 0) as ta FROM equipment e JOIN equipment_assignments ea ON e.id = ea.equipment_id AND ea.unassigned_at IS NULL JOIN shops s ON ea.shop_id = s.id LEFT JOIN scanner_records sr ON e.id = sr.equipment_id WHERE e.type = 'scanner' GROUP BY e.id ORDER BY e.name`
    : `SELECT e.id, e.name, e.initial_balance, s.name as shop_name, COALESCE(SUM(CASE WHEN sr.type = 'payment' THEN sr.amount ELSE 0 END), 0) as tp, COALESCE(SUM(CASE WHEN sr.type = 'redemption' THEN sr.amount ELSE 0 END), 0) as tr, COALESCE(SUM(CASE WHEN sr.type = 'activation' THEN sr.amount ELSE 0 END), 0) as ta FROM equipment e JOIN equipment_assignments ea ON e.id = ea.equipment_id AND ea.unassigned_at IS NULL JOIN shops s ON ea.shop_id = s.id LEFT JOIN scanner_records sr ON e.id = sr.equipment_id WHERE e.type = 'scanner' AND ea.shop_id = ? GROUP BY e.id ORDER BY e.name`
  const params = isSuperAdmin ? [] : [req.user.shopId]
  res.json(all(sql, params).map(r => ({ id: r.id, name: r.name, shopName: r.shop_name, initialBalance: r.initial_balance, totalPayment: r.tp, totalRedemption: r.tr, totalActivation: r.ta, balance: (r.initial_balance || 0) + (r.tp || 0) + (r.tr || 0) - (r.ta || 0) })))
}))

dashboardRouter.get('/inventory-overview', wrap((req, res) => {
  const isSuperAdmin = req.user.role === 'super_admin'
  const sql = isSuperAdmin
    ? `SELECT i.*, lb.batch_number, lt.name as lottery_name, lb.unit_price, s.name as shop_name FROM inventory i JOIN lottery_batches lb ON i.batch_id = lb.id JOIN lottery_types lt ON lb.lottery_type_id = lt.id JOIN shops s ON i.shop_id = s.id WHERE s.is_warehouse = 0 ORDER BY lt.name LIMIT 20`
    : `SELECT i.*, lb.batch_number, lt.name as lottery_name, lb.unit_price, s.name as shop_name FROM inventory i JOIN lottery_batches lb ON i.batch_id = lb.id JOIN lottery_types lt ON lb.lottery_type_id = lt.id JOIN shops s ON i.shop_id = s.id WHERE s.is_warehouse = 0 AND i.shop_id = ? ORDER BY lt.name LIMIT 20`
  const params = isSuperAdmin ? [] : [req.user.shopId]
  res.json(all(sql, params).map(r => ({ id: r.id, lotteryName: r.lottery_name, batchNumber: r.batch_number, shopName: r.shop_name, unitPrice: r.unit_price, activatedQuantity: r.activated_quantity, soldQuantity: r.sold_quantity, unsoldQuantity: r.activated_quantity - r.sold_quantity, unsoldValue: (r.activated_quantity - r.sold_quantity) * r.unit_price })))
}))

// ===== STAFF SUBMISSIONS =====
const submissionsRouter = Router()

submissionsRouter.get('/', wrap((req, res) => {
  let sql = `SELECT ss.*, s.name as shop_name, u.display_name as staff_name, bc.name as personal_card_name, vu.display_name as verifier_name
    FROM staff_submissions ss
    LEFT JOIN shops s ON ss.shop_id = s.id
    LEFT JOIN users u ON ss.staff_id = u.id
    LEFT JOIN bank_cards bc ON ss.personal_card_id = bc.id
    LEFT JOIN users vu ON ss.verified_by = vu.id
    WHERE 1=1`
  const params = []
  if (req.user.role === 'staff') {
    sql += ' AND ss.staff_id = ?'
    params.push(req.user.id)
  } else if (req.query.shopId) {
    sql += ' AND ss.shop_id = ?'
    params.push(req.query.shopId)
  }
  if (req.query.status) { sql += ' AND ss.status = ?'; params.push(req.query.status) }
  if (req.query.dateFrom) { sql += ' AND ss.submission_date >= ?'; params.push(req.query.dateFrom) }
  if (req.query.dateTo) { sql += ' AND ss.submission_date <= ?'; params.push(req.query.dateTo) }
  sql += ' ORDER BY ss.submission_date DESC, ss.id DESC'
  const rows = all(sql, params)
  res.json(rows.map(r => ({
    id: r.id, shopId: r.shop_id, shopName: r.shop_name, staffId: r.staff_id, staffName: r.staff_name,
    submissionDate: r.submission_date, cashAmount: r.cash_amount, wechatAmount: r.wechat_amount,
    alipayAmount: r.alipay_amount, redemptionAmount: r.redemption_amount,
    personalCardId: r.personal_card_id, personalCardName: r.personal_card_name,
    notes: r.notes, status: r.status, verifiedBy: r.verified_by, verifierName: r.verifier_name,
    verifiedAt: r.verified_at, verificationNotes: r.verification_notes,
    totalAmount: (r.cash_amount || 0) + (r.wechat_amount || 0) + (r.alipay_amount || 0) + (r.redemption_amount || 0)
  })))
}))

submissionsRouter.get('/:id', wrap((req, res) => {
  const row = get(`SELECT ss.*, s.name as shop_name, u.display_name as staff_name, bc.name as personal_card_name, vu.display_name as verifier_name
    FROM staff_submissions ss
    LEFT JOIN shops s ON ss.shop_id = s.id
    LEFT JOIN users u ON ss.staff_id = u.id
    LEFT JOIN bank_cards bc ON ss.personal_card_id = bc.id
    LEFT JOIN users vu ON ss.verified_by = vu.id
    WHERE ss.id = ?`, [req.params.id])
  if (!row) return res.status(404).json({ error: '交账记录不存在' })
  if (req.user.role === 'staff' && row.staff_id !== req.user.id) return res.status(403).json({ error: '无权查看' })
  const attachments = all('SELECT id, file_path, file_name FROM submission_attachments WHERE submission_id = ?', [req.params.id])
  res.json({
    id: row.id, shopId: row.shop_id, shopName: row.shop_name, staffId: row.staff_id, staffName: row.staff_name,
    submissionDate: row.submission_date, cashAmount: row.cash_amount, wechatAmount: row.wechat_amount,
    alipayAmount: row.alipay_amount, redemptionAmount: row.redemption_amount,
    personalCardId: row.personal_card_id, personalCardName: row.personal_card_name,
    notes: row.notes, status: row.status, verifiedBy: row.verified_by, verifierName: row.verifier_name,
    verifiedAt: row.verified_at, verificationNotes: row.verification_notes,
    totalAmount: (row.cash_amount || 0) + (row.wechat_amount || 0) + (row.alipay_amount || 0) + (row.redemption_amount || 0),
    attachments: attachments.map(a => ({ id: a.id, filePath: a.file_path, fileName: a.file_name }))
  })
}))

submissionsRouter.post('/', wrap((req, res) => {
  const { shopId, submissionDate, cashAmount, wechatAmount, alipayAmount, redemptionAmount, personalCardId, notes } = req.body
  if (!submissionDate) return res.status(400).json({ error: '交账日期必填' })
  const effectiveShopId = req.user.role === 'super_admin' ? (shopId || null) : (req.user.shopId || shopId)
  if (!effectiveShopId) return res.status(400).json({ error: '请选择店铺' })
  const result = run(`INSERT INTO staff_submissions
    (shop_id, staff_id, submission_date, cash_amount, wechat_amount, alipay_amount, redemption_amount, personal_card_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [effectiveShopId, req.user.id, submissionDate, cashAmount || 0, wechatAmount || 0, alipayAmount || 0, redemptionAmount || 0, personalCardId || null, notes || ''])
  res.json({ id: result.lastInsertRowid, shopId: effectiveShopId, staffId: req.user.id, submissionDate, status: 'pending' })
}))

submissionsRouter.put('/:id/verify', requireRole('finance', 'admin', 'super_admin'), wrap((req, res) => {
  const { status, verificationNotes } = req.body
  if (!status || !['verified', 'discrepancy'].includes(status)) return res.status(400).json({ error: '核对状态必填' })
  run('UPDATE staff_submissions SET status = ?, verified_by = ?, verified_at = datetime("now"), verification_notes = ? WHERE id = ?',
    [status, req.user.id, verificationNotes || '', req.params.id])
  res.json({ success: true })
}))

submissionsRouter.delete('/:id', requireRole('super_admin'), wrap((req, res) => {
  run('DELETE FROM staff_submissions WHERE id = ?', [req.params.id])
  res.json({ success: true })
}))

submissionsRouter.post('/:id/attachments', upload.array('files', 10), wrap((req, res) => {
  const submission = get('SELECT * FROM staff_submissions WHERE id = ?', [req.params.id])
  if (!submission) return res.status(404).json({ error: '交账记录不存在' })
  if (req.user.role === 'staff' && submission.staff_id !== req.user.id) return res.status(403).json({ error: '无权操作' })
  const files = req.files
  if (!files || files.length === 0) return res.status(400).json({ error: '请上传文件' })
  const results = []
  for (const file of files) {
    const relPath = '/uploads/' + file.filename
    const result = run('INSERT INTO submission_attachments (submission_id, file_path, file_name) VALUES (?, ?, ?)', [req.params.id, relPath, file.originalname])
    results.push({ id: result.lastInsertRowid, filePath: relPath, fileName: file.originalname })
  }
  res.json({ success: true, attachments: results })
}))

submissionsRouter.get('/:id/attachments', wrap((req, res) => {
  const rows = all('SELECT id, file_path, file_name FROM submission_attachments WHERE submission_id = ?', [req.params.id])
  res.json(rows.map(r => ({ id: r.id, filePath: r.file_path, fileName: r.file_name })))
}))

export { shopsRouter, usersRouter, bankCardsRouter, transactionsRouter, equipmentRouter, scannerRecordsRouter, bettingMachineRouter, inventoryRouter, salesRouter, transfersRouter, receiptsRouter, settlementsRouter, closuresRouter, dashboardRouter, submissionsRouter }
