const { verifyToken } = require('../utils/jwt')
const { query } = require('../config/db')

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Нэвтрэх шаардлагатай' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = verifyToken(token)

    const result = await query(
      `SELECT user_id, first_name, last_name, email, phone, user_type, status
       FROM users WHERE user_id = $1`,
      [decoded.user_id]
    )
    const user = result.rows[0]
    if (!user) {
      return res.status(401).json({ message: 'Хэрэглэгч олдсонгүй' })
    }
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ message: 'Бүртгэл түр хаагдсан байна' })
    }

    req.user = user
    next()
  } catch (err) {
    return res.status(401).json({ message: 'Token хүчингүй байна' })
  }
}

module.exports = authMiddleware