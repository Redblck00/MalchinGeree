const repo = require('../repositories/admin.repository')
const { log, LOG } = require('../utils/logger')
const { safeErrorMessage } = require('../utils/errors')

// ── TEMPLATE ──────────────────────────────────────────

const getTemplates = async (req, res) => {
  try {
    const rows = await repo.findAllTemplates()
    res.json({ data: rows })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

const getTemplateById = async (req, res) => {
  try {
    const template = await repo.findTemplateById(req.params.id)
    if (!template) return res.status(404).json({ message: 'Загвар олдсонгүй' })
    res.json({ data: template })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

const createTemplate = async (req, res) => {
  try {
    const { name, template_content, schema_json, is_standard = false, is_offline_enabled = false, description } = req.body

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

    const template = await repo.insertTemplate({
      name,
      description: description || null,
      content:     template_content,
      schema:      parsedSchema,
      isStandard:  is_standard,
      isOfflineEnabled: is_offline_enabled,
      createdBy:   req.user.user_id,
    })

    await log({
      user_id: req.user.user_id,
      action: LOG.TEMPLATE_CREATE,
      entity_type: 'template',
      entity_id: template.template_id,
      req,
    })

    res.status(201).json({ message: 'Загвар амжилттай үүслээ', data: template })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

const updateTemplate = async (req, res) => {
  try {
    const { name, template_content, schema_json, is_standard, description, is_active, is_offline_enabled } = req.body
    const template = await repo.updateTemplate({
      id:          req.params.id,
      name:        name || null,
      description: description || null,
      content:     template_content || null,
      schema:      schema_json ? (typeof schema_json === 'string' ? JSON.parse(schema_json) : schema_json) : null,
      isStandard:  is_standard !== undefined ? is_standard : null,
      isActive:    is_active   !== undefined ? is_active   : null,
      isOfflineEnabled: is_offline_enabled !== undefined ? is_offline_enabled : null,
    })
    if (!template) return res.status(404).json({ message: 'Загвар олдсонгүй' })
    res.json({ data: template })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

const deleteTemplate = async (req, res) => {
  try {
    await repo.deleteTemplateById(req.params.id)
    res.json({ message: 'Загвар устгагдлаа' })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ── ХЭРЭГЛЭГЧ ─────────────────────────────────────────

const getUsers = async (req, res) => {
  try {
    const rows = await repo.findAllUsers()
    res.json({ data: rows })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

const updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body
    const valid = ['ACTIVE', 'SUSPENDED', 'DELETED']
    if (!valid.includes(status)) return res.status(400).json({ message: 'Буруу статус' })
    const updated = await repo.updateUserStatus(req.params.id, status)
    if (!updated) return res.status(404).json({ message: 'Хэрэглэгч олдсонгүй' })
    res.json({ data: updated })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ── ГЭРЭЭ ─────────────────────────────────────────────

const updateContractStatus = async (req, res) => {
  try {
    const { status } = req.body
    const valid = ['DRAFT', 'PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED']
    if (!valid.includes(status)) return res.status(400).json({ message: 'Буруу статус' })
    const updated = await repo.updateContractStatus(req.params.id, status)
    if (!updated) return res.status(404).json({ message: 'Гэрээ олдсонгүй' })
    res.json({ data: updated })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

const getContracts = async (req, res) => {
  try {
    const rows = await repo.findAllContracts()
    res.json({ data: rows })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ── ТАЙЛАН ────────────────────────────────────────────

const getStats = async (req, res) => {
  try {
    const [users, contracts, templates] = await Promise.all([
      repo.countUserStats(),
      repo.countContractStats(),
      repo.countActiveTemplates(),
    ])
    res.json({
      data: {
        users,
        contracts,
        templates,
      },
    })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ── ЗОЧДЫН ТАЙЛАН (нэвтрээгүй хандалт) ────────────────
// GET /api/admin/reports/visits?days=30
//   → KPI + өдрийн series + top paths + browser/referer breakdown
const getVisitReport = async (req, res) => {
  try {
    const days = Math.max(1, Math.min(parseInt(req.query.days) || 30, 365))

    const [kpi, series, topPaths, topReferers, sourceMix, hourly] = await Promise.all([
      repo.findVisitKpi(days),
      repo.findVisitSeries(days),
      repo.findVisitTopPaths(days),
      repo.findVisitTopReferers(days),
      repo.findVisitSourceMix(days),
      repo.findVisitHourly(days),
    ])

    res.json({
      data: {
        range_days:  days,
        kpi,
        series,
        top_paths:    topPaths,
        top_referers: topReferers,
        source_mix:   sourceMix,
        hourly,
      },
    })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ── ЛОГ ───────────────────────────────────────────────

const getLogs = async (req, res) => {
  try {
    const limit  = parseInt(req.query.limit)  || 50
    const offset = parseInt(req.query.offset) || 0
    const rows = await repo.findSystemLogs(limit, offset)
    res.json({ data: rows })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

module.exports = {
  getTemplates, getTemplateById, createTemplate, updateTemplate, deleteTemplate,
  getUsers, updateUserStatus,
  getContracts, updateContractStatus, getStats, getLogs,
  getVisitReport,
}
