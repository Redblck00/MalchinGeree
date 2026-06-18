const bcrypt    = require('bcryptjs')
const repo      = require('../repositories/auth.repository')
const { signToken }                                   = require('../utils/jwt')
const { generateOtp, saveOtp, verifyOtp,
        findPendingByPhone }                          = require('../utils/otp')
const { sendOtpEmail }                                = require('../utils/email')
const { log, LOG }                                    = require('../utils/logger')
const { safeErrorMessage }                            = require('../utils/errors')

//  POST /api/auth/register
const register = async (req, res) => {
  try {
    const { first_name, last_name, phone, email, password } = req.body
    if (!first_name || !last_name || !phone || !email || !password) {
      return res.status(400).json({ message: 'Бүх талбарыг бөглөнө үү' })
    }

    if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
      return res.status(400).json({ message: 'Нууц үг 6-72 тэмдэгттэй байх ёстой' })
    }

    const existing = await repo.findUserByEmailOrPhone(email.toLowerCase(), phone)
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Энэ имейл эсвэл утас аль хэдийн бүртгэлтэй' })
    }

    const password_hash = await bcrypt.hash(password, 12)


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
    res.status(400).json({ message: safeErrorMessage(err) })
  }
}

// ── POST /api/auth/verify-otp
const verifyOtpHandler = async (req, res) => {
  try {
    const { phone, code } = req.body
    if (!phone || !code) {
      return res.status(400).json({ message: 'Утас болон OTP код шаардлагатай' })
    }
    const existingUser = await repo.findUserByPhoneForOtp(phone)
    if (existingUser?.status === 'ACTIVE') {
      return res.status(400).json({ message: 'Бүртгэл аль хэдийн баталгаажсан байна' })
    }

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

    const user = await repo.insertUser({
      firstName:    first_name,
      lastName:     last_name,
      phone,
      email,
      passwordHash: password_hash,
    })

    // ── Урилгатай гэрээний оролцогчдыг шинэ user-тай холбох ──
    // Шинэ хэрэглэгчийн email-тэй давхцаж буй pending invitations-ыг
    // contract_participants-д шинэ user_id-аар update хийнэ.
    const linkedCount = await repo.linkPendingInvitations(user.user_id, user.email)

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
    res.status(400).json({ message: safeErrorMessage(err) })
  }
}

// ── POST /api/auth/login ──────────────────────────────
const login = async (req, res) => {
  try {
    const { phone, password } = req.body
    if (!phone || !password) {
      return res.status(400).json({ message: 'Утас болон нууц үг шаардлагатай' })
    }
    // DoS-аас сэргийлэх — bcrypt.compare-д урт нууц үг өгөхгүй
    if (typeof password !== 'string' || password.length > 72) {
      return res.status(400).json({ message: 'Утас эсвэл нууц үг буруу' })
    }

    const user = await repo.findUserForLogin(phone)
    if (!user) return res.status(400).json({ message: 'Утас эсвэл нууц үг буруу' })

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) return res.status(400).json({ message: 'Утас эсвэл нууц үг буруу' })

    if (user.status === 'PENDING')   return res.status(400).json({ message: 'Имейлээ баталгаажуулна уу' })
    if (user.status === 'SUSPENDED') return res.status(403).json({ message: 'Бүртгэл түр хаагдсан' })
    if (user.status === 'DELETED')   return res.status(403).json({ message: 'Бүртгэл устгагдсан' })

    await repo.markLastLogin(user.user_id)

    // ── Урилгатай гэрээний оролцогчдыг user-тай холбох (хэрэв бүртгэл хийсний дараа урилга ирсэн бол)
    if (user.email) {
      await repo.linkInvitationsOnLogin(user.user_id, user.email)
    }

    const token = signToken({ user_id: user.user_id, user_type: user.user_type })
    const { password_hash, ...safeUser } = user

    await log({ user_id: user.user_id, action: LOG.LOGIN, req })
    res.json({ message: 'Амжилттай нэвтэрлээ', token, user: safeUser })
  } catch (err) {
    console.error(err)
    res.status(400).json({ message: safeErrorMessage(err) })
  }
}

// ── POST /api/auth/resend-otp ─────────────────────────
const resendOtp = async (req, res) => {
  try {
    const { phone } = req.body
    if (!phone) return res.status(400).json({ message: 'Утасны дугаар шаардлагатай' })

    // users-д аль хэдийн бүртгэлтэй бол
    const existingUser = await repo.findUserStatusByPhone(phone)
    if (existingUser?.status === 'ACTIVE') {
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
    res.status(400).json({ message: safeErrorMessage(err) })
  }
}

module.exports = { register, verifyOtp: verifyOtpHandler, login, resendOtp }
