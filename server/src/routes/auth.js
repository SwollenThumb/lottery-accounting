import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { get, run } from '../db/index.js'
import { generateAccessToken, generateRefreshToken, verifyToken, authMiddleware } from '../middleware/auth.js'

const router = Router()

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: '请输入用户名和密码' })

  const user = get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username])
  if (!user) return res.status(401).json({ error: '用户名或密码错误' })

  const valid = bcrypt.compareSync(password, user.password_hash)
  if (!valid) return res.status(401).json({ error: '用户名或密码错误' })

  const accessToken = generateAccessToken(user)
  const refreshToken = generateRefreshToken(user)

  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role, shopId: user.shop_id }
  })
})

// POST /api/auth/refresh
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body
  if (!refreshToken) return res.status(401).json({ error: '无刷新令牌' })

  const decoded = verifyToken(refreshToken)
  if (!decoded || decoded.type !== 'refresh') return res.status(401).json({ error: '刷新令牌无效' })

  const user = get('SELECT * FROM users WHERE id = ? AND is_active = 1', [decoded.userId])
  if (!user) return res.status(401).json({ error: '用户不存在' })

  const accessToken = generateAccessToken(user)
  res.json({
    accessToken,
    user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role, shopId: user.shop_id }
  })
})

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const user = get('SELECT id, username, display_name, role, shop_id, is_active FROM users WHERE id = ?', [req.user.id])
  if (!user) return res.status(404).json({ error: '用户不存在' })

  res.json({
    id: user.id, username: user.username, displayName: user.display_name,
    role: user.role, shopId: user.shop_id, isActive: user.is_active
  })
})

// PUT /api/auth/password
router.put('/password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body
  if (!oldPassword || !newPassword) return res.status(400).json({ error: '请输入旧密码和新密码' })

  const user = get('SELECT * FROM users WHERE id = ?', [req.user.id])
  if (!bcrypt.compareSync(oldPassword, user.password_hash)) return res.status(400).json({ error: '旧密码错误' })

  const hash = bcrypt.hashSync(newPassword, 10)
  run('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?', [hash, req.user.id])
  res.json({ success: true })
})

export default router
