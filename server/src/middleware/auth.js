import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'lottery-accounting-jwt-secret-2025'
const ACCESS_EXPIRES = '2h'
const REFRESH_EXPIRES = '7d'

export function generateAccessToken(user) {
  return jwt.sign({ userId: user.id, role: user.role, shopId: user.shop_id }, JWT_SECRET, { expiresIn: ACCESS_EXPIRES })
}

export function generateRefreshToken(user) {
  return jwt.sign({ userId: user.id, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_EXPIRES })
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.access_token

  if (!token) {
    return res.status(401).json({ error: '未登录' })
  }

  const decoded = verifyToken(token)
  if (!decoded) {
    return res.status(401).json({ error: '登录已过期' })
  }

  req.user = { id: decoded.userId, role: decoded.role, shopId: decoded.shopId }
  next()
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: '未登录' })
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: '权限不足' })
    next()
  }
}

export function shopAccess(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '未登录' })

  if (req.user.role === 'super_admin' || req.user.role === 'finance') {
    // super_admin and finance can access all shops
    return next()
  }

  // admin/staff can only access their own shop
  const requestedShopId = req.query.shopId || req.body.shopId || req.params.shopId
  if (requestedShopId && Number(requestedShopId) !== req.user.shopId) {
    return res.status(403).json({ error: '无权访问该店铺数据' })
  }

  // Auto-fill shopId for staff/admin
  if (!requestedShopId && req.user.shopId) {
    req.query.shopId = String(req.user.shopId)
    if (req.body && typeof req.body === 'object') {
      req.body.shopId = req.user.shopId
    }
  }

  next()
}
