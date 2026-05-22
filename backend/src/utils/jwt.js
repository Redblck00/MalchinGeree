const jwt = require('jsonwebtoken')

// Production-д JWT_SECRET заавал тохируулна. Fallback-аас зайлсхийнэ —
// fallback secret хэрэглэвэл хэн ч хуурамч admin token үүсгэж чадна.
const SECRET = process.env.JWT_SECRET
if (!SECRET || SECRET.length < 32) {
  throw new Error('JWT_SECRET орчны хувьсагч (32+ тэмдэгт) заавал тохируулах ёстой')
}
const EXPIRES = process.env.JWT_EXPIRES_IN || '8h'

// Payload: { user_id, user_type }
const signToken = (payload) =>
  jwt.sign(payload, SECRET, { expiresIn: EXPIRES, algorithm: 'HS256' })

// Алгоритмыг заавал pin хийнэ — алгоритм солих халдлагаас сэргийлнэ
const verifyToken = (token) =>
  jwt.verify(token, SECRET, { algorithms: ['HS256'] })

module.exports = { signToken, verifyToken }
