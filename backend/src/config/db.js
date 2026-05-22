const { Pool } = require('pg')

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'e_contract',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD ,
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

pool.connect().then(() => {
  console.log('PostgreSQL-тэй холбогдлоо')
}).catch((err) => {
  console.error('PostgreSQL-тэй холбогдоход алдаа гарлаа:', err)
})
module.exports = { query, pool, withTransaction }
