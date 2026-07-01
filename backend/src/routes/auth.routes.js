const express = require('express')
const router  = express.Router()
const auth    = require('../controllers/auth.controller')
const { registerLimiter, otpVerifyLimiter, resendLimiter, loginLimiter, loginIpLimiter } = require('../middlewares/rateLimit.middleware')

// POST /api/auth/register
// Body: { first_name, last_name, phone, email, password }
// → OTP имейлээр явна, user PENDING статустай үүснэ
router.post('/register',   registerLimiter,   auth.register)

// POST /api/auth/verify-otp
// Body: { phone, code }
// → ACTIVE болно, JWT token буцаана
router.post('/verify-otp', otpVerifyLimiter,  auth.verifyOtp)

// POST /api/auth/login
// Body: { phone, password }
// → JWT token буцаана
router.post('/login',      loginIpLimiter, loginLimiter, auth.login)

// POST /api/auth/resend-otp
// Body: { phone }
router.post('/resend-otp', resendLimiter,     auth.resendOtp)

// POST /api/auth/refresh
// Body: { refresh_token }
// → Хуучин refresh-ийг цуцалж шинэ { token, refresh_token } буцаана (rotation)
router.post('/refresh',    auth.refresh)

// POST /api/auth/logout
// Body: { refresh_token }
// → Тухайн refresh token-ийг цуцална
router.post('/logout',     auth.logout)

module.exports = router