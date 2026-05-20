const crypto              = require('crypto')
const { query }           = require('../config/db')
const { renderContract, renderPreview, extractPlaceholders } = require('../utils/render')
const { sendInviteEmail, sendContractEventEmail } = require('../utils/email')
const { log, LOG }        = require('../utils/logger')
const { notify, notifyParticipants } = require('../utils/notifier')
const { addBlock }                   = require('../utils/blockchain')
const { generateQRDataUrl }          = require('../utils/qrcode')
// ── Invitation token tools
const generateInviteToken = () => crypto.randomBytes(32).toString('hex')
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')
// ── JSON diff — Засварлахад өөрчлөгдсөн талбаруудыг л буцаана ──
// { "seller.phone": { old: "99...", new: "88..." }, ... }
// Массив (livestock гэх мэт) бол бүхлээр нь харьцуулж хадгална.
function computeJsonDiff(oldObj, newObj, prefix = '') {
  const diff = {}
  const keys = new Set([
    ...Object.keys(oldObj || {}),
    ...Object.keys(newObj || {}),
  ])
  for (const k of keys) {
    const a = oldObj ? oldObj[k] : undefined
    const b = newObj ? newObj[k] : undefined
    const path = prefix ? `${prefix}.${k}` : k

    const aIsObj = a && typeof a === 'object' && !Array.isArray(a)
    const bIsObj = b && typeof b === 'object' && !Array.isArray(b)

    if (aIsObj && bIsObj) {
      Object.assign(diff, computeJsonDiff(a, b, path))
    } else if (JSON.stringify(a) !== JSON.stringify(b)) {
      diff[path] = { old: a ?? null, new: b ?? null }
    }
  }
  return diff
}

// ── Template-уудыг харах ──────────────────────────────

const getTemplates = async (req, res) => {
  try {
    const result = await query(
      `SELECT template_id, name, description, is_standard, schema_json, created_at
       FROM contract_templates
       WHERE is_active = true
       ORDER BY is_standard DESC, created_at DESC`
    )
    res.json({ data: result.rows })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

const getTemplateById = async (req, res) => {
  try {
    const result = await query(
      `SELECT template_id, name, description, schema_json, is_standard
       FROM contract_templates
       WHERE template_id = $1 AND is_active = true`,
      [req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Загвар олдсонгүй' })
    res.json({ data: result.rows[0] })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── Гэрээ үүсгэх ─────────────────────────────────────
// 1. template_content + filled_data_json → Handlebars render
// 2. contracts хүснэгтэд хадгалах
// 3. contract_versions-д snapshot хадгалах
// 4. creator-г participant болгон нэмэх

const createContract = async (req, res) => {
  try {
    const {
      template_id, title,
      filled_data_json = {},
      creator_role = 'seller',
    } = req.body
    if (!template_id) return res.status(400).json({ message: 'Template ID шаардлагатай' })
    if (!['seller', 'buyer'].includes(creator_role)) {
      return res.status(400).json({ message: 'creator_role нь "seller" эсвэл "buyer" байх ёстой' })
    }

    // Template авах
    const tmplRes = await query(
      `SELECT template_id, name, template_content, schema_json
       FROM contract_templates WHERE template_id = $1 AND is_active = true`,
      [template_id]
    )
    const tmpl = tmplRes.rows[0]
    if (!tmpl) return res.status(404).json({ message: 'Загвар олдсонгүй' })

    // Хэрэглэгчийн мэдээлэл — сонгосон role-д auto-fill хийнэ
    const userInfo = {
      name:    `${req.user.last_name} ${req.user.first_name}`.trim(),
      phone:   req.user.phone   || '',
      email:   req.user.email   || '',
      address: req.user.address || '',
    }

    const enriched = { ...filled_data_json }
    if (creator_role === 'seller') {
      enriched.seller = { ...(filled_data_json.seller || {}), ...userInfo }
    } else {
      enriched.buyer  = { ...(filled_data_json.buyer  || {}), ...userInfo }
    }
    // Гэрээ үүсгэх — contract_number trigger-аар автомат орно
    const contractRes = await query(
      `INSERT INTO contracts (template_id, creator_id, title, filled_data_json, creator_role)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING contract_id, contract_number, title, status, creator_role, created_at`,
      [template_id, req.user.user_id, title || tmpl.name, enriched, creator_role]
    )
    const contract = contractRes.rows[0]

    // contract_number авсны дараа render хийх — он/сар/өдөр-ийг meta-аар дамжуулна
    const now = new Date()
    const { rendered, hash } = renderContract(
      tmpl.template_content,
      tmpl.schema_json,
      enriched,
      {
        contract_number: contract.contract_number,
        year:  now.getFullYear().toString(),
        month: (now.getMonth() + 1).toString(),
        day:   now.getDate().toString(),
      }
    )

    // contract_versions — ганц row per contract (Migration 007)
    const versionRes = await query(
      `INSERT INTO contract_versions
         (contract_id, rendered_content, rendered_hash)
       VALUES ($1, $2, $3)
       RETURNING version_id`,
      [contract.contract_id, rendered, hash]
    )

    // Creator-г CREATOR role-той participant болгон нэмэх
    // Status='VIEWED' — бодит signature_blob орохоос өмнө 'SIGNED' болгохгүй.
    // /sign endpoint signature оруулсны дараа trigger автоматаар SIGNED болгоно.
    await query(
      `INSERT INTO contract_participants
         (contract_id, user_id, role, status)
       VALUES ($1,$2,'CREATOR','VIEWED')`,
      [contract.contract_id, req.user.user_id]
    )

    await log({
      user_id: req.user.user_id,
      action: LOG.CONTRACT_CREATE,
      entity_type: 'contract',
      entity_id: contract.contract_id,
      req,
    })

    res.status(201).json({
      message: 'Гэрээ амжилттай үүслээ',
      data: {
        ...contract,
        rendered_content: rendered,
        version_id: versionRes.rows[0].version_id,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(400).json({ message: err.message })
  }
}

// ── Миний гэрээнүүд ───────────────────────────────────

const getMyContracts = async (req, res) => {
  try {
    const result = await query(
      `SELECT c.contract_id, c.contract_number, c.title, c.status,
              c.creator_role, c.current_turn, c.created_at, c.updated_at,
              t.name AS template_name,
              cp.role AS my_role,
              cp.status AS my_status
       FROM contracts c
       JOIN contract_participants cp
         ON cp.contract_id = c.contract_id AND cp.user_id = $1
       LEFT JOIN contract_templates t ON c.template_id = t.template_id
       ORDER BY c.created_at DESC`,
      [req.user.user_id]
    )
    res.json({ data: result.rows })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── Нэг гэрээний дэлгэрэнгүй ─────────────────────────

const getContractById = async (req, res) => {
  try {
    const { id } = req.params

    // Оролцогч эсэх шалгах
    const partRes = await query(
      `SELECT participant_id, role, status FROM contract_participants
       WHERE contract_id = $1 AND user_id = $2`,
      [id, req.user.user_id]
    )
    if (!partRes.rows[0]) return res.status(403).json({ message: 'Харах эрх байхгүй' })

    // Гэрээний мэдээлэл — template_content-ийг ч авна (re-render-д хэрэгтэй)
    const cRes = await query(
      `SELECT c.*, t.name AS template_name, t.schema_json, t.template_content
       FROM contracts c
       LEFT JOIN contract_templates t ON c.template_id = t.template_id
       WHERE c.contract_id = $1`,
      [id]
    )
    const contract = cRes.rows[0]
    if (!contract) return res.status(404).json({ message: 'Гэрээ олдсонгүй' })

    // contract_versions — ганц row (Migration 007)
    const verRes = await query(
      `SELECT version_id, rendered_content, rendered_hash,
              pdf_url, qr_code_url,
              blockchain_hash, blockchain_at, blockchain_tx_id,
              created_at
       FROM contract_versions
       WHERE contract_id = $1`,
      [id]
    )
    // Version байхгүй бол (DRAFT) preview render хийнэ
    let latestVersion = verRes.rows[0] || null
    if (!latestVersion && contract.template_content) {
      const { rendered } = renderPreview(
        contract.template_content,
        contract.schema_json,
        contract.filled_data_json,
        { contract_number: contract.contract_number }
      )
      latestVersion = { rendered_content: rendered, is_preview: true }
    }
    // ── Backfill: COMPLETED ч QR-гүй бол блок + QR-ийг автомат үүсгэх ──
    // (Migration 006 хийгээгүй үед confirmContract failed silently тохиолдолд)
    if (contract.status === 'COMPLETED' && latestVersion?.version_id
        && !latestVersion.qr_code_url) {
      try {
        let blockHash = latestVersion.blockchain_hash
        let blockAt   = latestVersion.blockchain_at
        let blockTxId = latestVersion.blockchain_tx_id

        if (!blockTxId && latestVersion.rendered_hash) {
          const block = await addBlock(id, latestVersion.rendered_hash)
          blockHash = block.block_hash
          blockAt   = block.timestamp
          blockTxId = block.block_id
        }

        const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify/${id}`
        const qrDataUrl = await generateQRDataUrl(verifyUrl)

        await query(
          `UPDATE contract_versions
           SET blockchain_hash = COALESCE(blockchain_hash, $1),
               blockchain_at   = COALESCE(blockchain_at, $2),
               blockchain_tx_id = COALESCE(blockchain_tx_id, $3),
               qr_code_url     = $4
           WHERE version_id = $5`,
          [blockHash, blockAt, blockTxId, qrDataUrl, latestVersion.version_id]
        )

        latestVersion.blockchain_hash  = blockHash
        latestVersion.blockchain_at    = blockAt
        latestVersion.blockchain_tx_id = blockTxId
        latestVersion.qr_code_url      = qrDataUrl
      } catch (err) {
        console.error('QR backfill failed:', err.message)
      }
    }
    // Оролцогчид — profile_image_url + үнэлгээний дундаж/тоо хамт
    const partListRes = await query(
      `SELECT cp.participant_id, cp.user_id, cp.role, cp.status,
              cp.invite_email, cp.invite_phone, cp.signed_at,
              u.first_name, u.last_name, u.phone, u.email,
              u.profile_image_url,
              COALESCE(urs.rating_avg, 0)::FLOAT AS rating_avg,
              COALESCE(urs.rating_count, 0)::INT AS rating_count
       FROM contract_participants cp
       LEFT JOIN users u                ON cp.user_id = u.user_id
       LEFT JOIN user_rating_summary urs ON urs.user_id = cp.user_id
       WHERE cp.contract_id = $1`,
      [id]
    )
    // Гарын үсгүүд
    const sigRes = await query(
      `SELECT cs.signature_id, cs.placeholder_key, cs.signed_at,
              cs.participant_id, cs.signature_blob,
              cp.role
       FROM contract_signatures cs
       JOIN contract_participants cp ON cs.participant_id = cp.participant_id
       WHERE cs.contract_id = $1`,
      [id]
    )

    // Хавсралт материал
    const attRes = await query(
      `SELECT a.attachment_id, a.file_name, a.file_url, a.file_type,
              a.file_size, a.sort_order, a.created_at, a.uploaded_by,
              u.first_name AS uploader_first_name,
              u.last_name  AS uploader_last_name
       FROM contract_attachments a
       LEFT JOIN users u ON u.user_id = a.uploaded_by
       WHERE a.contract_id = $1
       ORDER BY a.sort_order, a.created_at`,
      [id]
    )
    // ── Display зориулалтаар гарын үсэгтэй дахин рендер ──
    // schema-д signature key-уудыг нэмж, filled_data-д <img> blob нэмнэ
    if (contract.template_content && sigRes.rows.length > 0) {
      const baseFields = contract.schema_json?.fields || []
      const sigFields  = sigRes.rows.map(s => ({
        type: 'signature',
        key:  s.placeholder_key,
      }))
      const displaySchema = { ...contract.schema_json, fields: [...baseFields, ...sigFields] }

      // filled_data-д nested signature blob тавих
      const displayData = JSON.parse(JSON.stringify(contract.filled_data_json || {}))
      sigRes.rows.forEach(s => {
        const imgHtml = `<img src="${s.signature_blob}" alt="signature" style="max-height:60px;display:inline-block;vertical-align:middle"/>`
        const parts = s.placeholder_key.split('.')
        if (parts.length === 2) {
          if (!displayData[parts[0]]) displayData[parts[0]] = {}
          displayData[parts[0]][parts[1]] = imgHtml
        } else {
          displayData[s.placeholder_key] = imgHtml
        }
      })

      const created = new Date(contract.created_at)
      try {
        const { rendered: signedRendered } = renderContract(
          contract.template_content,
          displaySchema,
          displayData,
          {
            contract_number: contract.contract_number,
            year:  String(created.getFullYear()),
            month: String(created.getMonth() + 1),
            day:   String(created.getDate()),
          }
        )
        latestVersion = { ...latestVersion, rendered_content: signedRendered }
      } catch (_) { /* re-render амжилтгүй бол оригинал хэвээр */ }
    }
    res.json({
      data: {
        ...contract,
        template_content: undefined, // frontend-д буцаахгүй (нууц)
        my_role:        partRes.rows[0].role,
        my_status:      partRes.rows[0].status,
        latest_version: latestVersion,
        participants:   partListRes.rows,
        signatures:     sigRes.rows,
        attachments:    attRes.rows,
      },
    })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}
// ── Гэрээ засах (DRAFT үед, үүсгэгч) ──────────────────
// Migration 007-н дараа:
//   • contract_versions — ганц row, UPDATE хийнэ (INSERT биш)
//   • contract_edit_log — JSON diff аудит-д INSERT
//   • Гарын үсэг зурагдсан бол засах боломжгүй (LOCKED)
// Анхаар: Шинэ урсгал (counterparty засаж буцаах) дараагийн endpoint-д
// тусдаа хийгдэнэ. Энд зөвхөн үүсгэгчийн DRAFT засах flow.

const updateContract = async (req, res) => {
  try {
    const { id } = req.params
    const { filled_data_json, title } = req.body

    const cRes = await query(
      `SELECT c.contract_id, c.contract_number, c.status, c.creator_id, c.current_turn,
              c.filled_data_json, c.title,
              cp.role AS my_role,
              t.template_content, t.schema_json
       FROM contracts c
       LEFT JOIN contract_participants cp
         ON cp.contract_id = c.contract_id AND cp.user_id = $2
       LEFT JOIN contract_templates t ON c.template_id = t.template_id
       WHERE c.contract_id = $1`,
      [id, req.user.user_id]
    )
    const contract = cRes.rows[0]
    if (!contract) return res.status(404).json({ message: 'Гэрээ олдсонгүй' })

    // Permission: DRAFT — зөвхөн creator, SENT — current_turn-той тал л засна
    const isCreator = contract.creator_id === req.user.user_id
    if (contract.status === 'DRAFT') {
      if (!isCreator) return res.status(403).json({ message: 'Зөвхөн үүсгэгч засах эрхтэй' })
    } else if (contract.status === 'SENT') {
      if (!contract.my_role || contract.my_role !== contract.current_turn) {
        return res.status(403).json({ message: 'Одоо таны ээлж биш байна' })
      }
    } else {
      return res.status(400).json({ message: 'Энэ статуст засах боломжгүй' })
    }

    // Гарын үсэг зурагдсан эсэхийг шалгах (LOCK)
    const sigRes = await query(
      `SELECT 1 FROM contract_signatures WHERE contract_id = $1 LIMIT 1`,
      [id]
    )
    if (sigRes.rows[0]) {
      return res.status(400).json({ message: 'Гарын үсэг зурагдсан гэрээг засаж болохгүй' })
    }

    const oldData = contract.filled_data_json || {}
    const newData = filled_data_json || oldData

    // ── Дахин render хийх ──────────────────────────────
    const { rendered, hash } = renderContract(
      contract.template_content,
      contract.schema_json,
      newData,
      { contract_number: contract.contract_number }
    )

    // ── contract_versions UPDATE (ганц row) ───────────
    await query(
      `UPDATE contract_versions
         SET rendered_content = $1,
             rendered_hash    = $2
       WHERE contract_id = $3`,
      [rendered, hash, id]
    )

    // ── contracts шинэчлэх ────────────────────────────
    const updated = await query(
      `UPDATE contracts
         SET filled_data_json = $1,
             title            = COALESCE($2, title),
             updated_at       = NOW()
       WHERE contract_id = $3
       RETURNING contract_id, contract_number, title, status`,
      [newData, title || null, id]
    )

    // ── Аудит — өөрчлөгдсөн талбаруудыг л log хийх ────
    const diff = computeJsonDiff(oldData, newData)
    if (Object.keys(diff).length > 0) {
      await query(
        `INSERT INTO contract_edit_log (contract_id, edited_by, changed_fields)
         VALUES ($1, $2, $3)`,
        [id, req.user.user_id, JSON.stringify(diff)]
      )
    }

    await log({
      user_id: req.user.user_id,
      action: LOG.CONTRACT_UPDATE,
      entity_type: 'contract',
      entity_id: id,
      details: { changed_keys: Object.keys(diff) },
      req,
    })

    res.json({
      data: {
        ...updated.rows[0],
        rendered_content: rendered,
        changed_fields_count: Object.keys(diff).length,
      },
    })
  } catch (err) {
    console.error('updateContract error:', err)
    res.status(400).json({ message: err.message })
  }
}

// ── Гэрээ илгээх ─────────────────────────────────────

const sendContract = async (req, res) => {
  try {
    const { id } = req.params
    const { participants } = req.body
    // participants: [{ role: 'COUNTERPARTY', email, phone, user_id? }]

    const cRes = await query(
      `SELECT contract_id, contract_number, title, status, creator_id
       FROM contracts WHERE contract_id = $1`,
      [id]
    )
    const contract = cRes.rows[0]
    if (!contract) return res.status(404).json({ message: 'Гэрээ олдсонгүй' })
    if (contract.creator_id !== req.user.user_id) return res.status(403).json({ message: 'Илгээх эрх байхгүй' })
    if (contract.status !== 'DRAFT') return res.status(400).json({ message: 'Аль хэдийн илгээгдсэн' })

    const added = []
    for (const p of participants || []) {
      const partRes = await query(
        `INSERT INTO contract_participants
           (contract_id, user_id, role, invite_email, invite_phone, status, invited_at)
         VALUES ($1,$2,$3,$4,$5,'INVITED',NOW())
         ON CONFLICT DO NOTHING
         RETURNING participant_id, role, invite_email`,
        [id, p.user_id || null, p.role || 'COUNTERPARTY', p.email || null, p.phone || null]
      )
      if (partRes.rows[0]) {
        added.push(partRes.rows[0])

        // ── Invitation token үүсгэж participant_invitations-д хадгалах ──
        const token     = generateInviteToken()
        const tokenHash = hashToken(token)
        await query(
          `INSERT INTO participant_invitations
             (participant_id, token_hash, sent_to_email, sent_to_phone)
           VALUES ($1, $2, $3, $4)`,
          [partRes.rows[0].participant_id, tokenHash, p.email || null, p.phone || null]
        )

        // Имейлээр урилга илгээх (token-той link)
        if (p.email) {
          const inviteUrl = `${process.env.FRONTEND_URL}/invite/${token}`
          await sendInviteEmail({
            to: p.email,
            contractTitle: contract.title,
            inviteUrl,
            senderName: `${req.user.last_name} ${req.user.first_name}`,
          }).catch(console.error)
        }

        // Бүртгэлтэй хэрэглэгч бол in-app мэдэгдэл
        if (p.user_id) {
          await notify({
            user_id:     p.user_id,
            contract_id: id,
            title:       'Танд гэрээ ирлээ',
            message:     `"${contract.title}" гэрээнд оролцохыг урилаа`,
          })
        }
      }
    }

    // Contract-г SENT болгох + ээлж нөгөө талд шилжих
    await query(
      `UPDATE contracts
         SET status       = 'SENT',
             current_turn = 'COUNTERPARTY',
             sent_at      = NOW(),
             updated_at   = NOW()
       WHERE contract_id = $1`,
      [id]
    )

    await log({ user_id: req.user.user_id, action: LOG.CONTRACT_SEND, entity_type: 'contract', entity_id: id, req })
    res.json({ message: 'Гэрээ илгээгдлээ', data: { participants: added } })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── Гарын үсэг зурах ─────────────────────────────────

const signContract = async (req, res) => {
  try {
    const { id } = req.params
    const { signature_blob, placeholder_key = 'signature' } = req.body
    if (!signature_blob) return res.status(400).json({ message: 'Гарын үсэг шаардлагатай' })

    // Оролцогч шалгах
    const partRes = await query(
      `SELECT participant_id, role, status FROM contract_participants
       WHERE contract_id = $1 AND user_id = $2`,
      [id, req.user.user_id]
    )
    const part = partRes.rows[0]
    if (!part) return res.status(403).json({ message: 'Энэ гэрээнд оролцогч биш' })
    if (part.status === 'SIGNED') return res.status(400).json({ message: 'Аль хэдийн гарын үсэг зурсан' })

    // contract_versions — ганц row per contract (Migration 007)
    const verRes = await query(
      `SELECT version_id FROM contract_versions WHERE contract_id = $1`,
      [id]
    )
    if (!verRes.rows[0]) return res.status(400).json({ message: 'Гэрээний хувилбар олдсонгүй' })

    // Гарын үсэг хадгалах
    await query(
      `INSERT INTO contract_signatures
         (contract_id, participant_id, version_id, placeholder_key, signature_blob,
          signed_ip, signed_user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (contract_id, participant_id, placeholder_key) DO UPDATE
       SET signature_blob = EXCLUDED.signature_blob, signed_at = NOW()`,
      [id, part.participant_id, verRes.rows[0].version_id, placeholder_key,
       signature_blob, req.ip, req.headers['user-agent']]
    )
    // → after_signature_insert trigger: participant.status = SIGNED
    // → after_participant_signed trigger: contract.status шинэчлэгдэнэ

    await log({ user_id: req.user.user_id, action: LOG.CONTRACT_SIGN, entity_type: 'contract', entity_id: id, req })

    // ── Ээлж шилжүүлэх (нөгөө тал зурах ёстой) ──────
    // FULLY_SIGNED болсон үед current_turn = NULL (хэн ч хүлээхгүй)
    const nextTurn = part.role === 'CREATOR' ? 'COUNTERPARTY' : 'CREATOR'
    await query(
      `UPDATE contracts
         SET current_turn = CASE WHEN status = 'FULLY_SIGNED' THEN NULL ELSE $1::participant_role_enum END,
             updated_at   = NOW()
       WHERE contract_id = $2`,
      [nextTurn, id]
    )

    // ── Notification logic ──────────────────────────
    const updated = await query(
      `SELECT c.contract_id, c.status, c.title, c.creator_id, c.current_turn
       FROM contracts c WHERE c.contract_id = $1`,
      [id]
    )
    const updatedContract = updated.rows[0]
    const signerName = `${req.user.last_name} ${req.user.first_name}`.trim()

    // Эсрэг талын user_id + email-г олж IN_APP + EMAIL хосоор мэдэгдэх
    const otherSideRole = part.role === 'CREATOR' ? 'COUNTERPARTY' : 'CREATOR'
    const otherRes = await query(
      `SELECT cp.user_id, cp.invite_email, u.email AS user_email
       FROM contract_participants cp
       LEFT JOIN users u ON u.user_id = cp.user_id
       WHERE cp.contract_id = $1 AND cp.role = $2
       LIMIT 1`,
      [id, otherSideRole]
    )
    const other = otherRes.rows[0]
    const contractUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/contracts/${id}`

    if (other?.user_id) {
      await notify({
        user_id:     other.user_id,
        contract_id: id,
        title:       'Гэрээнд гарын үсэг зурлаа',
        message:     `${signerName} "${updatedContract.title}" гэрээнд гарын үсэг зурлаа`,
      })
    }
    const otherEmail = other?.user_email || other?.invite_email
    if (otherEmail) {
      sendContractEventEmail({
        to:            otherEmail,
        contractTitle: updatedContract.title,
        actorName:     signerName,
        eventType:     'SIGNED',
        contractUrl,
      }).catch(err => console.error('sign email failed:', err.message))
    }

    // Бүгд гарын үсэг зурсан (FULLY_SIGNED) → үүсгэгчид баталгаажуулах гэдгийг мэдэгдэх
    if (updatedContract.status === 'FULLY_SIGNED') {
      await notify({
        user_id:     updatedContract.creator_id,
        contract_id: id,
        title:       'Гэрээ баталгаажуулахад бэлэн',
        message:     `"${updatedContract.title}" гэрээнд бүх оролцогч гарын үсэг зурсан. Та баталгаажуулна уу.`,
      })
    }

    res.json({
      message: 'Гарын үсэг зурагдлаа',
      data: {
        contract_status: updatedContract.status,
        current_turn:    updatedContract.current_turn,
      },
    })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ── Баталгаажуулах ────────────────────────────────────

const confirmContract = async (req, res) => {
  try {
    const { id } = req.params

    const cRes = await query(
      `SELECT contract_id, status, creator_id, creator_role, filled_data_json
       FROM contracts WHERE contract_id = $1`,
      [id]
    )
    const contract = cRes.rows[0]
    if (!contract) return res.status(404).json({ message: 'Гэрээ олдсонгүй' })
    if (contract.creator_id !== req.user.user_id) return res.status(403).json({ message: 'Эрх байхгүй' })
    if (contract.status !== 'FULLY_SIGNED') return res.status(400).json({ message: 'Бүх оролцогч гарын үсэг зурсан байх ёстой' })

    const verRes = await query(
      `SELECT version_id FROM contract_versions WHERE contract_id = $1`,
      [id]
    )

    await query(
      `INSERT INTO contract_confirmations (contract_id, confirmed_by, version_id, confirmed_ip, confirmed_user_agent)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, req.user.user_id, verRes.rows[0].version_id, req.ip, req.headers['user-agent']]
    )
    // → after_confirmation_insert trigger: status = COMPLETED

    // ── Малын гүйлгээ хадгалах ──────────────────────────
    // creator_role-аас seller/buyer-ийг тогтоож livestock_transactions-д INSERT
    try {
      const partRes = await query(
        `SELECT user_id, role FROM contract_participants
         WHERE contract_id = $1 AND user_id IS NOT NULL`,
        [id]
      )
      const counterparty = partRes.rows.find(p => p.role === 'COUNTERPARTY')
      const sellerId = contract.creator_role === 'seller' ? contract.creator_id : counterparty?.user_id
      const buyerId  = contract.creator_role === 'buyer'  ? contract.creator_id : counterparty?.user_id

      const livestock = contract.filled_data_json?.livestock || []
      if (sellerId && buyerId && livestock.length > 0) {
        for (const it of livestock) {
          const cnt   = parseInt(it.count) || 0
          const price = parseFloat(it.price_per_unit) || 0
          const type  = (it.livestock_type || '').toString().trim()
          if (cnt > 0 && type) {
            await query(
              `INSERT INTO livestock_transactions
                 (contract_id, seller_id, buyer_id, livestock_type,
                  count, price_per_unit, total_amount)
               VALUES ($1,$2,$3,$4,$5,$6,$7)`,
              [id, sellerId, buyerId, type, cnt, price, cnt * price]
            )
          }
        }
      }
    } catch (err) {
      console.error('Livestock INSERT failed:', err.message)
      // Гэрээ баталгаажсан хэвээр — статистик дутуу хадгалах нь main flow-ыг хаахгүй
    }

    await log({ user_id: req.user.user_id, action: LOG.CONTRACT_CONFIRM, entity_type: 'contract', entity_id: id, req })

    // ── Blockchain ledger-д бүртгэх + QR код үүсгэх ──
    try {
      const verRes = await query(
        `SELECT version_id, rendered_hash FROM contract_versions
         WHERE contract_id = $1`,
        [id]
      )
      const ver = verRes.rows[0]
      if (ver) {
        // 1. Шинэ блок үүсгэх
        const block = await addBlock(id, ver.rendered_hash)

        // 2. Public verification URL → QR
        const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify/${id}`
        const qrDataUrl = await generateQRDataUrl(verifyUrl)

        // 3. contract_versions-д blockchain мэдээллийг шинэчлэх
        await query(
          `UPDATE contract_versions
           SET blockchain_hash = $1,
               blockchain_at   = $2,
               blockchain_tx_id = $3,
               qr_code_url     = $4
           WHERE version_id = $5`,
          [block.block_hash, block.timestamp, block.block_id, qrDataUrl, ver.version_id]
        )
      }
    } catch (err) {
      console.error('Blockchain registration failed:', err.message)
      // Confirm амжилттай — blockchain дутуу хадгалалт main flow-ыг зогсоохгүй
    }

    // Бүх оролцогчдод (creator-аас бусад) баталгаажсан тухай мэдэгдэх
    const titleRes = await query(`SELECT title FROM contracts WHERE contract_id = $1`, [id])
    await notifyParticipants(id, {
      title:        'Гэрээ баталгаажлаа ✓',
      message:      `"${titleRes.rows[0]?.title || 'Гэрээ'}" амжилттай баталгаажиж, хүчин төгөлдөр болсон`,
      exceptUserId: req.user.user_id,
    })

    res.json({ message: 'Гэрээ баталгаажлаа' })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ══════════════════════════════════════════════════════
// Counterparty өөрийн талын мэдээлэл бөглөх
// PATCH /api/contracts/:id/counterparty-fill
// Body: { filled_data: { name, phone, email, address } }
// → contract.filled_data_json[my_role]-д nested merge хийнэ
// → шинэ version үүснэ
// ══════════════════════════════════════════════════════

const fillCounterpartyData = async (req, res) => {
  try {
    const { id } = req.params
    const { filled_data } = req.body
    if (!filled_data || typeof filled_data !== 'object') {
      return res.status(400).json({ message: 'filled_data шаардлагатай' })
    }

    // Гэрээ + миний participant role-ийг шалгах
    const cRes = await query(
      `SELECT c.contract_id, c.status, c.creator_role, c.creator_id,
              c.template_id, c.contract_number, c.title,
              c.filled_data_json,
              cp.role AS my_role, cp.status AS my_status,
              t.template_content, t.schema_json
       FROM contracts c
       JOIN contract_participants cp
         ON cp.contract_id = c.contract_id AND cp.user_id = $2
       LEFT JOIN contract_templates t ON c.template_id = t.template_id
       WHERE c.contract_id = $1`,
      [id, req.user.user_id]
    )
    const contract = cRes.rows[0]
    if (!contract) return res.status(404).json({ message: 'Гэрээ олдсонгүй эсвэл эрх байхгүй' })
    if (contract.my_role !== 'COUNTERPARTY') {
      return res.status(403).json({ message: 'Зөвхөн нөгөө тал бөглөх эрхтэй' })
    }
    if (contract.my_status === 'SIGNED') {
      return res.status(400).json({ message: 'Гарын үсэг зурсны дараа засаж болохгүй' })
    }
    if (['COMPLETED', 'CANCELLED', 'DECLINED', 'EXPIRED'].includes(contract.status)) {
      return res.status(400).json({ message: 'Гэрээний статус зөвшөөрөхгүй байна' })
    }

    // Counterparty-н role нь үүсгэгчийн эсрэг
    const myRoleKey = contract.creator_role === 'seller' ? 'buyer' : 'seller'

    // Зөвхөн миний талын талбарууд (name, phone, email, address) хадгална
    const allowedKeys = ['name', 'phone', 'email', 'address']
    const myInput = filled_data[myRoleKey] || filled_data
    const cleanInput = {}
    for (const k of allowedKeys) {
      if (myInput[k] != null) cleanInput[k] = String(myInput[k]).trim()
    }

    // filled_data_json дотор зөвхөн миний role-ын талбарыг merge хийнэ
    const newData = {
      ...(contract.filled_data_json || {}),
      [myRoleKey]: {
        ...((contract.filled_data_json || {})[myRoleKey] || {}),
        ...cleanInput,
      },
    }

    // Render meta — оригинал гэрээний огноог ашиглах нь хамгийн зөв
    const meta = {
      contract_number: contract.contract_number,
      year:  String(new Date().getFullYear()),
      month: String(new Date().getMonth() + 1),
      day:   String(new Date().getDate()),
    }

    let rendered = ''
    let hash     = ''
    if (contract.template_content && contract.schema_json) {
      const r = renderContract(contract.template_content, contract.schema_json, newData, meta)
      rendered = r.rendered
      hash     = r.hash
    }

    // ── contract_versions UPDATE (ганц row, Migration 007) ──
    if (rendered) {
      await query(
        `UPDATE contract_versions
           SET rendered_content = $1,
               rendered_hash    = $2
         WHERE contract_id = $3`,
        [rendered, hash, id]
      )
    }

    // ── contracts шинэчлэх ──
    await query(
      `UPDATE contracts
         SET filled_data_json = $1,
             updated_at       = NOW()
       WHERE contract_id = $2`,
      [newData, id]
    )

    // ── Аудит — өөрчлөгдсөн талбаруудыг л log хийх ──
    const diff = computeJsonDiff(contract.filled_data_json || {}, newData)
    if (Object.keys(diff).length > 0) {
      await query(
        `INSERT INTO contract_edit_log (contract_id, edited_by, changed_fields)
         VALUES ($1, $2, $3)`,
        [id, req.user.user_id, JSON.stringify(diff)]
      )
    }

    await log({
      user_id: req.user.user_id,
      action: LOG.CONTRACT_UPDATE,
      entity_type: 'contract',
      entity_id: id,
      details: { changed_keys: Object.keys(diff) },
      req,
    })
    res.json({
      message: 'Мэдээлэл хадгалагдлаа',
      data: { changed_fields_count: Object.keys(diff).length },
    })
  } catch (err) {
    console.error(err)
    res.status(400).json({ message: err.message })
  }
}

// ══════════════════════════════════════════════════════
// returnContract — Negotiation flow: засаад нөгөө талд буцаах
// POST /api/contracts/:id/return
// Body: { filled_data_json?: {...} }
//
// Ажиллах нөхцөл:
//   • Гэрээний статус = SENT
//   • Хэрэглэгч current_turn-той тал байх (CREATOR эсвэл COUNTERPARTY)
//   • Гарын үсэг хараахан зурагдаагүй (LOCKED биш)
//
// Үйлдэл:
//   • filled_data_json өөрчилсөн бол: dahin render → contract_versions UPDATE
//     + contract_edit_log diff INSERT
//   • current_turn → нөгөө талд шилжинэ
//   • Нөгөө талд in-app + email notification
// ══════════════════════════════════════════════════════
const returnContract = async (req, res) => {
  try {
    const { id } = req.params
    const { filled_data_json } = req.body

    // Гэрээ + миний participant role-ийг шалгах
    const cRes = await query(
      `SELECT c.contract_id, c.contract_number, c.status, c.creator_id,
              c.current_turn, c.title, c.filled_data_json,
              cp.participant_id, cp.role AS my_role,
              t.template_content, t.schema_json
       FROM contracts c
       JOIN contract_participants cp
         ON cp.contract_id = c.contract_id AND cp.user_id = $2
       LEFT JOIN contract_templates t ON c.template_id = t.template_id
       WHERE c.contract_id = $1`,
      [id, req.user.user_id]
    )
    const contract = cRes.rows[0]
    if (!contract)                return res.status(404).json({ message: 'Гэрээ олдсонгүй эсвэл эрх байхгүй' })
    if (contract.status !== 'SENT') return res.status(400).json({ message: 'Зөвхөн илгээгдсэн гэрээг буцаах боломжтой' })
    if (contract.my_role !== contract.current_turn) {
      return res.status(403).json({ message: 'Одоо таны ээлж биш байна' })
    }

    // Гарын үсэг зурагдсан эсэхийг шалгах (LOCK)
    const sigRes = await query(
      `SELECT 1 FROM contract_signatures WHERE contract_id = $1 LIMIT 1`,
      [id]
    )
    if (sigRes.rows[0]) {
      return res.status(400).json({ message: 'Гарын үсэг зурагдсан гэрээг засаж болохгүй' })
    }

    const oldData = contract.filled_data_json || {}
    const newData = filled_data_json || oldData
    const diff    = computeJsonDiff(oldData, newData)
    const hasChanges = Object.keys(diff).length > 0

    // ── Өөрчлөлт байвал re-render + version UPDATE + edit_log ──
    if (hasChanges) {
      if (contract.template_content && contract.schema_json) {
        const { rendered, hash } = renderContract(
          contract.template_content,
          contract.schema_json,
          newData,
          { contract_number: contract.contract_number }
        )
        await query(
          `UPDATE contract_versions
             SET rendered_content = $1, rendered_hash = $2
           WHERE contract_id = $3`,
          [rendered, hash, id]
        )
      }

      await query(
        `UPDATE contracts
           SET filled_data_json = $1, updated_at = NOW()
         WHERE contract_id = $2`,
        [newData, id]
      )

      await query(
        `INSERT INTO contract_edit_log (contract_id, edited_by, changed_fields)
         VALUES ($1, $2, $3)`,
        [id, req.user.user_id, JSON.stringify(diff)]
      )
    }

    // ── Ээлж шилжүүлэх ───────────────────────────────
    const nextTurn = contract.my_role === 'CREATOR' ? 'COUNTERPARTY' : 'CREATOR'
    await query(
      `UPDATE contracts
         SET current_turn = $1::participant_role_enum,
             updated_at   = NOW()
       WHERE contract_id = $2`,
      [nextTurn, id]
    )

    // ── Аудит лог ────────────────────────────────────
    await log({
      user_id: req.user.user_id,
      action: LOG.CONTRACT_UPDATE,
      entity_type: 'contract',
      entity_id: id,
      details: {
        event: 'RETURNED',
        from_role: contract.my_role,
        to_role: nextTurn,
        changed_keys: Object.keys(diff),
      },
      req,
    })

    // ── Нөгөө талд notification (in-app + email) ──────
    const otherRes = await query(
      `SELECT cp.user_id, cp.invite_email, u.email AS user_email
       FROM contract_participants cp
       LEFT JOIN users u ON u.user_id = cp.user_id
       WHERE cp.contract_id = $1 AND cp.role = $2
       LIMIT 1`,
      [id, nextTurn]
    )
    const other = otherRes.rows[0]
    const actorName = `${req.user.last_name} ${req.user.first_name}`.trim()
    const contractUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/contracts/${id}`

    if (other?.user_id) {
      await notify({
        user_id:     other.user_id,
        contract_id: id,
        title:       hasChanges ? 'Гэрээнд өөрчлөлт орлоо' : 'Гэрээг танд буцаалаа',
        message:     hasChanges
          ? `${actorName} "${contract.title}" гэрээнд өөрчлөлт оруулсан`
          : `${actorName} "${contract.title}" гэрээг танд буцаалаа`,
      })
    }
    const otherEmail = other?.user_email || other?.invite_email
    if (otherEmail) {
      sendContractEventEmail({
        to:            otherEmail,
        contractTitle: contract.title,
        actorName,
        eventType:     hasChanges ? 'EDITED' : 'RETURNED',
        contractUrl,
      }).catch(err => console.error('return email failed:', err.message))
    }

    res.json({
      message: 'Гэрээг буцаалаа',
      data: {
        current_turn: nextTurn,
        changed_fields_count: Object.keys(diff).length,
      },
    })
  } catch (err) {
    console.error('returnContract error:', err)
    res.status(400).json({ message: err.message })
  }
}

// ── Invitation token шалгах (PUBLIC — auth шаардахгүй) ──
// Email-ээр ирсэн линк дээр дарахад дуудагдана.
// Хариу: { contract_id, participant_email, has_user_account, role, status }

const verifyInviteToken = async (req, res) => {
  const { token } = req.params
  const tokenHash = hashToken(token)

  const logAttempt = async (invitationId, result) => {
    await query(
      `INSERT INTO token_access_log
         (invitation_id, token_hash_partial, result, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [invitationId || null, tokenHash.slice(0, 16), result, req.ip, req.headers['user-agent']]
    ).catch(() => {})
  }

  try {
    // EXISTS subquery — invite_email-тэй таарах хэрэглэгч users хүснэгтэд байгаа эсэхийг шалгана.
    // Энэ нь counterparty өмнө бүртгэгдсэн хэдий ч participant_invitations
    // үүсгэх үед user_id-аар холбогдоогүй (зөвхөн email-ээр) тохиолдолд хэрэгтэй.
    const invRes = await query(
      `SELECT pi.invitation_id, pi.participant_id,
              pi.expires_at, pi.is_revoked, pi.use_count,
              cp.contract_id, cp.user_id, cp.invite_email, cp.role, cp.status,
              EXISTS(
                SELECT 1 FROM users u
                WHERE cp.invite_email IS NOT NULL
                  AND LOWER(u.email) = LOWER(cp.invite_email)
                  AND u.status <> 'DELETED'
              ) AS email_has_account
       FROM participant_invitations pi
       JOIN contract_participants  cp ON pi.participant_id = cp.participant_id
       WHERE pi.token_hash = $1`,
      [tokenHash]
    )
    const inv = invRes.rows[0]

    if (!inv) {
      await logAttempt(null, 'NOT_FOUND')
      return res.status(404).json({ message: 'Урилгын линк буруу байна' })
    }
    if (inv.is_revoked) {
      await logAttempt(inv.invitation_id, 'REVOKED')
      return res.status(400).json({ message: 'Энэ урилга цуцлагдсан' })
    }
    if (new Date() > new Date(inv.expires_at)) {
      await logAttempt(inv.invitation_id, 'EXPIRED')
      return res.status(400).json({ message: 'Урилгын хугацаа дууссан' })
    }
    if (inv.use_count >= 50) {
      await logAttempt(inv.invitation_id, 'RATE_LIMITED')
      return res.status(429).json({ message: 'Урилгыг хэт олон удаа ашиглалаа' })
    }

    // use_count + сүүлийн хэрэглэлтийн мэдээлэл шинэчлэх
    await query(
      `UPDATE participant_invitations
       SET use_count        = use_count + 1,
           last_used_at     = NOW(),
           first_ip         = COALESCE(first_ip, $1::inet),
           first_user_agent = COALESCE(first_user_agent, $2)
       WHERE invitation_id = $3`,
      [req.ip, req.headers['user-agent'] || null, inv.invitation_id]
    )

    // INVITED → LINK_OPENED болгох
    if (inv.status === 'INVITED') {
      await query(
        `UPDATE contract_participants
         SET status = 'LINK_OPENED', link_opened_at = NOW()
         WHERE participant_id = $1`,
        [inv.participant_id]
      )
    }

    await logAttempt(inv.invitation_id, 'SUCCESS')

    res.json({
      data: {
        contract_id:      inv.contract_id,
        participant_email:inv.invite_email,
        // user_id-аар холбогдсон ЭСВЭЛ email-ээр бүртгэлтэй бол true
        has_user_account: !!inv.user_id || !!inv.email_has_account,
        role:             inv.role,
        status:           inv.status,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(400).json({ message: err.message })
  }
}

// ── Цуцлах ────────────────────────────────────────────

const cancelContract = async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body

    const cRes = await query(
      `SELECT contract_id, status, creator_id FROM contracts WHERE contract_id = $1`,
      [id]
    )
    const contract = cRes.rows[0]
    if (!contract) return res.status(404).json({ message: 'Гэрээ олдсонгүй' })
    if (contract.creator_id !== req.user.user_id) return res.status(403).json({ message: 'Цуцлах эрх байхгүй' })
    if (['COMPLETED', 'CANCELLED'].includes(contract.status)) {
      return res.status(400).json({ message: 'Энэ гэрээг цуцлах боломжгүй' })
    }

    const oldStatus = contract.status
    await query(
      `UPDATE contracts SET status = 'CANCELLED', updated_at = NOW() WHERE contract_id = $1`,
      [id]
    )
    await query(
      `INSERT INTO contract_status_history (contract_id, from_status, to_status, changed_by, reason)
       VALUES ($1,$2,'CANCELLED',$3,$4)`,
      [id, oldStatus, req.user.user_id, reason || null]
    )

    await log({ user_id: req.user.user_id, action: LOG.CONTRACT_CANCEL, entity_type: 'contract', entity_id: id, req })

    // Бүх оролцогчдод (цуцалсан хүнээс бусад) мэдэгдэх
    const titleRes = await query(`SELECT title FROM contracts WHERE contract_id = $1`, [id])
    await notifyParticipants(id, {
      title:        'Гэрээ цуцлагдлаа',
      message:      `"${titleRes.rows[0]?.title || 'Гэрээ'}" гэрээг цуцалсан${reason ? `: ${reason}` : ''}`,
      exceptUserId: req.user.user_id,
    })

    res.json({ message: 'Гэрээ цуцлагдлаа' })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ══════════════════════════════════════════════════════
// ГЭРЭЭГ ХААХ (CLOSE)
// POST /api/contracts/:id/close
// Body: { reason? }
// → COMPLETED → CLOSED · Үнэлгээ өгөх боломж нээгдэнэ
// ══════════════════════════════════════════════════════
const closeContract = async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body

    const cRes = await query(
      `SELECT contract_id, status, creator_id, title FROM contracts WHERE contract_id = $1`,
      [id]
    )
    const contract = cRes.rows[0]
    if (!contract) return res.status(404).json({ message: 'Гэрээ олдсонгүй' })
    if (contract.creator_id !== req.user.user_id) {
      return res.status(403).json({ message: 'Зөвхөн үүсгэгч хаах эрхтэй' })
    }
    if (contract.status !== 'COMPLETED') {
      return res.status(400).json({ message: 'Зөвхөн баталгаажсан гэрээг хаах боломжтой' })
    }

    await query(
      `UPDATE contracts
       SET status = 'CLOSED',
           closed_at = NOW(),
           close_reason = $1,
           updated_at = NOW()
       WHERE contract_id = $2`,
      [reason || null, id]
    )

    await query(
      `INSERT INTO contract_status_history (contract_id, from_status, to_status, changed_by, reason)
       VALUES ($1, 'COMPLETED', 'CLOSED', $2, $3)`,
      [id, req.user.user_id, reason || 'creator closed']
    )

    await log({ user_id: req.user.user_id, action: 'CONTRACT_CLOSE',
                entity_type: 'contract', entity_id: id, req })

    // Бүх оролцогчдод мэдэгдэх
    await notifyParticipants(id, {
      title:        'Гэрээ хаагдлаа',
      message:      `"${contract.title || 'Гэрээ'}" гэрээ дууссан. Та одоо нөгөө талыг үнэлэх боломжтой.`,
      exceptUserId: req.user.user_id,
    })

    res.json({ message: 'Гэрээ хаагдлаа' })
  } catch (err) {
    console.error(err)
    res.status(400).json({ message: err.message })
  }
}

// ══════════════════════════════════════════════════════
// ҮНЭЛГЭЭ ӨГӨХ (UPSERT — засаж болно)
// POST /api/contracts/:id/ratings
// Body: { rated_user_id, rating: 1-5, comment? }
// ══════════════════════════════════════════════════════
const submitRating = async (req, res) => {
  try {
    const { id } = req.params
    const { rated_user_id, rating, comment } = req.body

    if (!rated_user_id) return res.status(400).json({ message: 'rated_user_id шаардлагатай' })
    const star = parseInt(rating, 10)
    if (isNaN(star) || star < 1 || star > 5) {
      return res.status(400).json({ message: 'Үнэлгээ 1-5 хооронд байх ёстой' })
    }
    if (rated_user_id === req.user.user_id) {
      return res.status(400).json({ message: 'Өөрийгөө үнэлж болохгүй' })
    }

    // Гэрээ CLOSED, rater болон rated_user хоёулаа оролцогч мөн эсэх
    const checkRes = await query(
      `SELECT c.status,
              EXISTS(SELECT 1 FROM contract_participants
                     WHERE contract_id = $1 AND user_id = $2) AS rater_in,
              EXISTS(SELECT 1 FROM contract_participants
                     WHERE contract_id = $1 AND user_id = $3) AS rated_in
       FROM contracts c WHERE c.contract_id = $1`,
      [id, req.user.user_id, rated_user_id]
    )
    const chk = checkRes.rows[0]
    if (!chk) return res.status(404).json({ message: 'Гэрээ олдсонгүй' })
    if (chk.status !== 'CLOSED') {
      return res.status(400).json({ message: 'Зөвхөн хаагдсан гэрээнд үнэлгээ өгөх боломжтой' })
    }
    if (!chk.rater_in)  return res.status(403).json({ message: 'Энэ гэрээний оролцогч биш' })
    if (!chk.rated_in)  return res.status(400).json({ message: 'Үнэлэгдэх хүн энэ гэрээнд оролцоогүй' })

    // UPSERT — дахин засаж болно
    const insRes = await query(
      `INSERT INTO user_ratings (contract_id, rater_id, rated_user_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (contract_id, rater_id, rated_user_id)
       DO UPDATE SET rating = EXCLUDED.rating,
                     comment = EXCLUDED.comment,
                     created_at = NOW()
       RETURNING rating_id, rating, comment, created_at`,
      [id, req.user.user_id, rated_user_id, star, comment || null]
    )

    await log({ user_id: req.user.user_id, action: 'RATING_SUBMIT',
                entity_type: 'contract', entity_id: id, req,
                details: { rated_user_id, rating: star } })

    // Үнэлүүлсэн хэрэглэгчид мэдэгдэх
    const raterName = `${req.user.last_name} ${req.user.first_name}`.trim()
    await notify({
      user_id:     rated_user_id,
      contract_id: id,
      title:       'Танд үнэлгээ өглөө',
      message:     `${raterName} танд ${star} оноо өгсөн${comment ? `: "${comment}"` : ''}`,
    })

    res.json({ message: 'Үнэлгээ хадгалагдлаа', data: insRes.rows[0] })
  } catch (err) {
    console.error(err)
    res.status(400).json({ message: err.message })
  }
}

// ══════════════════════════════════════════════════════
// ГЭРЭЭНИЙ БҮХ ҮНЭЛГЭЭ
// GET /api/contracts/:id/ratings
// ══════════════════════════════════════════════════════
const getContractRatings = async (req, res) => {
  try {
    const { id } = req.params

    // Оролцогч мөн эсэх
    const partRes = await query(
      `SELECT 1 FROM contract_participants WHERE contract_id = $1 AND user_id = $2`,
      [id, req.user.user_id]
    )
    if (!partRes.rows[0]) return res.status(403).json({ message: 'Харах эрх байхгүй' })

    const result = await query(
      `SELECT r.rating_id, r.rating, r.comment, r.created_at,
              r.rater_id, r.rated_user_id,
              rater.first_name  AS rater_first_name,
              rater.last_name   AS rater_last_name,
              rated.first_name  AS rated_first_name,
              rated.last_name   AS rated_last_name
       FROM user_ratings r
       LEFT JOIN users rater ON rater.user_id = r.rater_id
       LEFT JOIN users rated ON rated.user_id = r.rated_user_id
       WHERE r.contract_id = $1
       ORDER BY r.created_at DESC`,
      [id]
    )
    res.json({ data: result.rows })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// ══════════════════════════════════════════════════════
// ATTACHMENT — Гэрээний хавсралт материал (Cloudinary дээр)
// ══════════════════════════════════════════════════════
const { deleteFromCloudinary } = require('../utils/cloudinary')

// POST /api/contracts/:id/attachments
// multer-cloudinary middleware-ээр файл upload болсон → req.file
//   req.file.path     = Cloudinary бүтэн URL
//   req.file.filename = public_id
//   req.file.mimetype, size
const uploadAttachment = async (req, res) => {
  try {
    const { id } = req.params
    if (!req.file) return res.status(400).json({ message: 'Файл оруулна уу' })

    // Эрх шалгах: тухайн гэрээний оролцогч эсэх + гарын үсэг зурагдаагүй (LOCK)
    const cRes = await query(
      `SELECT c.contract_id, c.status, c.creator_id,
              cp.participant_id, cp.role AS my_role
       FROM contracts c
       JOIN contract_participants cp
         ON cp.contract_id = c.contract_id AND cp.user_id = $2
       WHERE c.contract_id = $1`,
      [id, req.user.user_id]
    )
    const contract = cRes.rows[0]
    if (!contract) {
      await deleteFromCloudinary(req.file.filename,
        req.file.mimetype?.startsWith('image/') ? 'image' : 'raw')
      return res.status(404).json({ message: 'Гэрээ олдсонгүй эсвэл эрх байхгүй' })
    }

    // Lock check — гарын үсэг зурагдсан бол хавсралт нэмж болохгүй
    const sigRes = await query(
      `SELECT 1 FROM contract_signatures WHERE contract_id = $1 LIMIT 1`,
      [id]
    )
    if (sigRes.rows[0]) {
      await deleteFromCloudinary(req.file.filename,
        req.file.mimetype?.startsWith('image/') ? 'image' : 'raw')
      return res.status(400).json({ message: 'Гарын үсэг зурагдсан гэрээнд хавсралт нэмж болохгүй' })
    }

    // sort_order — одоо байгаа бүх хавсралтын дараа
    const orderRes = await query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
       FROM contract_attachments WHERE contract_id = $1`,
      [id]
    )
    const nextOrder = orderRes.rows[0].next_order

    const result = await query(
      `INSERT INTO contract_attachments
         (contract_id, uploaded_by, file_name, file_url, public_id,
          file_type, file_size, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING attachment_id, file_name, file_url, file_type,
                 file_size, sort_order, created_at, uploaded_by`,
      [
        id,
        req.user.user_id,
        req.file.originalname,
        req.file.path,
        req.file.filename,           // Cloudinary public_id
        req.file.mimetype,
        req.file.size,
        nextOrder,
      ]
    )

    await log({
      user_id: req.user.user_id,
      action: 'CONTRACT_ATTACHMENT_ADD',
      entity_type: 'contract',
      entity_id: id,
      details: { file_name: req.file.originalname },
      req,
    })

    res.status(201).json({ data: result.rows[0] })
  } catch (err) {
    console.error('uploadAttachment:', err)
    if (req.file?.filename) {
      await deleteFromCloudinary(req.file.filename,
        req.file.mimetype?.startsWith('image/') ? 'image' : 'raw')
    }
    res.status(400).json({ message: err.message })
  }
}

// DELETE /api/contracts/:id/attachments/:attachmentId
// Зөвхөн uploaded_by + lock-той (гарын үсэг зурагдаагүй) үед
const deleteAttachment = async (req, res) => {
  try {
    const { id, attachmentId } = req.params

    // Lock check
    const sigRes = await query(
      `SELECT 1 FROM contract_signatures WHERE contract_id = $1 LIMIT 1`,
      [id]
    )
    if (sigRes.rows[0]) {
      return res.status(400).json({ message: 'Гарын үсэг зурагдсан гэрээнээс хавсралт устгаж болохгүй' })
    }

    const attRes = await query(
      `SELECT attachment_id, public_id, file_type, uploaded_by
       FROM contract_attachments
       WHERE attachment_id = $1 AND contract_id = $2`,
      [attachmentId, id]
    )
    const att = attRes.rows[0]
    if (!att) return res.status(404).json({ message: 'Хавсралт олдсонгүй' })
    if (att.uploaded_by !== req.user.user_id) {
      return res.status(403).json({ message: 'Зөвхөн оруулсан хүн өөрөө устгах эрхтэй' })
    }

    // Cloudinary-аас устгах
    const resourceType = att.file_type?.startsWith('image/') ? 'image' : 'raw'
    await deleteFromCloudinary(att.public_id, resourceType)

    // DB-ээс устгах
    await query(
      `DELETE FROM contract_attachments WHERE attachment_id = $1`,
      [attachmentId]
    )

    await log({
      user_id: req.user.user_id,
      action: 'CONTRACT_ATTACHMENT_DELETE',
      entity_type: 'contract',
      entity_id: id,
      req,
    })

    res.json({ message: 'Хавсралт устгагдлаа' })
  } catch (err) {
    console.error('deleteAttachment:', err)
    res.status(400).json({ message: err.message })
  }
}

module.exports = {
  getTemplates, getTemplateById,
  createContract, getMyContracts, getContractById,
  updateContract, sendContract, signContract,
  confirmContract, cancelContract, closeContract,
  submitRating, getContractRatings,
  verifyInviteToken,
  fillCounterpartyData,
  returnContract,
  uploadAttachment, deleteAttachment,
}