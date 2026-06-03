// ══════════════════════════════════════════════════════
// user.repository.js — Хэрэглэгчийн өгөгдлийн давхарга (data-access)
// Зөвхөн SQL агуулна. Бизнес логик байхгүй — энэ нь user.controller.js-д үлдэнэ.
// Функц бүр сонголттой `exec` параметр авна (default = pool); ирээдүйд
// withTransaction-д ашиглавал client дамжуулна.
// ══════════════════════════════════════════════════════

const { query } = require('../config/db')

// Pool-level query-г .query(text, params) интерфэйс болгон боож,
// транзакцийн client-тэй ижил хэлбэртэй болгоно.
const pool = { query: (text, params) => query(text, params) }

// ── Profile ───────────────────────────────────────────

const findUserProfile = async (userId, exec = pool) => {
  const r = await exec.query(
    `SELECT user_id, first_name, last_name, email, phone,
            address, profile_image_url, user_type, status,
            created_at, last_login_at
     FROM users WHERE user_id = $1`,
    [userId]
  )
  return r.rows[0]
}

const updateUserProfile = async (
  { userId, firstName, lastName, address, phone }, exec = pool
) => {
  const r = await exec.query(
    `UPDATE users
     SET first_name  = COALESCE($1, first_name),
         last_name   = COALESCE($2, last_name),
         address     = COALESCE($3, address),
         phone       = COALESCE($4, phone),
         updated_at  = NOW()
     WHERE user_id = $5
     RETURNING user_id, first_name, last_name, email, phone,
               address, profile_image_url, user_type`,
    [firstName, lastName, address, phone, userId]
  )
  return r.rows[0]
}

const softDeleteUser = async (userId, exec = pool) => {
  await exec.query(
    `UPDATE users SET status = 'DELETED', updated_at = NOW()
     WHERE user_id = $1`,
    [userId]
  )
}

const findProfileImageUrl = async (userId, exec = pool) => {
  const r = await exec.query(
    `SELECT profile_image_url FROM users WHERE user_id = $1`,
    [userId]
  )
  return r.rows[0]
}

const updateProfileImageUrl = async (userId, url, exec = pool) => {
  await exec.query(
    `UPDATE users SET profile_image_url = $1, updated_at = NOW()
     WHERE user_id = $2`,
    [url, userId]
  )
}

// ── Ratings ───────────────────────────────────────────

const findUserRatingSummary = async (userId, exec = pool) => {
  const r = await exec.query(
    `SELECT rating_avg, rating_count
     FROM user_rating_summary
     WHERE user_id = $1`,
    [userId]
  )
  return r.rows[0]
}

const findRecentRatingsForUser = async (userId, exec = pool) => {
  const r = await exec.query(
    `SELECT ur.rating_id, ur.rating, ur.comment, ur.created_at,
            ur.contract_id, c.contract_number,
            u.first_name        AS rater_first_name,
            u.last_name         AS rater_last_name,
            u.profile_image_url AS rater_image_url
     FROM user_ratings ur
     LEFT JOIN users u     ON u.user_id     = ur.rater_id
     LEFT JOIN contracts c ON c.contract_id = ur.contract_id
     WHERE ur.rated_user_id = $1
     ORDER BY ur.created_at DESC
     LIMIT 5`,
    [userId]
  )
  return r.rows
}

// ── User search ───────────────────────────────────────

const findPastCounterparties = async (userId, q, exec = pool) => {
  const r = await exec.query(
    `SELECT DISTINCT
            u.user_id, u.first_name, u.last_name, u.email, u.phone,
            u.profile_image_url,
            COALESCE(rs.rating_avg, 0)   AS rating_avg,
            COALESCE(rs.rating_count, 0) AS rating_count
       FROM users u
       LEFT JOIN user_rating_summary rs ON rs.user_id = u.user_id
      WHERE u.status = 'ACTIVE'
        AND u.user_id IN (
              SELECT DISTINCT cp_other.user_id
                FROM contract_participants cp_self
                JOIN contract_participants cp_other
                  ON cp_other.contract_id = cp_self.contract_id
               WHERE cp_self.user_id    = $1
                 AND cp_other.user_id IS NOT NULL
                 AND cp_other.user_id  <> $1
            )
        AND (
              $2::text IS NULL
              OR LOWER(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,''))
                   LIKE '%' || LOWER($2) || '%'
              OR LOWER(COALESCE(u.email,'')) LIKE '%' || LOWER($2) || '%'
              OR COALESCE(u.phone,'')        LIKE '%' || $2 || '%'
            )
      ORDER BY u.first_name NULLS LAST
      LIMIT 30`,
    [userId, q]
  )
  return r.rows
}

const findUserByPhone = async (phone, excludeUserId, exec = pool) => {
  const r = await exec.query(
    `SELECT user_id, first_name, last_name, phone, email,
            profile_image_url, user_type
     FROM users
     WHERE phone = $1
       AND status = 'ACTIVE'
       AND user_id <> $2`,
    [phone, excludeUserId]
  )
  return r.rows[0]
}

// ── User signatures ───────────────────────────────────

const findUserSignatures = async (userId, exec = pool) => {
  const r = await exec.query(
    `SELECT user_signature_id, signature_type, is_default,
            created_at, signature_blob
     FROM user_signatures
     WHERE user_id = $1
     ORDER BY is_default DESC, created_at DESC`,
    [userId]
  )
  return r.rows
}

// uq_user_default_signature UNIQUE-ийг зөрчихгүйн тулд шинэ default тавихын
// өмнө хуучин default-ыг арилгана.
const clearDefaultSignature = async (userId, exec = pool) => {
  await exec.query(
    `UPDATE user_signatures SET is_default = false WHERE user_id = $1`,
    [userId]
  )
}

const insertSignature = async (
  { userId, blob, signatureType, isDefault }, exec = pool
) => {
  const r = await exec.query(
    `INSERT INTO user_signatures (user_id, signature_blob, signature_type, is_default)
     VALUES ($1,$2,$3,$4)
     RETURNING user_signature_id, signature_type, is_default, created_at`,
    [userId, blob, signatureType, isDefault]
  )
  return r.rows[0]
}

const setSignatureAsDefault = async (signatureId, userId, exec = pool) => {
  const r = await exec.query(
    `UPDATE user_signatures
     SET is_default = true
     WHERE user_signature_id = $1 AND user_id = $2
     RETURNING user_signature_id, is_default`,
    [signatureId, userId]
  )
  return r.rows[0]
}

const deleteUserSignature = async (signatureId, userId, exec = pool) => {
  const r = await exec.query(
    `DELETE FROM user_signatures
     WHERE user_signature_id = $1 AND user_id = $2
     RETURNING user_signature_id`,
    [signatureId, userId]
  )
  return r.rows[0]
}

// ── Notifications ─────────────────────────────────────

const findUserNotifications = async (userId, exec = pool) => {
  const r = await exec.query(
    `SELECT notification_id, title, message, is_read,
            contract_id, channel, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId]
  )
  return r.rows
}

const markNotificationRead = async (notificationId, userId, exec = pool) => {
  await exec.query(
    `UPDATE notifications SET is_read = true
     WHERE notification_id = $1 AND user_id = $2`,
    [notificationId, userId]
  )
}

const markAllNotificationsRead = async (userId, exec = pool) => {
  await exec.query(
    `UPDATE notifications SET is_read = true
     WHERE user_id = $1 AND is_read = false`,
    [userId]
  )
}

// ── Livestock statistics ──────────────────────────────
// userField/otherField — controller дээр whitelist-ээс ('seller_id' | 'buyer_id')
// л дамждаг тул SQL injection эрсдэлгүй.

const findLivestockKpi = async ({ userField, userId }, exec = pool) => {
  const r = await exec.query(
    `WITH per_contract AS (
       SELECT contract_id,
              SUM(total_amount) AS contract_amount,
              SUM(count)        AS contract_count,
              COUNT(*)          AS contract_items
       FROM livestock_transactions
       WHERE ${userField} = $1
       GROUP BY contract_id
     )
     SELECT
       COALESCE(SUM(contract_count), 0)::INT     AS total_count,
       COALESCE(SUM(contract_amount), 0)::FLOAT  AS total_amount,
       COUNT(*)::INT                             AS contracts_count,
       COALESCE(SUM(contract_items), 0)::INT     AS items_count,
       COALESCE(AVG(contract_amount), 0)::FLOAT  AS avg_contract_amount,
       COALESCE(MAX(contract_amount), 0)::FLOAT  AS max_contract_amount
     FROM per_contract`,
    [userId]
  )
  return r.rows[0]
}

const findLivestockByType = async ({ userField, userId }, exec = pool) => {
  const r = await exec.query(
    `SELECT livestock_type,
            SUM(count)::INT            AS count,
            SUM(total_amount)::FLOAT   AS amount,
            AVG(price_per_unit)::FLOAT AS avg_price
     FROM livestock_transactions
     WHERE ${userField} = $1
     GROUP BY livestock_type
     ORDER BY count DESC`,
    [userId]
  )
  return r.rows
}

const findLivestockByPeriod = async (
  { userField, userId, period }, exec = pool
) => {
  const r = await exec.query(
    `SELECT DATE_TRUNC($2, transaction_date) AS period,
            SUM(count)::INT                  AS count,
            SUM(total_amount)::FLOAT         AS amount
     FROM livestock_transactions
     WHERE ${userField} = $1
     GROUP BY period
     ORDER BY period ASC
     LIMIT 24`,
    [userId, period]
  )
  return r.rows
}

const findLivestockPriceTrend = async (
  { userField, userId, period }, exec = pool
) => {
  const r = await exec.query(
    `SELECT DATE_TRUNC($2, transaction_date) AS period,
            livestock_type,
            AVG(price_per_unit)::FLOAT       AS avg_price,
            SUM(count)::INT                  AS count
     FROM livestock_transactions
     WHERE ${userField} = $1
       AND price_per_unit IS NOT NULL
     GROUP BY period, livestock_type
     ORDER BY period ASC, livestock_type ASC`,
    [userId, period]
  )
  return r.rows
}

const findRecentLivestock = async (
  { userField, otherField, userId }, exec = pool
) => {
  const r = await exec.query(
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
  return r.rows
}

// ── Top-rated users (leaderboard) ─────────────────────

const findTopRatedUsers = async (limit, exec = pool) => {
  const r = await exec.query(
    `SELECT u.user_id, u.first_name, u.last_name,
            u.profile_image_url, u.user_type,
            s.rating_avg, s.rating_count
     FROM user_rating_summary s
     JOIN users u ON u.user_id = s.user_id
     WHERE u.status = 'ACTIVE'
     ORDER BY s.rating_avg DESC, s.rating_count DESC, u.first_name ASC
     LIMIT $1`,
    [limit]
  )
  return r.rows
}

module.exports = {
  // profile
  findUserProfile, updateUserProfile, softDeleteUser,
  findProfileImageUrl, updateProfileImageUrl,
  // ratings
  findUserRatingSummary, findRecentRatingsForUser,
  // user search
  findPastCounterparties, findUserByPhone,
  // signatures
  findUserSignatures, clearDefaultSignature, insertSignature,
  setSignatureAsDefault, deleteUserSignature,
  // notifications
  findUserNotifications, markNotificationRead, markAllNotificationsRead,
  // livestock stats
  findLivestockKpi, findLivestockByType, findLivestockByPeriod,
  findLivestockPriceTrend, findRecentLivestock,
  // top-rated
  findTopRatedUsers,
}
