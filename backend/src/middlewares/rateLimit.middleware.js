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

// Нэвтрэх — 15 минутад 10 удаа
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
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

module.exports = { registerLimiter, otpVerifyLimiter, resendLimiter, loginLimiter, apiLimiter }
