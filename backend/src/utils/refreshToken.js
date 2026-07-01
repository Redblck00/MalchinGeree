// ══════════════════════════════════════════════════════
// refreshToken.js — Opaque refresh token үүсгэх / hash хийх
//
// • generateRefreshToken() → { token, tokenHash, expiresAt }
//     token     — client-д илгээх түүхий утга (96 hex тэмдэгт, таамаглах боломжгүй)
//     tokenHash — DB-д хадгалах SHA-256 (түүхий утгыг DB-д ХЭЗЭЭ Ч хадгалахгүй)
//     expiresAt — REFRESH_TOKEN_TTL_DAYS (default 30 хоног)
// • hashRefreshToken(token) — ирсэн token-ийг DB-тэй тааруулахад hash хийнэ
//
// JWT биш opaque token сонгосон шалтгаан: сервер талаас цуцлах (revoke) боломжтой
// байх ёстой — JWT-г цуцлах боломжгүй, харин энэ hash-ийг DB-ээс устгах/тэмдэглэхэд
// шууд хүчингүй болно.
// ══════════════════════════════════════════════════════

const crypto = require('crypto')

const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30

const hashRefreshToken = (token) =>
  crypto.createHash('sha256').update(String(token)).digest('hex')

const generateRefreshToken = () => {
  const token     = crypto.randomBytes(48).toString('hex')  // 96 hex тэмдэгт
  const tokenHash = hashRefreshToken(token)
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000)
  return { token, tokenHash, expiresAt }
}

module.exports = { generateRefreshToken, hashRefreshToken, REFRESH_TTL_DAYS }
