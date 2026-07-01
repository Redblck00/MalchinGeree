const repo = require('../repositories/user.repository')
const { safeErrorMessage } = require('../utils/errors')
const { deleteFile } = require('../utils/upload')
const { deleteFromCloudinary, publicIdFromUrl } = require('../utils/cloudinary')

// ── GET /api/users/profile ────────────────────────────
const getProfile = async (req, res) => {
  try {
    const profile = await repo.findUserProfile(req.user.user_id)
    res.json({ data: profile })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ── PATCH /api/users/profile ──────────────────────────
// Body: { first_name?, last_name?, address?, phone? }
// phone-н uniqueness alert — DB constraint-аас тааралдсан тохиолдолд
// 409 буцаана.
const updateProfile = async (req, res) => {
  try {
    const { first_name, last_name, address, phone } = req.body
    const updated = await repo.updateUserProfile({
      userId:    req.user.user_id,
      firstName: first_name?.trim() || null,
      lastName:  last_name?.trim()  || null,
      address:   address?.trim()    || null,
      phone:     phone?.trim()      || null,
    })
    res.json({ data: updated })
  } catch (err) {
    if (err.code === '23505') {  // unique violation
      return res.status(409).json({ message: 'Уг утасны дугаар аль хэдийн бүртгэгдсэн' })
    }
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ── GET /api/users/ratings ────────────────────────────
// Хэрэглэгчийн авсан үнэлгээний дундаж + сүүлийн сэтгэгдлүүд
const getRatings = async (req, res) => {
  try {
    const userId = req.user.user_id

    // user_rating_summary materialized view-ээс дундаж + тоо
    let summary = { rating_avg: 0, rating_count: 0 }
    try {
      const sumRow = await repo.findUserRatingSummary(userId)
      if (sumRow) {
        summary = {
          rating_avg:   Number(sumRow.rating_avg)   || 0,
          rating_count: Number(sumRow.rating_count) || 0,
        }
      }
    } catch (_) { /* view байхгүй бол default */ }

    // Сүүлийн 5 сэтгэгдэл
    const recent = await repo.findRecentRatingsForUser(userId)

    res.json({
      data: {
        summary,
        recent,
      },
    })
  } catch (err) {
    console.error('getRatings:', err)
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ── DELETE /api/users/profile ─────────────────────────
const deleteAccount = async (req, res) => {
  try {
    // Soft delete — status = DELETED
    await repo.softDeleteUser(req.user.user_id)
    res.json({ message: 'Бүртгэл устгагдлаа' })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ── POST /api/users/profile/image ─────────────────────
// multer-cloudinary → req.file.path (secure URL), req.file.filename (public_id)
const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Зураг оруулна уу' })

    const oldRow = await repo.findProfileImageUrl(req.user.user_id)
    const oldUrl = oldRow?.profile_image_url || null
    const url    = req.file.path

    await repo.updateProfileImageUrl(req.user.user_id, url)

    if (oldUrl && oldUrl !== url) {
      const oldPublicId = publicIdFromUrl(oldUrl)
      if (oldPublicId) {
        await deleteFromCloudinary(oldPublicId, 'image')
      } else if (!/^https?:\/\//i.test(oldUrl)) {
        deleteFile(oldUrl)
      }
    }

    res.json({ data: { profile_image_url: url } })
  } catch (err) {
    if (req.file?.filename) {
      await deleteFromCloudinary(req.file.filename, 'image')
    }
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ── GET /api/users/past-counterparties?q=... ─────────
// "Талыг нэмэх" modal-ын хайх таб — өмнө гэрээ байгуулсан хүмүүсээс хайна.
// q байхгүй бол сүүлд гэрээ хийсэн дарааллаар тэргүүлэгчид буцна.
const getPastCounterparties = async (req, res) => {
  try {
    const q = (req.query.q || '').trim() || null
    const rows = await repo.findPastCounterparties(req.user.user_id, q)
    res.json({ data: rows })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ── GET /api/users/search?phone=99112233 ─────────────
// Гэрээнд оролцогч хайхад ашиглана
const searchByPhone = async (req, res) => {
  try {
    const { phone } = req.query
    if (!phone) return res.status(400).json({ message: 'Утасны дугаар шаардлагатай' })

    const user = await repo.findUserByPhone(phone, req.user.user_id)
    if (!user) return res.status(404).json({ message: 'Хэрэглэгч олдсонгүй' })
    res.json({ data: user })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ── GET /api/users/signatures ─────────────────────────
// user_signatures — хэрэглэгчийн хадгалсан гарын үсгийн загварууд
const getSignatures = async (req, res) => {
  try {
    const rows = await repo.findUserSignatures(req.user.user_id)
    res.json({ data: rows })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ── POST /api/users/signatures ────────────────────────
// Body: { signature_blob, signature_type, is_default }
const saveSignature = async (req, res) => {
  try {
    const { signature_blob, signature_type = 'DRAW', is_default = false } = req.body
    if (!signature_blob) return res.status(400).json({ message: 'Гарын үсэг шаардлагатай' })

    // is_default = true бол өмнөхийг хасах
    // DB дээр UNIQUE INDEX байгаа: uq_user_default_signature
    if (is_default) {
      await repo.clearDefaultSignature(req.user.user_id)
    }

    const signature = await repo.insertSignature({
      userId:        req.user.user_id,
      blob:          signature_blob,
      signatureType: signature_type,
      isDefault:     is_default,
    })
    res.status(201).json({ data: signature })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ── PATCH /api/users/signatures/:id/default ──────────
const setDefaultSignature = async (req, res) => {
  try {
    // Өмнөх default хасах
    await repo.clearDefaultSignature(req.user.user_id)
    // Шинэ default тохируулах
    const signature = await repo.setSignatureAsDefault(req.params.id, req.user.user_id)
    if (!signature) return res.status(404).json({ message: 'Гарын үсэг олдсонгүй' })
    res.json({ data: signature })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ── DELETE /api/users/signatures/:id ─────────────────
const deleteSignature = async (req, res) => {
  try {
    const deleted = await repo.deleteUserSignature(req.params.id, req.user.user_id)
    if (!deleted) return res.status(404).json({ message: 'Гарын үсэг олдсонгүй' })
    res.json({ message: 'Гарын үсэг устгагдлаа' })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ── GET /api/users/notifications ──────────────────────
const getNotifications = async (req, res) => {
  try {
    const rows = await repo.findUserNotifications(req.user.user_id)
    const unread = rows.filter(n => !n.is_read).length
    res.json({ data: rows, unread })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ── PATCH /api/users/notifications/:id/read ──────────
const markNotificationRead = async (req, res) => {
  try {
    await repo.markNotificationRead(req.params.id, req.user.user_id)
    res.json({ message: 'Уншсан гэж тэмдэглэгдлээ' })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ── PATCH /api/users/notifications/read-all ──────────
const markAllNotificationsRead = async (req, res) => {
  try {
    await repo.markAllNotificationsRead(req.user.user_id)
    res.json({ message: 'Бүгд уншсан гэж тэмдэглэгдлээ' })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ══════════════════════════════════════════════════════
// LIVESTOCK STATISTICS
// GET /api/users/livestock/stats?role=buyer|seller&period=month|quarter|year
// → total · by_type · by_period · price_trend · recent
// Зөвхөн хүсэлт явуулсан хэрэглэгчийн өөрийн өгөгдөл (хувийн статистик).
// ══════════════════════════════════════════════════════

const getLivestockStats = async (req, res) => {
  try {
    const role   = req.query.role === 'seller' ? 'seller' : 'buyer'
    const period = ['month', 'quarter', 'year'].includes(req.query.period) ? req.query.period : 'month'
    const userId = req.user.user_id

    const userField  = role === 'buyer' ? 'buyer_id'  : 'seller_id'
    const otherField = role === 'buyer' ? 'seller_id' : 'buyer_id'

    // 1. KPI хураангуй
    //    per_contract CTE: нэг гэрээний нийт дүнгээр групплэх → дундаж/хамгийн өндөр
    //    "гэрээний үнэ" гарна (нэг гэрээнд олон төрлийн мал орсон ч зөв тоологдоно).
    const total = await repo.findLivestockKpi({ userField, userId })

    // 2. Малын төрлөөр (Pie chart) — count + amount + дундаж нэгж үнэ
    //    AVG нь NULL утгуудыг автоматаар алгасдаг тул price_per_unit IS NULL мөрүүд
    //    avg_price тооцоонд орохгүй (харин count/amount-д орно).
    const byType = await repo.findLivestockByType({ userField, userId })

    // 3. Сар/улирал/жилээр (Bar chart + KPI "хамгийн идэвхтэй сар")
    //    ASC дараалал — frontend timeline зурахад шууд таарна.
    const byPeriod = await repo.findLivestockByPeriod({ userField, userId, period })

    // 4. Үнийн өсөлт (Line chart) — period × livestock_type × дундаж нэгж үнэ
    //    Малын төрөл бүрд line нэг → frontend дээр livestock_type-аар бүлэглэнэ.
    //    price_per_unit IS NULL мөрүүдийг шүүж хаасан — null line гаргахгүй.
    const priceTrend = await repo.findLivestockPriceTrend({ userField, userId, period })

    // 5. Сүүлийн 10 гүйлгээ
    const recent = await repo.findRecentLivestock({ userField, otherField, userId })

    res.json({
      data: {
        role,
        period,
        total,
        by_type:     byType,
        by_period:   byPeriod,
        price_trend: priceTrend,
        recent,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ══════════════════════════════════════════════════════
// TOP-RATED USERS (хувийн профайл хэсэгт зориулсан leaderboard)
// GET /api/users/top-rated?limit=5
// Идэвхтэй хэрэглэгчдээс үнэлгээний дундажаар эрэмбэлж тодорхой тоогоор буцаана.
// Глобал жагсаалт — auth-ласан хэрэглэгчид харах боломжтой.
// ══════════════════════════════════════════════════════
const getTopRatedUsers = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 5, 1), 20)
    const rows = await repo.findTopRatedUsers(limit)
    res.json({ data: rows })
  } catch (err) {
    console.error('getTopRatedUsers:', err)
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

module.exports = {
  getProfile, updateProfile, deleteAccount, uploadProfileImage,
  getRatings,
  searchByPhone, getPastCounterparties,
  getSignatures, saveSignature, setDefaultSignature, deleteSignature,
  getNotifications, markNotificationRead, markAllNotificationsRead,
  getLivestockStats,
  getTopRatedUsers,
}
