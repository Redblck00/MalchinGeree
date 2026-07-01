const express = require('express')
const router  = express.Router()
const { query }       = require('../config/db')
const { verifyBlock } = require('../utils/blockchain')
const { safeErrorMessage } = require('../utils/errors')
const { recordVisit } = require('../middlewares/visitor.middleware')

// ── POST /api/public/visit ─────────────────────────────
// Frontend client component pages мэдэгдэх ping (home, login, register).
// Body: { path: '/login', referer?: '...' } — source='page' гэж тэмдэглэнэ.
router.post('/visit', (req, res) => {
  recordVisit(req, 'page')
  res.status(204).end()
})

// ── GET /api/public/templates ─────────────────────────
// Бүх идэвхтэй гэрээний загварыг (нэвтрээгүй ч) харах
router.get('/templates', async (req, res) => {
  try {
    // schema_json (хүнд JSONB) хасав — public жагсаалтын карт зөвхөн
    // name/description/is_standard-г үзүүлдэг. Дэлгэрэнгүй (schema_json) нь
    // /public/templates/:id-аар preview нээхэд тусдаа татагдана.
    const result = await query(
      `SELECT template_id, name, description,
              is_standard, created_at
       FROM contract_templates
       WHERE is_active = true
       ORDER BY is_standard DESC, created_at DESC`
    )
    res.json({ data: result.rows })
  } catch (err) {
    res.status(400).json({ message: safeErrorMessage(err) })
  }
})

// ── GET /api/public/templates/:id ─────────────────────
// Нэг загварын бүтэн агуулга (preview-д ашиглана)
router.get('/templates/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT template_id, name, description, template_content,
              schema_json, is_standard, created_at
       FROM contract_templates
       WHERE template_id = $1 AND is_active = true`,
      [req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Загвар олдсонгүй' })
    res.json({ data: result.rows[0] })
  } catch (err) {
    res.status(400).json({ message: safeErrorMessage(err) })
  }
})

// ══════════════════════════════════════════════════════
// CONTRACT VERIFY (QR scan → blockchain integrity шалгана)
// GET /api/public/verify/:id
// ══════════════════════════════════════════════════════
router.get('/verify/:id', async (req, res) => {
  try {
    const { id } = req.params

    // 1. Гэрээний мэдээлэл
    const cRes = await query(
      `SELECT c.contract_id, c.contract_number, c.title,
              c.status, c.completed_at, c.created_at,
              creator.first_name AS creator_first_name,
              creator.last_name  AS creator_last_name,
              t.name AS template_name
       FROM contracts c
       LEFT JOIN users creator ON c.creator_id = creator.user_id
       LEFT JOIN contract_templates t ON c.template_id = t.template_id
       WHERE c.contract_id = $1`,
      [id]
    )
    const contract = cRes.rows[0]
    if (!contract) return res.status(404).json({ message: 'Гэрээ олдсонгүй' })

    // 2. contract_versions — ганц row per contract (Migration 007)
    const verRes = await query(
      `SELECT version_id, rendered_hash,
              blockchain_hash, blockchain_at, blockchain_tx_id, qr_code_url
       FROM contract_versions
       WHERE contract_id = $1`,
      [id]
    )
    const ver = verRes.rows[0]

    // 3. Хэрэв blockchain бүртгэлтэй бол блокыг татах + integrity шалгах
    let block       = null
    let chainValid  = false
    let hashMatch   = false
    if (ver?.blockchain_tx_id) {
      const blkRes = await query(
        `SELECT block_id, block_number, previous_hash, contract_hash,
                timestamp, block_hash, onchain_tx_hash, onchain_network
         FROM blockchain_ledger
         WHERE block_id = $1`,
        [ver.blockchain_tx_id]
      )
      block = blkRes.rows[0]
      if (block) {
        chainValid = verifyBlock(block)
        hashMatch  = block.contract_hash === ver.rendered_hash
      }
    }

    // 4. Оролцогчдын ерөнхий мэдээлэл (бүртгэлгүй ч харах боломжтой)
    const partRes = await query(
      `SELECT cp.role, cp.status,
              u.first_name, u.last_name
       FROM contract_participants cp
       LEFT JOIN users u ON cp.user_id = u.user_id
       WHERE cp.contract_id = $1`,
      [id]
    )

    res.json({
      data: {
        contract: {
          contract_id:     contract.contract_id,
          contract_number: contract.contract_number,
          title:           contract.title,
          status:          contract.status,
          template_name:   contract.template_name,
          completed_at:    contract.completed_at,
          created_at:      contract.created_at,
          creator_name:    `${contract.creator_last_name || ''} ${contract.creator_first_name || ''}`.trim(),
        },
        participants: partRes.rows.map(p => ({
          role:   p.role,
          status: p.status,
          name:   `${p.last_name || ''} ${p.first_name || ''}`.trim() || '—',
        })),
        verification: {
          is_completed:    contract.status === 'COMPLETED',
          has_blockchain:  !!block,
          chain_valid:     chainValid,
          hash_match:      hashMatch,
          rendered_hash:   ver?.rendered_hash || null,
          block,
        },
      },
    })
  } catch (err) {
    console.error(err)
    res.status(400).json({ message: safeErrorMessage(err) })
  }
})

module.exports = router
