// ══════════════════════════════════════════════════════
// contractTemplate.controller.js
// Гэрээний загвар (template) харах. contract.controller.js-аас
// салгасан — бизнес логик өөрчлөгдөөгүй.
// ══════════════════════════════════════════════════════

const repo                 = require('../repositories/contract.repository')
const { safeErrorMessage } = require('../utils/errors')

// ── Template-уудыг харах ──────────────────────────────

const getTemplates = async (req, res) => {
  try {
    const rows = await repo.findActiveTemplates()
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

module.exports = {
  getTemplates,
  getTemplateById,
}
