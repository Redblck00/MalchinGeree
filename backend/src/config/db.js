const { Pool } = require('pg')

// DATABASE_URL байвал тэрнийг (Render/Neon/Supabase/Railway),
// үгүй бол DB_HOST/PORT/USER/PASSWORD/NAME fallback (local dev).
//
// SSL: cloud PG ихэнхдээ SSL шаарддаг; local postgres ихэнхдээ SSL-гүй.
//   PGSSL=require  → заавал SSL
//   PGSSL=disable  → SSL хэрэглэхгүй
//   default        → host нь localhost/127.0.0.1 бол off, бусад тохиолдолд on
const isLocalHost = (host) =>
  !host || host === 'localhost' || host === '127.0.0.1' || host === '::1'

const hostFromDatabaseUrl = (url) => {
  if (!url) return null
  try {
    return new URL(url.replace(/^postgres(ql)?:\/\//, 'http://')).hostname
  } catch {
    return null
  }
}

const resolveUseSsl = () => {
  if (process.env.PGSSL === 'disable') return false
  if (process.env.PGSSL === 'require') return true

  const urlHost = hostFromDatabaseUrl(process.env.DATABASE_URL)
  if (urlHost) return !isLocalHost(urlHost)

  const host = process.env.DB_HOST || 'localhost'
  if (isLocalHost(host)) return false

  return process.env.NODE_ENV === 'production'
}

const useSsl = resolveUseSsl()
const sslOption = useSsl ? { rejectUnauthorized: false } : false

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslOption,
    })
  : new Pool({
      host:     process.env.DB_HOST     || 'localhost',
      port:     process.env.DB_PORT     || 5432,
      database: process.env.DB_NAME     || 'e_contract',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: sslOption,
    })

// SQL query ажиллуулах тусламж функц
// Жишээ: db.query('SELECT * FROM users WHERE id = $1', [id])
const query = (text, params) => pool.query(text, params)

// ── Транзакцийн helper ────────────────────────────────────
// Олон INSERT/UPDATE-ийг атомарт хийх. fn(client) дуудагдана, client дотроос
// client.query(...) ашиглана. Алдаа гарвал ROLLBACK хийгдэнэ.
// Жишээ:
//   await withTransaction(async (db) => {
//     await db.query('INSERT ...')
//     await db.query('UPDATE ...')
//   })
const withTransaction = async (fn) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    try { await client.query('ROLLBACK') } catch (_) { /* rollback алдаа hide */ }
    throw err
  } finally {
    client.release()
  }
}

// Pool-ийн дотоод connection алдааг log-доно (process crash болохоос сэргийлнэ).
pool.on('error', (err) => {
  console.error('PostgreSQL pool алдаа:', err.message)
})

module.exports = { query, pool, withTransaction }
