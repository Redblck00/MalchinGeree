const express = require('express')
const router  = express.Router()
const admin   = require('../controllers/admin.controller')
const auth    = require('../middlewares/auth.middleware')
const role    = require('../middlewares/role.middleware')

// Бүх admin route → JWT + ADMIN эрх шалгана
router.use(auth)
router.use(role('ADMIN'))

// ── ТАЙЛАН ────────────────────────────────────────────
// GET /api/admin/stats
router.get('/stats',                  admin.getStats)

// GET /api/admin/reports/visits?days=30
// → Нэвтрээгүй зочдын статистик (KPI + series + top paths/referers)
router.get('/reports/visits',         admin.getVisitReport)

// ── TEMPLATE ──────────────────────────────────────────
// GET    /api/admin/templates
router.get('/templates',              admin.getTemplates)

// GET    /api/admin/templates/:id  → бүтэн template (template_content-той)
router.get('/templates/:id',          admin.getTemplateById)

// POST   /api/admin/templates
// Body (JSON): { name, description, template_content, schema_json, is_standard }
router.post('/templates',             admin.createTemplate)

// PATCH  /api/admin/templates/:id
// Body (JSON): { name?, description?, template_content?, schema_json?, is_standard?, is_active? }
router.patch('/templates/:id',        admin.updateTemplate)

// DELETE /api/admin/templates/:id
router.delete('/templates/:id',       admin.deleteTemplate)

// ── ХЭРЭГЛЭГЧ ─────────────────────────────────────────
// GET   /api/admin/users
router.get('/users',                  admin.getUsers)

// PATCH /api/admin/users/:id/status
// Body: { status: 'ACTIVE' | 'SUSPENDED' | 'DELETED' }
router.patch('/users/:id/status',     admin.updateUserStatus)

// ── ГЭРЭЭ ─────────────────────────────────────────────
// GET /api/admin/contracts
router.get('/contracts',              admin.getContracts)

// PATCH /api/admin/contracts/:id/status
// Body: { status }
router.patch('/contracts/:id/status', admin.updateContractStatus)

// ── ЛОГ ───────────────────────────────────────────────
// GET /api/admin/logs?limit=50&offset=0
router.get('/logs',                   admin.getLogs)

module.exports = router