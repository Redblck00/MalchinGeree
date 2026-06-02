require('dotenv').config()
const express = require('express')
const cors    = require('cors')
const helmet  = require('helmet')
const path    = require('path')
const { pool }        = require('./config/db')
const { apiLimiter }  = require('./middlewares/rateLimit.middleware')
const { trackPublicVisit } = require('./middlewares/visitor.middleware')

// ── Routes ────────────────────────────────────────────
const authRoutes     = require('./routes/auth.routes')
const userRoutes     = require('./routes/user.routes')
const adminRoutes    = require('./routes/admin.routes')
const contractRoutes = require('./routes/contract.routes')
const publicRoutes   = require('./routes/public.routes')
const app  = express()
const PORT = process.env.PORT || 5000

// ── Proxy ард ажиллах үед req.ip болон rate limit ажиллахын тулд ──
// nginx / Cloudflare / Render ард байх үед X-Forwarded-For уншина.
app.set('trust proxy', 1)

// ── Security middleware ────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }))
app.use(express.json({ limit: '10mb' }))
// FRONTEND_URL нь comma-аар тусгаарласан олон origin байж болно
// (production + preview deployment + localhost зэрэг).
// Wildcard `*` дэмжинэ — Vercel preview-ийн hash-тай URL-уудтай тааруулна.
//   Жишээ: https://herds-contract-*-redblck00s-projects.vercel.app
// `*` нь "." -ээс бусад тэмдэгтийг таарна (subdomain leak хориглох).
const allowedOriginPatterns = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))   // trailing "/" арилгана
  .filter(Boolean)
  .map((pat) => {
    if (!pat.includes('*')) return pat        // яг таарах URL
    const regex = new RegExp(
      '^' +
        pat
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // regex meta-char escape
          .replace(/\*/g, '[^.]*') +              // * → "." -ээс бусад
        '$',
    )
    return regex
  })

const isAllowedOrigin = (origin) =>
  allowedOriginPatterns.some((p) =>
    typeof p === 'string' ? p === origin : p.test(origin),
  )

app.use(cors({
  origin: (origin, cb) => {
    // Server-to-server, curl, Postman бүгд origin-гүй
    if (!origin) return cb(null, true)
    if (isAllowedOrigin(origin)) return cb(null, true)
    cb(new Error('CORS блок: ' + origin))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
}))

// ── Rate limit ─────────────────────────────────────────
app.use('/api', apiLimiter)

// ── Static files ───────────────────────────────────────
// Хэрэглэгч профайл зураг харах боломжтой
app.use('/uploads/profiles',  express.static(path.join(__dirname, '..', 'uploads', 'profiles')))
// Template файл нуугдсан — admin route-аар л татах боломжтой
// app.use('/uploads/templates', ...) → intentionally NOT served

// ── API Routes ─────────────────────────────────────────
app.use('/api/public',    trackPublicVisit, publicRoutes)
app.use('/api/auth',      authRoutes)
app.use('/api/users',     userRoutes)
app.use('/api/admin',     adminRoutes)
app.use('/api/contracts', contractRoutes)

// ── Health check ───────────────────────────────────────
// DoS-аас сэргийлэх: rate-limited + cached (5 секунд хүчинтэй).
// DB-д хэрэглэгч бүрт SELECT хийхгүй.
let healthCache = { time: 0, ok: false, err: null }
const HEALTH_TTL_MS = 5000
app.get('/health', apiLimiter, async (req, res) => {
  if (Date.now() - healthCache.time < HEALTH_TTL_MS) {
    if (healthCache.ok) return res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() })
    return res.status(500).json({ status: 'error', db: 'disconnected' })
  }
  try {
    await pool.query('SELECT 1')
    healthCache = { time: Date.now(), ok: true, err: null }
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() })
  } catch (err) {
    healthCache = { time: Date.now(), ok: false, err: err?.message }
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