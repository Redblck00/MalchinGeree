const { query } = require('../config/db')
const { log, LOG } = require('../utils/logger')

// ── TEMPLATE ──────────────────────────────────────────

const getTemplates = async (req, res) => {
  try {
    const result = await query(
      `SELECT template_id, name, description, is_standard, is_active,
              schema_json, created_at, updated_at,
              -- template_content хэрэглэгчид харуулахгүй (нуугдсан)
              LENGTH(template_content) AS content_length
       FROM contract_templates
       ORDER BY created_at DESC`
    )
    res.json({ data: result.rows })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

const getTemplateById = async (req, res) => {
  try {
    const result = await query(
      `SELECT template_id, name, description, is_standard, is_active,
              template_content, schema_json, created_at, updated_at
       FROM contract_templates
       WHERE template_id = $1`,
      [req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Загвар олдсонгүй' })
    res.json({ data: result.rows[0] })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

const createTemplate = async (req, res) => {
  try {
    const { name, template_content, schema_json, is_standard = false, description } = req.body

    if (!name)             return res.status(400).json({ message: 'Загварын нэр шаардлагатай' })
    if (!template_content) return res.status(400).json({ message: 'Гэрээний текст шаардлагатай' })
    if (!schema_json)      return res.status(400).json({ message: 'Schema JSON шаардлагатай' })

    // schema_json validate
    let parsedSchema
    try {
      parsedSchema = typeof schema_json === 'string' ? JSON.parse(schema_json) : schema_json
      if (!parsedSchema.fields) throw new Error('fields байхгүй')
    } catch (e) {
      return res.status(400).json({ message: 'Schema JSON буруу формат: ' + e.message })
    }

    const result = await query(
      `INSERT INTO contract_templates
         (name, description, template_content, schema_json, is_standard, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING template_id, name, description, is_standard, schema_json, created_at`,
      [name, description || null, template_content, parsedSchema, is_standard, req.user.user_id]
    )

    await log({
      user_id: req.user.user_id,
      action: LOG.TEMPLATE_CREATE,
      entity_type: 'template',
      entity_id: result.rows[0].template_id,
      req,
    })

    res.status(201).json({ message: 'Загвар амжилттай үүслээ', data: result.rows[0] })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

const updateTemplate = async (req, res) => {
  try {
    const { name, template_content, schema_json, is_standard, description, is_active } = req.body
    const result = await query(
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
      [
        name || null,
        description || null,
        template_content || null,
        schema_json ? (typeof schema_json === 'string' ? JSON.parse(schema_json) : schema_json) : null,
        is_standard !== undefined ? is_standard : null,
        is_active   !== undefined ? is_active   : null,
        req.params.id,
      ]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Загвар олдсонгүй' })
    res.json({ data: result.rows[0] })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

const deleteTemplate = async (req, res) => {
  try {
    await query(`DELETE FROM contract_templates WHERE template_id = $1`, [req.params.id])
    res.json({ message: 'Загвар устгагдлаа' })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── ХЭРЭГЛЭГЧ ─────────────────────────────────────────

const getUsers = async (req, res) => {
  try {
    const result = await query(
      `SELECT user_id, first_name, last_name, email, phone,
              user_type, status, created_at, last_login_at
       FROM users ORDER BY created_at DESC`
    )
    res.json({ data: result.rows })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

const updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body
    const valid = ['ACTIVE', 'SUSPENDED', 'DELETED']
    if (!valid.includes(status)) return res.status(400).json({ message: 'Буруу статус' })
    const result = await query(
      `UPDATE users SET status = $1, updated_at = NOW()
       WHERE user_id = $2 RETURNING user_id, status`,
      [status, req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Хэрэглэгч олдсонгүй' })
    res.json({ data: result.rows[0] })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── ГЭРЭЭ ─────────────────────────────────────────────

const updateContractStatus = async (req, res) => {
  try {
    const { status } = req.body
    const valid = ['DRAFT', 'PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED']
    if (!valid.includes(status)) return res.status(400).json({ message: 'Буруу статус' })
    const result = await query(
      `UPDATE contracts SET status = $1, updated_at = NOW()
       WHERE contract_id = $2 RETURNING contract_id, status`,
      [status, req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Гэрээ олдсонгүй' })
    res.json({ data: result.rows[0] })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

const getContracts = async (req, res) => {
  try {
    const result = await query(
      `SELECT c.contract_id, c.contract_number, c.title, c.status,
              c.created_at, c.updated_at,
              t.name AS template_name,
              u.first_name || ' ' || u.last_name AS creator_name
       FROM contracts c
       LEFT JOIN contract_templates t ON c.template_id = t.template_id
       LEFT JOIN users u ON c.creator_id = u.user_id
       ORDER BY c.created_at DESC`
    )
    res.json({ data: result.rows })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── ТАЙЛАН ────────────────────────────────────────────

const getStats = async (req, res) => {
  try {
    const [users, contracts, templates] = await Promise.all([
      query(`SELECT COUNT(*) total,
               COUNT(*) FILTER (WHERE status='ACTIVE') active,
               COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') new_30d
             FROM users`),
      query(`SELECT COUNT(*) total,
               COUNT(*) FILTER (WHERE status='COMPLETED') completed,
               COUNT(*) FILTER (WHERE status='DRAFT') draft,
               COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') new_30d
             FROM contracts`),
      query(`SELECT COUNT(*) total FROM contract_templates WHERE is_active = true`),
    ])
    res.json({
      data: {
        users:     users.rows[0],
        contracts: contracts.rows[0],
        templates: templates.rows[0],
      },
    })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── ЛОГ ───────────────────────────────────────────────

const getLogs = async (req, res) => {
  try {
    const limit  = parseInt(req.query.limit)  || 50
    const offset = parseInt(req.query.offset) || 0
    const result = await query(
      `SELECT l.log_id, l.action, l.entity_type, l.entity_id,
              l.ip_address, l.created_at,
              u.first_name || ' ' || u.last_name AS user_name
       FROM system_logs l
       LEFT JOIN users u ON l.user_id = u.user_id
       ORDER BY l.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    )
    res.json({ data: result.rows })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

module.exports = {
  getTemplates, getTemplateById, createTemplate, updateTemplate, deleteTemplate,
  getUsers, updateUserStatus,
  getContracts, updateContractStatus, getStats, getLogs,
}