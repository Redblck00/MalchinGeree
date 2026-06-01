// ══════════════════════════════════════════════════════
// auth.repository.js — Бүртгэл/нэвтрэлтийн өгөгдлийн давхарга
// Зөвхөн SQL агуулна. Bcrypt, JWT, OTP, email илгээх — бүгд controller-т.
// Функц бүр сонголттой `exec` параметр авна (default = pool).
// ══════════════════════════════════════════════════════

const { query } = require('../config/db')

const pool = { query: (text, params) => query(text, params) }

// ── Register ──────────────────────────────────────────

// Бүртгэлийн давхардал шалгахад зориулсан — email/phone-аас аль нэгээр нь
// users-д бүртгэлтэй эсэхийг олно.
const findUserByEmailOrPhone = async (email, phone, exec = pool) => {
  const r = await exec.query(
    `SELECT user_id FROM users WHERE email = $1 OR phone = $2`,
    [email, phone]
  )
  return r.rows
}

// ── Verify OTP (Бүртгэл баталгаажуулах) ───────────────

const findUserByPhoneForOtp = async (phone, exec = pool) => {
  const r = await exec.query(
    `SELECT user_id, email, first_name, last_name, phone, user_type, status
     FROM users WHERE phone = $1`,
    [phone]
  )
  return r.rows[0]
}

const insertUser = async (
  { firstName, lastName, phone, email, passwordHash }, exec = pool
) => {
  const r = await exec.query(
    `INSERT INTO users
       (first_name, last_name, phone, email, password_hash, status, email_verified_at)
     VALUES ($1, $2, $3, $4, $5, 'ACTIVE', NOW())
     RETURNING user_id, first_name, last_name, phone, email, user_type, status`,
    [firstName, lastName, phone, email, passwordHash]
  )
  return r.rows[0]
}

// Шинэ хэрэглэгчийн email-тэй давхцаж буй pending invitation-ыг
// шинэ user_id-аар update хийж 'REGISTERED' болгоно.
// rowCount буцаана — хэдэн гэрээний оролцогч болсныг controller-т харуулна.
const linkPendingInvitations = async (userId, email, exec = pool) => {
  const r = await exec.query(
    `UPDATE contract_participants
     SET user_id = $1,
         status  = 'REGISTERED'
     WHERE LOWER(invite_email) = LOWER($2)
       AND user_id IS NULL
     RETURNING participant_id, contract_id`,
    [userId, email]
  )
  return r.rowCount
}

// ── Login ─────────────────────────────────────────────

const findUserForLogin = async (phone, exec = pool) => {
  const r = await exec.query(
    `SELECT user_id, first_name, last_name, email, phone,
            password_hash, user_type, status, address, profile_image_url
     FROM users WHERE phone = $1`,
    [phone]
  )
  return r.rows[0]
}

const markLastLogin = async (userId, exec = pool) => {
  await exec.query(
    `UPDATE users SET last_login_at = NOW() WHERE user_id = $1`,
    [userId]
  )
}

// Login үед invitation холбох — verify-аас ялгаатай нь: PENDING_INVITE/INVITED
// статустай үед л REGISTERED болгоно, бусад статусыг хөндөхгүй (LINK_OPENED,
// VIEWED, SIGNED гэх мэт дунд явцын статусыг буцаахгүй).
const linkInvitationsOnLogin = async (userId, email, exec = pool) => {
  await exec.query(
    `UPDATE contract_participants
     SET user_id = $1,
         status  = CASE WHEN status = 'PENDING_INVITE' OR status = 'INVITED'
                        THEN 'REGISTERED' ELSE status END
     WHERE LOWER(invite_email) = LOWER($2)
       AND user_id IS NULL`,
    [userId, email]
  )
}

// ── Resend OTP ────────────────────────────────────────

const findUserStatusByPhone = async (phone, exec = pool) => {
  const r = await exec.query(
    `SELECT status FROM users WHERE phone = $1`,
    [phone]
  )
  return r.rows[0]
}

module.exports = {
  // register
  findUserByEmailOrPhone,
  // verify OTP
  findUserByPhoneForOtp, insertUser, linkPendingInvitations,
  // login
  findUserForLogin, markLastLogin, linkInvitationsOnLogin,
  // resend OTP
  findUserStatusByPhone,
}
