const crypto = require('crypto')
const { query } = require('../config/db')

// IP + UA-ийн SHA-256 → давтагдашгүй зочин тооцоход хэрэглэгдэх pseudonymous ID.
// Cookie шаардахгүй учир GDPR-нийцтэй.
const sessionHash = (ip, ua) =>
  crypto.createHash('sha256').update(`${ip || ''}|${ua || ''}`).digest('hex')

// Fire-and-forget — INSERT хийхэд алдаа гарсан ч request зогсохгүй.
const recordVisit = (req, source = 'api') => {
  const ip   = req.ip || null
  const ua   = (req.headers['user-agent'] || '').slice(0, 300)
  const ref  = (req.headers.referer || req.body?.referer || '').slice(0, 500) || null
  const path = (req.body?.path || req.originalUrl || req.path || '').slice(0, 300)

  query(
    `INSERT INTO public_visits
       (path, method, source, ip_address, user_agent, referer, session_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [path, req.method, source, ip, ua, ref, sessionHash(ip, ua)]
  ).catch(() => {})
}

// Middleware: бүх public API-д залгана. Нэвтэрсэн хэрэглэгчийг алгасна.
const trackPublicVisit = (req, res, next) => {
  if (!req.user) recordVisit(req, 'api')
  next()
}

module.exports = { trackPublicVisit, recordVisit }
