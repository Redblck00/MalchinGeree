#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────
// Энгийн PostgreSQL migration runner — гадна dependency-гүй.
//
// Хэрэглэх:
//   npm run migrate              # бүх pending migration-ийг ажиллуулна
//   npm run migrate:baseline     # pending бүгдийг "applied" гэж тэмдэглэнэ
//                                  (бодит DB-д өмнө гараар apply хийсэн бол)
//
// Migration файлууд: backend/migrations/*.sql
// Дараалал: filename alphabetical (001_, 002_, ... 010_, 011_, ...).
// Бүх файл байх ёстой 3+ оронтой prefix-тэй (sort-тэй нийцтэй).
//
// Tracking: _migrations(name, applied_at) хүснэгтэд applied файлын нэр хадгална.
// Файл бүр өөрийн BEGIN/COMMIT-ийг хариуцна (transactional DDL хэрэгтэй бол).
// ──────────────────────────────────────────────────────────────
require('dotenv').config()
const fs   = require('fs')
const path = require('path')
const { pool } = require('../src/config/db')

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations')

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function listPending() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  const { rows } = await pool.query('SELECT name FROM _migrations')
  const applied = new Set(rows.map((r) => r.name))
  return { files, pending: files.filter((f) => !applied.has(f)) }
}

async function applyOne(file) {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
  await pool.query(sql)
  await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
}

async function main() {
  const baseline = process.argv.includes('--baseline')

  await ensureTable()
  const { files, pending } = await listPending()

  console.log(`◆ Migration хавтас: ${MIGRATIONS_DIR}`)
  console.log(`◆ Нийт файл: ${files.length}, Pending: ${pending.length}`)

  if (pending.length === 0) {
    console.log('✓ Бүх migration аль хэдийн apply хийгдсэн')
    return
  }

  if (baseline) {
    for (const f of pending) {
      await pool.query(
        'INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING',
        [f],
      )
      console.log(' baseline:', f, '(applied гэж тэмдэглэв, SQL гүйцэтгээгүй)')
    }
    console.log(' Baseline дууссан')
    return
  }

  for (const f of pending) {
    console.log('▸ apply:', f)
    try {
      await applyOne(f)
      console.log('  ✓', f)
    } catch (err) {
      console.error('  ✗', f, '—', err.message)
      throw err
    }
  }
  console.log('✓ Бүх migration амжилттай apply хийгдлээ')
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('✗ Migration алдаа:', err.message)
    pool.end().finally(() => process.exit(1))
  })
