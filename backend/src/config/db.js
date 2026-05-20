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
pool.connect().then(() => {
  console.log('PostgreSQL-тэй холбогдлоо')
}).catch((err) => {
  console.error('PostgreSQL-тэй холбогдоход алдаа гарлаа:', err)
})
module.exports = { query, pool }