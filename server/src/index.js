import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { initDb } from './db/index.js'
import { authMiddleware } from './middleware/auth.js'
import authRoutes from './routes/auth.js'
import {
  shopsRouter, usersRouter, bankCardsRouter, transactionsRouter,
  equipmentRouter, scannerRecordsRouter, bettingMachineRouter,
  inventoryRouter, salesRouter, transfersRouter, receiptsRouter,
  settlementsRouter, closuresRouter, dashboardRouter, submissionsRouter
} from './routes/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function start() {
  // Initialize database
  await initDb()
  console.log('数据库初始化完成')

  const app = express()
  const PORT = process.env.PORT || 3001

  app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'], credentials: true }))
  app.use(express.json())
  app.use(cookieParser())

  // Public routes
  app.use('/api/auth', authRoutes)

  // Protected routes
  app.use('/api/shops', authMiddleware, shopsRouter)
  app.use('/api/users', authMiddleware, usersRouter)
  app.use('/api/bank-cards', authMiddleware, bankCardsRouter)
  app.use('/api/transactions', authMiddleware, transactionsRouter)
  app.use('/api/equipment', authMiddleware, equipmentRouter)
  app.use('/api/scanner-records', authMiddleware, scannerRecordsRouter)
  app.use('/api/betting-machine-records', authMiddleware, bettingMachineRouter)
  app.use('/api/inventory', authMiddleware, inventoryRouter)
  app.use('/api/sales', authMiddleware, salesRouter)
  app.use('/api/transfers', authMiddleware, transfersRouter)
  app.use('/api/bank-receipts', authMiddleware, receiptsRouter)
  app.use('/api/settlements', authMiddleware, settlementsRouter)
  app.use('/api/closures', authMiddleware, closuresRouter)
  app.use('/api/dashboard', authMiddleware, dashboardRouter)
  app.use('/api/submissions', authMiddleware, submissionsRouter)

  // Serve uploaded files
  app.use('/uploads', express.static(resolve(__dirname, '../../uploads')))

  // Serve static frontend in production
  const distDir = resolve(__dirname, '../dist')
  if (existsSync(distDir)) {
    app.use(express.static(distDir))
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(resolve(distDir, 'index.html'))
      }
    })
  }

  // Error handler
  app.use((err, req, res, _next) => {
    console.error(err.stack)
    res.status(500).json({ error: '服务器内部错误', detail: err.message })
  })

  app.listen(PORT, () => {
    console.log(`彩票记账通后端服务运行在 http://localhost:${PORT}`)
    console.log(`默认管理员账号: admin / admin123`)
  })
}

start().catch(err => {
  console.error('启动失败:', err)
  process.exit(1)
})
