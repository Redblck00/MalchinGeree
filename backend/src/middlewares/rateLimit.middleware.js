const rateLimit = require('express-rate-limit')
const { ipKeyGenerator } = require('express-rate-limit')

// Бүртгэл — 1 цагт 5 удаа (phone-аар тоолно)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `reg:${req.body?.phone || ipKeyGenerator(req)}`,
  message: { message: 'Хэт олон бүртгэл оролдлоо. 1 цагийн дараа дахин оролдоно уу' },
  standardHeaders: true,
  legacyHeaders: false,
})

// OTP баталгаажуулалт — 15 минутад 10 удаа (phone-аар тоолно)
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `verify:${req.body?.phone || ipKeyGenerator(req)}`,
  message: { message: 'OTP хэт олон удаа оролдлоо. 15 минутын дараа дахин оролдоно уу' },
  standardHeaders: true,
  legacyHeaders: false,
})

// OTP дахин илгээх — 30 минутад 5 удаа (phone-аар тоолно)
const resendLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `resend:${req.body?.phone || ipKeyGenerator(req)}`,
  message: { message: 'OTP дахин илгээх хэт олон оролдлого. 30 минутын дараа дахин оролдоно уу' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Нэвтрэх — 15 минутад 10 удаа.
// Phone + IP-ийн хослолоор тоолно: ингэснээр нэг утас руу олон IP-ээс
// (credential-stuffing botnet) халдлага хийхэд ч хязгаар хүрэх боломжтой.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) =>
    `login:${(req.body?.phone || '').toString().slice(0, 20)}:${ipKeyGenerator(req)}`,
  message: { message: 'Хэт олон удаа оролдлоо. 15 минутын дараа дахин оролдоно уу' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Login-ийн IP-ийн backstop (нэг IP-ээс олон утас руу халдахаас сэргийлэх) —
// 15 минутад 30 удаа.
const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => `login_ip:${ipKeyGenerator(req)}`,
  message: { message: 'Хэт олон удаа оролдлоо. 15 минутын дараа дахин оролдоно уу' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Ерөнхий API — 1 минутад 100 удаа
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { message: 'Хэт олон хүсэлт илгээлээ. Түр хүлээгээд дахин оролдоно уу' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Гарын үсгийн OTP хүсэлт — 15 минутад хэрэглэгчид 5 удаа.
// auth middleware-ийн ДАРАА байрлуулна (req.user.user_id ашиглана).
// req.user байхгүй бол IP-ээр fallback хийнэ.
const signOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) =>
    `sign_otp:${req.user?.user_id || ipKeyGenerator(req)}`,
  message: { message: 'OTP дахин илгээх хязгаар хэтэрлээ. 15 минутын дараа оролдоно уу' },
  standardHeaders: true,
  legacyHeaders: false,
})

module.exports = { registerLimiter, otpVerifyLimiter, resendLimiter, loginLimiter, loginIpLimiter, apiLimiter, signOtpLimiter }
