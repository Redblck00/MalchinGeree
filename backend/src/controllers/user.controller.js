const { query } = require('../config/db')

// ── GET /api/users/profile ────────────────────────────
const getProfile = async (req, res) => {
  try {
    const result = await query(
      `SELECT user_id, first_name, last_name, email, phone,
              address, profile_image_url, user_type, status,
              created_at, last_login_at
       FROM users WHERE user_id = $1`,
      [req.user.user_id]
    )
    res.json({ data: result.rows[0] })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── PATCH /api/users/profile ──────────────────────────
// Body: { first_name?, last_name?, address?, phone? }
// phone-н uniqueness alert — DB constraint-аас тааралдсан тохиолдолд
// 409 буцаана.
const updateProfile = async (req, res) => {
  try {
    const { first_name, last_name, address, phone } = req.body
    const result = await query(
      `UPDATE users
       SET first_name  = COALESCE($1, first_name),
           last_name   = COALESCE($2, last_name),
           address     = COALESCE($3, address),
           phone       = COALESCE($4, phone),
           updated_at  = NOW()
       WHERE user_id = $5
       RETURNING user_id, first_name, last_name, email, phone,
                 address, profile_image_url, user_type`,
      [
        first_name?.trim() || null,
        last_name?.trim()  || null,
        address?.trim()    || null,
        phone?.trim()      || null,
        req.user.user_id,
      ]
    )
    res.json({ data: result.rows[0] })
  } catch (err) {
    if (err.code === '23505') {  // unique violation
      return res.status(409).json({ message: 'Уг утасны дугаар аль хэдийн бүртгэгдсэн' })
    }
    res.status(400).json({ message: err.message })
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
      const sumRes = await query(
        `SELECT rating_avg, rating_count
         FROM user_rating_summary
         WHERE user_id = $1`,
        [userId]
      )
      if (sumRes.rows[0]) {
        summary = {
          rating_avg:   Number(sumRes.rows[0].rating_avg)   || 0,
          rating_count: Number(sumRes.rows[0].rating_count) || 0,
        }
      }
    } catch (_) { /* view байхгүй бол default */ }

    // Сүүлийн 5 сэтгэгдэл
    const recentRes = await query(
      `SELECT ur.rating_id, ur.rating, ur.comment, ur.created_at,
              ur.contract_id, c.contract_number,
              u.first_name AS rater_first_name,
              u.last_name  AS rater_last_name
       FROM user_ratings ur
       LEFT JOIN users u     ON u.user_id     = ur.rater_id
       LEFT JOIN contracts c ON c.contract_id = ur.contract_id
       WHERE ur.rated_user_id = $1
       ORDER BY ur.created_at DESC
       LIMIT 5`,
      [userId]
    )

    res.json({
      data: {
        summary,
        recent: recentRes.rows,
      },
    })
  } catch (err) {
    console.error('getRatings:', err)
    res.status(400).json({ message: err.message })
  }
}

// ── DELETE /api/users/profile ─────────────────────────
const deleteAccount = async (req, res) => {
  try {
    // Soft delete — status = DELETED
    await query(
      `UPDATE users SET status = 'DELETED', updated_at = NOW()
       WHERE user_id = $1`,
      [req.user.user_id]
    )
    res.json({ message: 'Бүртгэл устгагдлаа' })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── POST /api/users/profile/image ─────────────────────
const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Зураг оруулна уу' })
    const url = `uploads/profiles/${req.file.filename}`
    await query(
      `UPDATE users SET profile_image_url = $1, updated_at = NOW()
       WHERE user_id = $2`,
      [url, req.user.user_id]
    )
    res.json({ data: { profile_image_url: url } })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── GET /api/users/search?phone=99112233 ─────────────
// Гэрээнд оролцогч хайхад ашиглана
const searchByPhone = async (req, res) => {
  try {
    const { phone } = req.query
    if (!phone) return res.status(400).json({ message: 'Утасны дугаар шаардлагатай' })

    const result = await query(
      `SELECT user_id, first_name, last_name, phone, email,
              profile_image_url, user_type
       FROM users
       WHERE phone = $1
         AND status = 'ACTIVE'
         AND user_id <> $2`,
      [phone, req.user.user_id]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Хэрэглэгч олдсонгүй' })
    res.json({ data: result.rows[0] })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── GET /api/users/signatures ─────────────────────────
// user_signatures — хэрэглэгчийн хадгалсан гарын үсгийн загварууд
const getSignatures = async (req, res) => {
  try {
    const result = await query(
      `SELECT user_signature_id, signature_type, is_default,
              created_at, signature_blob
       FROM user_signatures
       WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [req.user.user_id]
    )
    res.json({ data: result.rows })
  } catch (err) {
    res.status(400).json({ message: err.message })
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
      await query(
        `UPDATE user_signatures SET is_default = false WHERE user_id = $1`,
        [req.user.user_id]
      )
    }

    const result = await query(
      `INSERT INTO user_signatures (user_id, signature_blob, signature_type, is_default)
       VALUES ($1,$2,$3,$4)
       RETURNING user_signature_id, signature_type, is_default, created_at`,
      [req.user.user_id, signature_blob, signature_type, is_default]
    )
    res.status(201).json({ data: result.rows[0] })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── PATCH /api/users/signatures/:id/default ──────────
const setDefaultSignature = async (req, res) => {
  try {
    // Өмнөх default хасах
    await query(
      `UPDATE user_signatures SET is_default = false WHERE user_id = $1`,
      [req.user.user_id]
    )
    // Шинэ default тохируулах
    const result = await query(
      `UPDATE user_signatures     
       SET is_default = true
       WHERE user_signature_id = $1 AND user_id = $2
       RETURNING user_signature_id, is_default`,
      [req.params.id, req.user.user_id]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Гарын үсэг олдсонгүй' })
    res.json({ data: result.rows[0] })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── DELETE /api/users/signatures/:id ─────────────────
const deleteSignature = async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM user_signatures
       WHERE user_signature_id = $1 AND user_id = $2
       RETURNING user_signature_id`,
      [req.params.id, req.user.user_id]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Гарын үсэг олдсонгүй' })
    res.json({ message: 'Гарын үсэг устгагдлаа' })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── GET /api/users/notifications ──────────────────────
const getNotifications = async (req, res) => {
  try {
    const result = await query(
      `SELECT notification_id, title, message, is_read,
              contract_id, channel, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.user_id]
    )
    const unread = result.rows.filter(n => !n.is_read).length
    res.json({ data: result.rows, unread })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── PATCH /api/users/notifications/:id/read ──────────
const markNotificationRead = async (req, res) => {
  try {
    await query(
      `UPDATE notifications SET is_read = true
       WHERE notification_id = $1 AND user_id = $2`,
      [req.params.id, req.user.user_id]
    )
    res.json({ message: 'Уншсан гэж тэмдэглэгдлээ' })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── PATCH /api/users/notifications/read-all ──────────
const markAllNotificationsRead = async (req, res) => {
  try {
    await query(
      `UPDATE notifications SET is_read = true
       WHERE user_id = $1 AND is_read = false`,
      [req.user.user_id]
    )
    res.json({ message: 'Бүгд уншсан гэж тэмдэглэгдлээ' })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ══════════════════════════════════════════════════════
// LIVESTOCK STATISTICS
// GET /api/users/livestock/stats?role=buyer|seller&period=month|quarter|year
// → 4 хэсэгтэй stats: total · by_type · by_period · recent
// ══════════════════════════════════════════════════════

const getLivestockStats = async (req, res) => {
  try {
    const role   = req.query.role === 'seller' ? 'seller' : 'buyer'
    const period = ['month', 'quarter', 'year'].includes(req.query.period) ? req.query.period : 'month'
    const userId = req.user.user_id

    const userField  = role === 'buyer' ? 'buyer_id'  : 'seller_id'
    const otherField = role === 'buyer' ? 'seller_id' : 'buyer_id'

    // 1. Нийт хураангуй
    const totalRes = await query(
      `SELECT
         COALESCE(SUM(count), 0)::INT          AS total_count,
         COALESCE(SUM(total_amount), 0)::FLOAT AS total_amount,
         COUNT(DISTINCT contract_id)::INT      AS contracts_count,
         COUNT(*)::INT                         AS items_count
       FROM livestock_transactions
       WHERE ${userField} = $1`,
      [userId]
    )

    // 2. Малын төрлөөр
    const byTypeRes = await query(
      `SELECT livestock_type,
              SUM(count)::INT          AS count,
              SUM(total_amount)::FLOAT AS amount
       FROM livestock_transactions
       WHERE ${userField} = $1
       GROUP BY livestock_type
       ORDER BY count DESC`,
      [userId]
    )

    // 3. Сар/улирал/жилээр
    const byPeriodRes = await query(
      `SELECT DATE_TRUNC($2, transaction_date) AS period,
              SUM(count)::INT                  AS count,
              SUM(total_amount)::FLOAT         AS amount
       FROM livestock_transactions
       WHERE ${userField} = $1
       GROUP BY period
       ORDER BY period DESC
       LIMIT 12`,
      [userId, period]
    )

    // 4. Сүүлийн 10 гүйлгээ
    const recentRes = await query(
      `SELECT lt.transaction_id, lt.livestock_type, lt.count,
              lt.price_per_unit, lt.total_amount, lt.transaction_date,
              lt.contract_id, c.contract_number, c.title,
              u.first_name AS other_first_name, u.last_name AS other_last_name
       FROM livestock_transactions lt
       LEFT JOIN users u ON u.user_id = lt.${otherField}
       LEFT JOIN contracts c ON c.contract_id = lt.contract_id
       WHERE lt.${userField} = $1
       ORDER BY lt.transaction_date DESC
       LIMIT 10`,
      [userId]
    )

    res.json({
      data: {
        role,
        period,
        total:     totalRes.rows[0],
        by_type:   byTypeRes.rows,
        by_period: byPeriodRes.rows,
        recent:    recentRes.rows,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(400).json({ message: err.message })
  }
}

module.exports = {
  getProfile, updateProfile, deleteAccount, uploadProfileImage,
  getRatings,
  searchByPhone,
  getSignatures, saveSignature, setDefaultSignature, deleteSignature,
  getNotifications, markNotificationRead, markAllNotificationsRead,
  getLivestockStats,
}