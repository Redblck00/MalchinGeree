const crypto = require('crypto')
const { query } = require('../config/db')

// 6 оронтой OTP үүсгэх
const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString()

const hashCode = (code) =>
  crypto.createHash('sha256').update(code).digest('hex')

// OTP DB-д хадгалах
// pendingData — бүртгэлийн мэдээлэл (optional): { first_name, last_name, phone, email, password_hash }
const saveOtp = async (recipient, code, channel = 'EMAIL', minutes, pendingData = null) => {
  const mins = minutes || parseInt(process.env.OTP_EXPIRES_MIN) || 5
  const expiresAt = new Date(Date.now() + mins * 60 * 1000)

  // Хуучин идэвхтэй OTP-г хаах
  await query(
    `UPDATE otps SET is_used = true WHERE recipient = $1 AND is_used = false`,
    [recipient.toLowerCase()]
  )

  await query(
    `INSERT INTO otps (recipient, channel, code_hash, expires_at, pending_data)
     VALUES ($1, $2, $3, $4, $5)`,
    [recipient.toLowerCase(), channel, hashCode(code), expiresAt, pendingData ? JSON.stringify(pendingData) : null]
  )
}

// OTP шалгах — { valid: bool, reason: string, pendingData?: object }
const verifyOtp = async (recipient, code) => {
  const recipientLower = recipient.toLowerCase()

  const result = await query(
    `SELECT otp_id, code_hash, expires_at, attempts, pending_data
     FROM otps
     WHERE recipient = $1 AND is_used = false
     ORDER BY created_at DESC
     LIMIT 1`,
    [recipientLower]
  )

  if (!result.rows.length) {
    return { valid: false, reason: 'NOT_FOUND' }
  }

  const otp = result.rows[0]

  if (new Date() > new Date(otp.expires_at)) {
    await query(`UPDATE otps SET is_used = true WHERE otp_id = $1`, [otp.otp_id])
    return { valid: false, reason: 'EXPIRED' }
  }

  if (otp.attempts >= 5) {
    return { valid: false, reason: 'MAX_ATTEMPTS' }
  }

  await query(
    `UPDATE otps SET attempts = attempts + 1 WHERE otp_id = $1`,
    [otp.otp_id]
  )

  if (hashCode(code) !== otp.code_hash) {
    return { valid: false, reason: 'WRONG_CODE' }
  }

  await query(`UPDATE otps SET is_used = true WHERE otp_id = $1`, [otp.otp_id])
  return { valid: true, pendingData: otp.pending_data }
}

// Phone-аар pending OTP хайх (verify болон resend-д ашиглана)
const findPendingByPhone = async (phone) => {
  const result = await query(
    `SELECT recipient AS email, pending_data
     FROM otps
     WHERE pending_data->>'phone' = $1
       AND is_used = false
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [phone]
  )
  return result.rows[0] || null
}

module.exports = { generateOtp, saveOtp, verifyOtp, findPendingByPhone }
