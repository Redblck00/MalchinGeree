// ══════════════════════════════════════════════════════
// admin.repository.js — Admin panel-ийн өгөгдлийн давхарга
// Зөвхөн SQL агуулна. Бизнес логик байхгүй — энэ нь admin.controller.js-д үлдэнэ.
// Функц бүр сонголттой `exec` параметр авна (default = pool); ирээдүйд
// withTransaction-д ашиглавал client дамжуулна.
//
// Тэмдэглэл: contract.repository-той зарим query ижил нэртэй боловч admin-ы
// view нь өөр (жишээ нь inactive template-ыг ч буцаадаг). Тиймээс энд тусдаа.
// ══════════════════════════════════════════════════════

const { query } = require('../config/db')

const pool = { query: (text, params) => query(text, params) }

// ── Templates (admin view) ────────────────────────────

const findAllTemplates = async (exec = pool) => {
  const r = await exec.query(
    `SELECT template_id, name, description, is_standard, is_active,
            schema_json, created_at, updated_at,
            -- template_content хэрэглэгчид харуулахгүй (нуугдсан)
            LENGTH(template_content) AS content_length
     FROM contract_templates
     ORDER BY created_at DESC`
  )
  return r.rows
}

const findTemplateById = async (id, exec = pool) => {
  const r = await exec.query(
    `SELECT template_id, name, description, is_standard, is_active,
            template_content, schema_json, created_at, updated_at
     FROM contract_templates
     WHERE template_id = $1`,
    [id]
  )
  return r.rows[0]
}

const insertTemplate = async (
  { name, description, content, schema, isStandard, createdBy }, exec = pool
) => {
  const r = await exec.query(
    `INSERT INTO contract_templates
       (name, description, template_content, schema_json, is_standard, created_by)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING template_id, name, description, is_standard, schema_json, created_at`,
    [name, description, content, schema, isStandard, createdBy]
  )
  return r.rows[0]
}

const updateTemplate = async (
  { id, name, description, content, schema, isStandard, isActive }, exec = pool
) => {
  const r = await exec.query(
    `UPDATE contract_templates
     SET name             = COALESCE($1, name),
         description      = COALESCE($2, description),
         template_content = COALESCE($3, template_content),
         schema_json      = COALESCE($4, schema_json),
         is_standard      = COALESCE($5, is_standard),
         is_active        = COALESCE($6, is_active),
         updated_at       = NOW()
     WHERE template_id = $7
     RETURNING template_id, name, is_standard, is_active, updated_at`,
    [name, description, content, schema, isStandard, isActive, id]
  )
  return r.rows[0]
}

const deleteTemplateById = async (id, exec = pool) => {
  await exec.query(
    `DELETE FROM contract_templates WHERE template_id = $1`,
    [id]
  )
}

// ── Users (admin view) ────────────────────────────────

const findAllUsers = async (exec = pool) => {
  const r = await exec.query(
    `SELECT user_id, first_name, last_name, email, phone,
            user_type, status, created_at, last_login_at
     FROM users ORDER BY created_at DESC`
  )
  return r.rows
}

const updateUserStatus = async (userId, status, exec = pool) => {
  const r = await exec.query(
    `UPDATE users SET status = $1, updated_at = NOW()
     WHERE user_id = $2 RETURNING user_id, status`,
    [status, userId]
  )
  return r.rows[0]
}

// ── Contracts (admin view) ────────────────────────────

const updateContractStatus = async (contractId, status, exec = pool) => {
  const r = await exec.query(
    `UPDATE contracts SET status = $1, updated_at = NOW()
     WHERE contract_id = $2 RETURNING contract_id, status`,
    [status, contractId]
  )
  return r.rows[0]
}

const findAllContracts = async (exec = pool) => {
  const r = await exec.query(
    `SELECT c.contract_id, c.contract_number, c.title, c.status,
            c.created_at, c.updated_at,
            t.name AS template_name,
            u.first_name || ' ' || u.last_name AS creator_name
     FROM contracts c
     LEFT JOIN contract_templates t ON c.template_id = t.template_id
     LEFT JOIN users u ON c.creator_id = u.user_id
     ORDER BY c.created_at DESC`
  )
  return r.rows
}

// ── Stats (dashboard KPI-уд) ──────────────────────────

const countUserStats = async (exec = pool) => {
  const r = await exec.query(
    `SELECT COUNT(*) total,
            COUNT(*) FILTER (WHERE status='ACTIVE') active,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') new_30d
     FROM users`
  )
  return r.rows[0]
}

const countContractStats = async (exec = pool) => {
  const r = await exec.query(
    `SELECT COUNT(*) total,
            COUNT(*) FILTER (WHERE status='COMPLETED') completed,
            COUNT(*) FILTER (WHERE status='DRAFT') draft,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') new_30d
     FROM contracts`
  )
  return r.rows[0]
}

const countActiveTemplates = async (exec = pool) => {
  const r = await exec.query(
    `SELECT COUNT(*) total FROM contract_templates WHERE is_active = true`
  )
  return r.rows[0]
}

// ── Visit report (зочдын тайлан) ──────────────────────

const findVisitKpi = async (days, exec = pool) => {
  const r = await exec.query(
    `SELECT
       COUNT(*)::INT                                  AS total_visits,
       COUNT(DISTINCT session_hash)::INT              AS unique_visitors,
       COUNT(*) FILTER (WHERE visited_at >= NOW() - INTERVAL '24 hours')::INT AS visits_24h,
       COUNT(DISTINCT session_hash) FILTER
         (WHERE visited_at >= NOW() - INTERVAL '24 hours')::INT AS unique_24h
     FROM public_visits
     WHERE visited_at >= NOW() - ($1 || ' days')::INTERVAL`,
    [days]
  )
  return r.rows[0]
}

const findVisitSeries = async (days, exec = pool) => {
  const r = await exec.query(
    `SELECT
       DATE_TRUNC('day', visited_at)::DATE   AS day,
       COUNT(*)::INT                          AS visits,
       COUNT(DISTINCT session_hash)::INT      AS uniques
     FROM public_visits
     WHERE visited_at >= NOW() - ($1 || ' days')::INTERVAL
     GROUP BY 1
     ORDER BY 1`,
    [days]
  )
  return r.rows
}

const findVisitTopPaths = async (days, exec = pool) => {
  const r = await exec.query(
    `SELECT path,
            COUNT(*)::INT                     AS hits,
            COUNT(DISTINCT session_hash)::INT AS uniques
     FROM public_visits
     WHERE visited_at >= NOW() - ($1 || ' days')::INTERVAL
     GROUP BY path
     ORDER BY hits DESC
     LIMIT 10`,
    [days]
  )
  return r.rows
}

const findVisitTopReferers = async (days, exec = pool) => {
  const r = await exec.query(
    `SELECT COALESCE(NULLIF(referer, ''), 'direct') AS referer,
            COUNT(*)::INT                            AS hits
     FROM public_visits
     WHERE visited_at >= NOW() - ($1 || ' days')::INTERVAL
     GROUP BY 1
     ORDER BY hits DESC
     LIMIT 8`,
    [days]
  )
  return r.rows
}

const findVisitSourceMix = async (days, exec = pool) => {
  const r = await exec.query(
    `SELECT source, COUNT(*)::INT AS hits
     FROM public_visits
     WHERE visited_at >= NOW() - ($1 || ' days')::INTERVAL
     GROUP BY source`,
    [days]
  )
  return r.rows
}

const findVisitHourly = async (days, exec = pool) => {
  const r = await exec.query(
    `SELECT EXTRACT(HOUR FROM visited_at)::INT AS hour,
            COUNT(*)::INT                       AS hits
     FROM public_visits
     WHERE visited_at >= NOW() - ($1 || ' days')::INTERVAL
     GROUP BY 1
     ORDER BY 1`,
    [days]
  )
  return r.rows
}

// ── System logs ───────────────────────────────────────

const findSystemLogs = async (limit, offset, exec = pool) => {
  const r = await exec.query(
    `SELECT l.log_id, l.action, l.entity_type, l.entity_id,
            l.ip_address, l.created_at,
            u.first_name || ' ' || u.last_name AS user_name
     FROM system_logs l
     LEFT JOIN users u ON l.user_id = u.user_id
     ORDER BY l.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  )
  return r.rows
}

module.exports = {
  // templates
  findAllTemplates, findTemplateById, insertTemplate,
  updateTemplate, deleteTemplateById,
  // users
  findAllUsers, updateUserStatus,
  // contracts
  findAllContracts, updateContractStatus,
  // stats
  countUserStats, countContractStats, countActiveTemplates,
  // visit report
  findVisitKpi, findVisitSeries, findVisitTopPaths,
  findVisitTopReferers, findVisitSourceMix, findVisitHourly,
  // logs
  findSystemLogs,
}
