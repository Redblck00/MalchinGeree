const express = require('express')
const router  = express.Router()
const auth    = require('../middlewares/auth.middleware')
const user    = require('../controllers/user.controller')
const { profileUpload, signatureUpload } = require('../utils/upload')

router.use(auth)

// ── ПРОФАЙЛ ───────────────────────────────────────────
router.get('/profile',                                    user.getProfile)
router.patch('/profile',                                  user.updateProfile)
router.delete('/profile',                                 user.deleteAccount)
router.post('/profile/image', profileUpload.single('image'), user.uploadProfileImage)

// ── ҮНЭЛГЭЭ ───────────────────────────────────────────
// GET /api/users/ratings → { summary: { rating_avg, rating_count }, recent: [...] }
router.get('/ratings',                                    user.getRatings)

// ── ХЭРЭГЛЭГЧ ХАЙХ ───────────────────────────────────
// GET /api/users/search?phone=99112233
router.get('/search',                                     user.searchByPhone)

// ── ГАРЫН ҮСЭГ ────────────────────────────────────────
// user_signatures хүснэгт — хэрэглэгчийн хадгалсан гарын үсгийн загвар
router.get('/signatures',                                 user.getSignatures)
router.post('/signatures',                                user.saveSignature)
router.patch('/signatures/:id/default',                   user.setDefaultSignature)
router.delete('/signatures/:id',                          user.deleteSignature)

// ── МЭДЭГДЭЛ ──────────────────────────────────────────
router.get('/notifications',                              user.getNotifications)
router.patch('/notifications/:id/read',                   user.markNotificationRead)
router.patch('/notifications/read-all',                   user.markAllNotificationsRead)

// ── МАЛЫН СТАТИСТИК ──────────────────────────────────
// GET /api/users/livestock/stats?role=buyer|seller&period=month|quarter|year
router.get('/livestock/stats',                            user.getLivestockStats)

module.exports = router