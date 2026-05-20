const bcrypt    = require('bcryptjs')
const { query } = require('../config/db')
const { signToken }                                   = require('../utils/jwt')
const { generateOtp, saveOtp, verifyOtp,
        findPendingByPhone }                          = require('../utils/otp')
const { sendOtpEmail }                                = require('../utils/email')
const { log, LOG }                                    = require('../utils/logger')

// ── POST /api/auth/register ───────────────────────────
// Хэрэглэгчийг DB-д ОРУУЛАХГҮЙ — OTP баталгаажсан үед л үүснэ
const register = async (req, res) => {
  try {
    const { first_name, last_name, phone, email, password } = req.body
    if (!first_name || !last_name || !phone || !email || !password) {
      return res.status(400).json({ message: 'Бүх талбарыг бөглөнө үү' })
    }

    // users хүснэгтэд аль хэдийн бүртгэлтэй эсэх шалгах
    const existing = await query(
      `SELECT user_id FROM users WHERE email = $1 OR phone = $2`,
      [email.toLowerCase(), phone]
    )
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Энэ имейл эсвэл утас аль хэдийн бүртгэлтэй' })
    }

    const password_hash = await bcrypt.hash(password, 12)

    // Бүртгэлийн мэдээллийг OTP-тэй хамт DB-д хадгалах (users-д оруулахгүй)
    const code = generateOtp()
    await saveOtp(email, code, 'EMAIL', undefined, {
      first_name,
      last_name,
      phone,
      email: email.toLowerCase(),
      password_hash,
    })
    await sendOtpEmail(email, code)

    res.status(201).json({ message: 'OTP имейл рүү илгээгдлээ', phone })
  } catch (err) {
    console.error(err)
    res.status(400).json({ message: err.message })
  }
}

// ── POST /api/auth/verify-otp ─────────────────────────
// OTP зөв бол users хүснэгтэд хэрэглэгч үүсгэнэ
const verifyOtpHandler = async (req, res) => {
  try {
    const { phone, code } = req.body
    if (!phone || !code) {
      return res.status(400).json({ message: 'Утас болон OTP код шаардлагатай' })
    }

    // users-д аль хэдийн бүртгэлтэй бол (login хийх)
    const existingUser = await query(
      `SELECT user_id, email, first_name, last_name, phone, user_type, status
       FROM users WHERE phone = $1`,
      [phone]
    )
    if (existingUser.rows[0]?.status === 'ACTIVE') {
      return res.status(400).json({ message: 'Бүртгэл аль хэдийн баталгаажсан байна' })
    }

    // pending_data-аас phone-ийн email-ийг олох
    const pending = await findPendingByPhone(phone)
    if (!pending) {
      return res.status(400).json({ message: 'OTP код олдсонгүй эсвэл хугацаа дууссан. Дахин бүртгүүлнэ үү' })
    }

    // OTP шалгах
    const result = await verifyOtp(pending.email, code)
    if (!result.valid) {
      const msgs = {
        NOT_FOUND:    'OTP код олдсонгүй. Дахин OTP авна уу',
        EXPIRED:      'OTP кодын хугацаа дууссан. Дахин илгээлгэнэ үү',
        MAX_ATTEMPTS: 'OTP оролдлогын хязгаар хэтэрлээ. Шинэ OTP авна уу',
        WRONG_CODE:   'OTP код буруу байна',
      }
      return res.status(400).json({ message: msgs[result.reason] || 'OTP буруу эсвэл хугацаа дууссан' })
    }

    // OTP зөв — users хүснэгтэд хэрэглэгч үүсгэх
    const { first_name, last_name, email, password_hash } = result.pendingData

    const userRes = await query(
      `INSERT INTO users
         (first_name, last_name, phone, email, password_hash, status, email_verified_at)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE', NOW())
       RETURNING user_id, first_name, last_name, phone, email, user_type, status`,
      [first_name, last_name, phone, email, password_hash]
    )
    const user = userRes.rows[0]

    // ── Урилгатай гэрээний оролцогчдыг шинэ user-тай холбох ──
    // Шинэ хэрэглэгчийн email-тэй давхцаж буй pending invitations-ыг
    // contract_participants-д шинэ user_id-аар update хийнэ.
    const linkRes = await query(
      `UPDATE contract_participants
       SET user_id = $1,
           status  = 'REGISTERED'
       WHERE LOWER(invite_email) = LOWER($2)
         AND user_id IS NULL
       RETURNING participant_id, contract_id`,
      [user.user_id, user.email]
    )
    const linkedCount = linkRes.rowCount

    await log({ action: LOG.REGISTER, entity_type: 'user', entity_id: user.user_id, req })

    const token = signToken({ user_id: user.user_id, user_type: user.user_type })
    res.json({
      message: 'Бүртгэл амжилттай баталгаажлаа',
      token,
      user,
      linked_invitations: linkedCount,  // хэдэн гэрээнд оролцогч болсныг харуулна
    })
  } catch (err) {
    console.error(err)
    res.status(400).json({ message: err.message })
  }
}

// ── POST /api/auth/login ──────────────────────────────
const login = async (req, res) => {
  try {
    const { phone, password } = req.body
    if (!phone || !password) {
      return res.status(400).json({ message: 'Утас болон нууц үг шаардлагатай' })
    }

    const result = await query(
      `SELECT user_id, first_name, last_name, email, phone,
              password_hash, user_type, status, address, profile_image_url
       FROM users WHERE phone = $1`,
      [phone]
    )
    const user = result.rows[0]
    if (!user) return res.status(400).json({ message: 'Утас эсвэл нууц үг буруу' })

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) return res.status(400).json({ message: 'Утас эсвэл нууц үг буруу' })

    if (user.status === 'PENDING')   return res.status(400).json({ message: 'Имейлээ баталгаажуулна уу' })
    if (user.status === 'SUSPENDED') return res.status(403).json({ message: 'Бүртгэл түр хаагдсан' })
    if (user.status === 'DELETED')   return res.status(403).json({ message: 'Бүртгэл устгагдсан' })

    await query(`UPDATE users SET last_login_at = NOW() WHERE user_id = $1`, [user.user_id])

    // ── Урилгатай гэрээний оролцогчдыг user-тай холбох (хэрэв бүртгэл хийсний дараа урилга ирсэн бол) ──
    if (user.email) {
      await query(
        `UPDATE contract_participants
         SET user_id = $1,
             status  = CASE WHEN status = 'PENDING_INVITE' OR status = 'INVITED'
                            THEN 'REGISTERED' ELSE status END
         WHERE LOWER(invite_email) = LOWER($2)
           AND user_id IS NULL`,
        [user.user_id, user.email]
      )
    }

    const token = signToken({ user_id: user.user_id, user_type: user.user_type })
    const { password_hash, ...safeUser } = user

    await log({ user_id: user.user_id, action: LOG.LOGIN, req })
    res.json({ message: 'Амжилттай нэвтэрлээ', token, user: safeUser })
  } catch (err) {
    console.error(err)
    res.status(400).json({ message: err.message })
  }
}

// ── POST /api/auth/resend-otp ─────────────────────────
const resendOtp = async (req, res) => {
  try {
    const { phone } = req.body
    if (!phone) return res.status(400).json({ message: 'Утасны дугаар шаардлагатай' })

    // users-д аль хэдийн бүртгэлтэй бол
    const existingUser = await query(
      `SELECT status FROM users WHERE phone = $1`, [phone]
    )
    if (existingUser.rows[0]?.status === 'ACTIVE') {
      return res.status(400).json({ message: 'Бүртгэл аль хэдийн баталгаажсан байна' })
    }

    // pending_data-аас email болон бүртгэлийн мэдээлэл авах
    const pending = await findPendingByPhone(phone)
    if (!pending) {
      return res.status(400).json({ message: 'Бүртгэлийн мэдээлэл олдсонгүй. Дахин бүртгүүлнэ үү' })
    }

    const code = generateOtp()
    // pending_data-г хадгалж дахин OTP явуулах
    await saveOtp(pending.email, code, 'EMAIL', undefined, pending.pending_data)
    await sendOtpEmail(pending.email, code)

    res.json({ message: 'OTP дахин илгээгдлээ' })
  } catch (err) {
    console.error(err)
    res.status(400).json({ message: err.message })
  }
}

module.exports = { register, verifyOtp: verifyOtpHandler, login, resendOtp }
