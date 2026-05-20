require('dotenv').config()
const express = require('express')
const cors    = require('cors')
const helmet  = require('helmet')
const path    = require('path')
const { pool }        = require('./config/db')
const { apiLimiter }  = require('./middlewares/rateLimit.middleware')

// ── Routes ────────────────────────────────────────────
const authRoutes     = require('./routes/auth.routes')
const userRoutes     = require('./routes/user.routes')
const adminRoutes    = require('./routes/admin.routes')
const contractRoutes = require('./routes/contract.routes')
const publicRoutes   = require('./routes/public.routes')
const app  = express()
const PORT = process.env.PORT || 5000

// ── Security middleware ────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }))
app.use(express.json({ limit: '10mb' }))
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods:     ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
}))

// ── Rate limit ─────────────────────────────────────────
app.use('/api', apiLimiter)

// ── Static files ───────────────────────────────────────
// Хэрэглэгч профайл зураг харах боломжтой
app.use('/uploads/profiles',  express.static(path.join(__dirname, '..', 'uploads', 'profiles')))
// Template файл нуугдсан — admin route-аар л татах боломжтой
// app.use('/uploads/templates', ...) → intentionally NOT served

// ── API Routes ─────────────────────────────────────────
app.use('/api/public',    publicRoutes)
app.use('/api/auth',      authRoutes)
app.use('/api/users',     userRoutes)
app.use('/api/admin',     adminRoutes)
app.use('/api/contracts', contractRoutes)

// ── Health check ───────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() })
  } catch {
    res.status(500).json({ status: 'error', db: 'disconnected' })
  }
})

// ── 404 ────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: 'Хуудас олдсонгүй' }))

// ── Error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Алдаа:', err.message)
  res.status(500).json({ message: 'Серверт алдаа гарлаа' })
})

// ── Start ──────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`✓ Server: http://localhost:${PORT}`)
  try {
    await pool.query('SELECT 1')
    console.log('✓ PostgreSQL холбогдлоо')
  } catch (err) {
    console.error('✗ PostgreSQL холбогдсонгүй:', err.message)
  }
})

module.exports = app