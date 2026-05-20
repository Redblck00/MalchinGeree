const jwt = require('jsonwebtoken')

const SECRET  = process.env.JWT_SECRET     || 'secret_key_change_this'
const EXPIRES = process.env.JWT_EXPIRES_IN || '8h'

// Payload: { user_id, user_type }
const signToken = (payload) =>
  jwt.sign(payload, SECRET, { expiresIn: EXPIRES })

const verifyToken = (token) =>
  jwt.verify(token, SECRET)

module.exports = { signToken, verifyToken }