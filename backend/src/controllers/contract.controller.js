const crypto              = require('crypto')
const Handlebars          = require('handlebars')
const { query, withTransaction } = require('../config/db')
const { renderContract, renderPreview, extractPlaceholders } = require('../utils/render')
const { sendInviteEmail, sendContractEventEmail, sendSignOtpEmail } = require('../utils/email')
const { generateOtp, saveOtp, verifyOtp: verifyOtpUtil } = require('../utils/otp')
const { log, LOG }        = require('../utils/logger')
const { notify, notifyParticipants } = require('../utils/notifier')
const { addBlock }                   = require('../utils/blockchain')
const { generateQRDataUrl }          = require('../utils/qrcode')
const { safeErrorMessage }           = require('../utils/errors')
// ── Invitation token tools
const generateInviteToken = () => crypto.randomBytes(32).toString('hex')
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

// ── Гарын үсгийн blob валидаци ────────────────────────
// XSS халдлагаас сэргийлэх — зөвхөн base64-кодлогдсон data URL зөвшөөрнө.
// sign blob
const SIGNATURE_BLOB_RE = /^data:image\/(png|jpeg|jpg|svg\+xml);base64,[A-Za-z0-9+/=]+$/
const MAX_SIGNATURE_LEN = 500_000
const isValidSignatureBlob = (blob) =>
  typeof blob === 'string' &&
  blob.length > 0 &&
  blob.length <= MAX_SIGNATURE_LEN &&
  SIGNATURE_BLOB_RE.test(blob)


const PLACEHOLDER_KEY_RE = /^[a-z][a-z0-9_]{0,40}(\.[a-z][a-z0-9_]{0,40})?$/
const isValidPlaceholderKey = (k) =>
  typeof k === 'string' && PLACEHOLDER_KEY_RE.test(k)
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
    res.status(400).json({ message: safeErrorMessage(err) })
  }
}

const getTemplateById = async (req, res) => {
  try {
    const result = await query(
      `SELECT template_id, name, description, template_content,
              schema_json, is_standard
       FROM contract_templates
       WHERE template_id = $1 AND is_active = true`,
      [req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Загвар олдсонгүй' })
    res.json({ data: result.rows[0] })
  } catch (err) {
    res.status(400).json({ message: safeErrorMessage(err) })
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
    // ── Auto үүсгэлт ──────────────────────────────────
    // contracts + contract_versions + contract_participants 3 INSERT-ийг
    // нэг транзакцид багтаана. Аль нэг нь алдвал бүгд rollback хийгдэнэ —
    // orphan contract эсвэл version-гүй contract үлдэхээс сэргийлнэ.
    const now = new Date()
    const { contract, rendered, versionId } = await withTransaction(async (db) => {
      const contractRes = await db.query(
        `INSERT INTO contracts (template_id, creator_id, title, filled_data_json, creator_role)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING contract_id, contract_number, title, status, creator_role, created_at`,
        [template_id, req.user.user_id, title || tmpl.name, enriched, creator_role]
      )
      const c = contractRes.rows[0]

      // contract_number авсны дараа render хийх — он/сар/өдөр-ийг meta-аар дамжуулна
      const { rendered, hash } = renderContract(
        tmpl.template_content,
        tmpl.schema_json,
        enriched,
        {
          contract_number: c.contract_number,
          year:  now.getFullYear().toString(),
          month: (now.getMonth() + 1).toString(),
          day:   now.getDate().toString(),
        }
      )

      // contract_versions — ганц row per contract (Migration 007)
      const versionRes = await db.query(
        `INSERT INTO contract_versions
           (contract_id, rendered_content, rendered_hash)
         VALUES ($1, $2, $3)
         RETURNING version_id`,
        [c.contract_id, rendered, hash]
      )

      // Creator-г CREATOR role-той participant болгон нэмэх
      // Status='VIEWED' — бодит signature_blob орохоос өмнө 'SIGNED' болгохгүй.
      // /sign endpoint signature оруулсны дараа trigger автоматаар SIGNED болгоно.
      await db.query(
        `INSERT INTO contract_participants
           (contract_id, user_id, role, status)
         VALUES ($1,$2,'CREATOR','VIEWED')`,
        [c.contract_id, req.user.user_id]
      )

      return { contract: c, rendered, versionId: versionRes.rows[0].version_id }
    })

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
        version_id: versionId,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(400).json({ message: safeErrorMessage(err) })
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
    res.status(400).json({ message: safeErrorMessage(err) })
  }
}

// ── Нэг гэрээний дэлгэрэнгүй 

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

    // Хариу JSON-д буцаах my_status шинэчлэгдсэн утгаар явахын тулд reference барина
    // (auto-fill block доор myParticipant.status-г өөрчилнө)

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

    // ── Auto-fill: үзэгчийн өөрийн талын мэдээлэл (name/phone/email/address)
    //    хоосон бол user профайлаас дүүргээд contract-ыг re-render хийнэ ──
    // Зөвхөн lock-гүй (DRAFT/SENT) үед, бичих ажил байвал л хийнэ (idempotent).
    // CREATOR-д createContract аль хэдийн хийсэн боловч user профайл сүүлд
    // шинэчлэгдсэн бол энэ хэсэг засна. COUNTERPARTY-н хувьд анхны үзэлтэд эхэлж дүүргэгдэнэ.
    const myParticipant = partRes.rows[0]
    if (
      ['DRAFT', 'SENT'].includes(contract.status) &&
      contract.template_content && contract.schema_json
    ) {
      try {
        // Үзэгчийн талын role key — CREATOR бол creator_role, COUNTERPARTY бол эсрэг
        const myRoleKey = myParticipant.role === 'CREATOR'
          ? contract.creator_role
          : (contract.creator_role === 'seller' ? 'buyer' : 'seller')

        const cur = (contract.filled_data_json || {})[myRoleKey] || {}
        const fullName = `${req.user.last_name || ''} ${req.user.first_name || ''}`.trim()

        // Хоосон/null талбарыг л дүүргэнэ. Хэрэглэгчийн оруулсан утга байгаа бол хөндөхгүй.
        const filled = { ...cur }
        if (!filled.name    && fullName)         filled.name    = fullName
        if (!filled.phone   && req.user.phone)   filled.phone   = req.user.phone
        if (!filled.email   && req.user.email)   filled.email   = req.user.email
        if (!filled.address && req.user.address) filled.address = req.user.address

        // Жинхэнэ өөрчлөлт байгаа эсэхийг шалгана (idempotent guard)
        const fieldsChanged = ['name', 'phone', 'email', 'address']
          .some(k => (cur[k] || '') !== (filled[k] || ''))

        if (fieldsChanged) {
          const newData = {
            ...(contract.filled_data_json || {}),
            [myRoleKey]: filled,
          }

          const created = new Date(contract.created_at)
          const { rendered, hash } = renderContract(
            contract.template_content,
            contract.schema_json,
            newData,
            {
              contract_number: contract.contract_number,
              year:  String(created.getFullYear()),
              month: String(created.getMonth() + 1),
              day:   String(created.getDate()),
            }
          )

          await query(
            `UPDATE contracts
               SET filled_data_json = $1, updated_at = NOW()
             WHERE contract_id = $2`,
            [newData, id]
          )
          await query(
            `UPDATE contract_versions
               SET rendered_content = $1, rendered_hash = $2
             WHERE contract_id = $3`,
            [rendered, hash, id]
          )

          contract.filled_data_json = newData
        }

        // Counterparty анх удаа орж ирсэн бол status-ийг VIEWED болгох
        // (status гэрчилгээний түүхэнд ач холбогдолтой)
        if (
          myParticipant.role === 'COUNTERPARTY' &&
          ['INVITED', 'LINK_OPENED', 'REGISTERED'].includes(myParticipant.status)
        ) {
          await query(
            `UPDATE contract_participants
               SET status = 'VIEWED'
             WHERE participant_id = $1`,
            [myParticipant.participant_id]
          )
          myParticipant.status = 'VIEWED'
        }
      } catch (err) {
        console.error('Profile auto-fill failed:', err.message)
        // Auto-fill амжилтгүй ч main flow зогсохгүй
      }
    }

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
      // SafeString-ээр боож, signature_blob утгыг HTML-attribute escape хийнэ
      // (XSS-аас сэргийлэх — хуучин буюу зөрчилтэй blob утга байсан ч аюулгүй).
      const displayData = JSON.parse(JSON.stringify(contract.filled_data_json || {}))
      sigRes.rows.forEach(s => {
        const escapedBlob = Handlebars.escapeExpression(s.signature_blob || '')
        const imgHtml = new Handlebars.SafeString(
          `<img src="${escapedBlob}" alt="signature" style="max-height:60px;display:inline-block;vertical-align:middle"/>`
        )
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
    res.status(400).json({ message: safeErrorMessage(err) })
  }
}
const updateContract = async (req, res) => {
  try {
    const { id } = req.params
    const { filled_data_json, title, note } = req.body
    const cleanNote = typeof note === 'string'
      ? note.trim().slice(0, 1000) || null
      : null

    const cRes = await query(
      `SELECT c.contract_id, c.contract_number, c.status, c.creator_id, c.creator_role, c.current_turn,
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
    // ── Counterparty privilege guard ──────────────────────
    // Үүсгэгч (creator) бүх талбарыг засаж болно. Нөгөө тал (counterparty)
    // зөвхөн өөрийн талын name/phone/email/address-г засна. Энэ нь
    // counterparty seller-ийн өгөгдөл (нэр, үнэ гэх мэт) солихоос сэргийлнэ.
    let newData
    if (isCreator) {
      newData = filled_data_json || oldData
    } else {
      const myRoleKey = contract.creator_role === 'seller' ? 'buyer' : 'seller'
      const allowedKeys = ['name', 'phone', 'email', 'address']
      const incoming = (filled_data_json && filled_data_json[myRoleKey]) || {}
      const cleanCp = {}
      for (const k of allowedKeys) {
        if (incoming[k] != null) cleanCp[k] = String(incoming[k]).trim()
      }
      newData = {
        ...oldData,
        [myRoleKey]: { ...(oldData[myRoleKey] || {}), ...cleanCp },
      }
    }

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
    if (Object.keys(diff).length > 0 || cleanNote) {
      await query(
        `INSERT INTO contract_edit_log (contract_id, edited_by, changed_fields, note)
         VALUES ($1, $2, $3, $4)`,
        [id, req.user.user_id, JSON.stringify(diff), cleanNote]
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
    res.status(400).json({ message: safeErrorMessage(err) })
  }
}
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

    // Өөрийн имэйл/утас руу гэрээ илгээхээс сэргийлэх (self-invite block)
    const myEmail = (req.user.email || '').toLowerCase()
    const myPhone = req.user.phone || ''
    for (const p of participants || []) {
      const pEmail = (p.email || '').trim().toLowerCase()
      const pPhone = (p.phone || '').trim()
      if (myEmail && pEmail === myEmail) {
        return res.status(400).json({ message: 'Өөрийн имэйл рүү гэрээ илгээх боломжгүй' })
      }
      if (myPhone && pPhone === myPhone) {
        return res.status(400).json({ message: 'Өөрийн утсан дугаар руу гэрээ илгээх боломжгүй' })
      }
      if (p.user_id && p.user_id === req.user.user_id) {
        return res.status(400).json({ message: 'Өөрийгөө оролцогчоор нэмэх боломжгүй' })
      }
    }

    // Хамгийн ихдээ 2 оролцогч (CREATOR + 1 COUNTERPARTY). WITNESS дэмжлэггүй.
    const counterpartyRequests = (participants || []).filter(
      p => (p.role || 'COUNTERPARTY') === 'COUNTERPARTY'
    )
    if (counterpartyRequests.length > 1) {
      return res.status(400).json({ message: 'Гэрээнд зөвхөн 1 нөгөө тал нэмэх боломжтой' })
    }
    const existingCpRes = await query(
      `SELECT COUNT(*) AS cnt FROM contract_participants
       WHERE contract_id = $1 AND role = 'COUNTERPARTY'`,
      [id]
    )
    const existingCpCount = parseInt(existingCpRes.rows[0]?.cnt || '0', 10)
    if (existingCpCount + counterpartyRequests.length > 1) {
      return res.status(400).json({ message: 'Энэ гэрээнд аль хэдийн нөгөө тал нэмэгдсэн байна' })
    }

    // ── Атомар илгээлт ────────────────────────────────
    // participants + invitations + contract status UPDATE-ийг нэг транзакцид.
    // Аль нэг алдвал бүгд rollback — half-sent контракт үлдэхгүй.
    // Имэйл болон in-app notification-ийг commit хийсний дараа явуулна
    // (DB rollback хийгдэх үед имэйл явуулсан байгаа зөрчилөөс сэргийлэх).
    const emailQueue  = []
    const notifyQueue = []
    const added = await withTransaction(async (db) => {
      const addedRows = []
      for (const p of participants || []) {
        const partRes = await db.query(
          `INSERT INTO contract_participants
             (contract_id, user_id, role, invite_email, invite_phone, status, invited_at)
           VALUES ($1,$2,$3,$4,$5,'INVITED',NOW())
           ON CONFLICT DO NOTHING
           RETURNING participant_id, role, invite_email`,
          [id, p.user_id || null, p.role || 'COUNTERPARTY', p.email || null, p.phone || null]
        )
        if (partRes.rows[0]) {
          addedRows.push(partRes.rows[0])

          // ── Invitation token үүсгэж participant_invitations-д хадгалах ──
          const token     = generateInviteToken()
          const tokenHash = hashToken(token)
          await db.query(
            `INSERT INTO participant_invitations
               (participant_id, token_hash, sent_to_email, sent_to_phone)
             VALUES ($1, $2, $3, $4)`,
            [partRes.rows[0].participant_id, tokenHash, p.email || null, p.phone || null]
          )

          if (p.email)   emailQueue.push({ to: p.email, token })
          if (p.user_id) notifyQueue.push({ user_id: p.user_id })
        }
      }

      // Contract-г SENT болгох + ээлж нөгөө талд шилжих
      await db.query(
        `UPDATE contracts
           SET status       = 'SENT',
               current_turn = 'COUNTERPARTY',
               sent_at      = NOW(),
               updated_at   = NOW()
         WHERE contract_id = $1`,
        [id]
      )

      return addedRows
    })

    // ── Имэйл болон notification — commit-ийн дараа ──
    const senderName = `${req.user.last_name} ${req.user.first_name}`
    for (const e of emailQueue) {
      // Token-г URL fragment-д (# дараа) тавьсанаар Referer / server лог /
      // Slack OG preview гэх мэт газруудад token leak хийгдэхгүй.
      const inviteUrl = `${process.env.FRONTEND_URL}/invite#token=${e.token}`
      await sendInviteEmail({
        to: e.to,
        contractTitle: contract.title,
        inviteUrl,
        senderName,
      }).catch(console.error)
    }
    for (const n of notifyQueue) {
      await notify({
        user_id:     n.user_id,
        contract_id: id,
        title:       'Танд гэрээ ирлээ',
        message:     `"${contract.title}" гэрээнд оролцохыг урилаа`,
      })
    }

    await log({ user_id: req.user.user_id, action: LOG.CONTRACT_SEND, entity_type: 'contract', entity_id: id, req })
    res.json({ message: 'Гэрээ илгээгдлээ', data: { participants: added } })
  } catch (err) {
    res.status(400).json({ message: safeErrorMessage(err) })
  }
}

//Gariin usgiin OTP recipient scope
// "sign:<email>:<contractId>" 

const buildSignOtpRecipient = (email, contractId) =>
  `sign:${String(email || '').toLowerCase()}:${contractId}`

// ── POST /api/contracts/:id/sign/request-otp 
const requestSignOtp = async (req, res) => {
  try {
    const { id } = req.params

    if (!req.user.email) {
      return res.status(400).json({ message: 'Имэйл хаяг бүртгэлгүй байна' })
    }

    // 1. Оролцогч + Гэрээний статус шалгах нэг queryd
    const partRes = await query(
      `SELECT cp.participant_id, cp.role, cp.status AS my_status, c.status AS contract_status, c.title
       FROM contract_participants cp
       JOIN contracts c ON c.contract_id = cp.contract_id
       WHERE cp.contract_id = $1 AND cp.user_id = $2`,
      [id, req.user.user_id]
    )
    const part = partRes.rows[0]
    if (!part) return res.status(403).json({ message: 'Энэ гэрээнд оролцогч биш' })
    if (part.my_status === 'SIGNED') {
      return res.status(400).json({ message: 'Та аль хэдийн гарын үсэг зурсан' })
    }
    if (!['DRAFT', 'SENT', 'PARTIALLY_SIGNED'].includes(part.contract_status)) {
      return res.status(400).json({ message: 'Энэ статуст гарын үсэг зурах боломжгүй' })
    }

    // 2. OTP үүсгээд илгээнэ.
    // Channel 'EMAIL' хэрэглэнэ — recipient prefix ("sign:...:contractId") нь
    // бүртгэлийн OTP-аас тусгаарлахад хангалттай (saveOtp recipient-аар хайдаг).
    const code = generateOtp()
    const recipient = buildSignOtpRecipient(req.user.email, id)
    await saveOtp(recipient, code, 'EMAIL', 5)
    await sendSignOtpEmail(req.user.email, code, part.title)

    await log({
      user_id: req.user.user_id,
      action: 'CONTRACT_SIGN_OTP_REQUEST',
      entity_type: 'contract',
      entity_id: id,
      req,
    })

    res.json({ message: 'OTP код имэйл рүү илгээгдлээ', email_masked: maskEmail(req.user.email) })
  } catch (err) {
    console.error('requestSignOtp:', err)
    res.status(400).json({ message: safeErrorMessage(err) })
  }
}
//email link useg
const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return ''
  const [name, domain] = email.split('@')
  if (!name || !domain) return ''
  const head = name.slice(0, 1)
  return `${head}${'*'.repeat(Math.max(name.length - 1, 2))}@${domain}`
}

// ── Garin usgiin OTP-g шалгах + гарын үсэг хадгалах 
const signContract = async (req, res) => {
  try {
    const { id } = req.params
    const { signature_blob, placeholder_key = 'signature', otp_code } = req.body
    if (!signature_blob) return res.status(400).json({ message: 'Гарын үсэг шаардлагатай' })
    // XSS-аас сэргийлэх — зөвхөн base64-data URL 
    if (!isValidSignatureBlob(signature_blob)) {
      return res.status(400).json({ message: 'Гарын үсгийн формат буруу эсвэл хэт том' })
    }
    if (!isValidPlaceholderKey(placeholder_key)) {
      return res.status(400).json({ message: 'Гарын үсгийн талбарын нэр буруу' })
    }
    // OTP — гарын үсэг зурахын өмнө заавал шаардлагатай.
    // Format: яг 6 оронтой тоо (DoS-аас сэргийлж урт оролтыг блоклоно)
    if (!otp_code || typeof otp_code !== 'string' || !/^\d{6}$/.test(otp_code)) {
      return res.status(400).json({ message: 'OTP код 6 оронтой тоо байх ёстой' })
    }

    // Оролцогч + контрактын статусыг нэг хүсэлтэд шалгана
    const partRes = await query(
      `SELECT cp.participant_id, cp.role, cp.status AS my_status, c.status AS contract_status
       FROM contract_participants cp
       JOIN contracts c ON c.contract_id = cp.contract_id
       WHERE cp.contract_id = $1 AND cp.user_id = $2`,
      [id, req.user.user_id]
    )
    const part = partRes.rows[0]
    if (!part) return res.status(403).json({ message: 'Энэ гэрээнд оролцогч биш' })
    if (part.my_status === 'SIGNED') return res.status(400).json({ message: 'Аль хэдийн гарын үсэг зурсан' })

    // Цуцалсан/баталгаажсан/хаагдсан гэрээг дахин зурах боломжгүй
    if (!['DRAFT', 'SENT', 'PARTIALLY_SIGNED'].includes(part.contract_status)) {
      return res.status(400).json({ message: 'Энэ статуст гарын үсэг зурах боломжгүй' })
    }

    // OTP шалгах — req.user.email-ээр scope хийсэн recipient
    if (!req.user.email) {
      return res.status(400).json({ message: 'Имэйл хаяг бүртгэлгүй байна' })
    }
    const otpRecipient = buildSignOtpRecipient(req.user.email, id)
    const otpResult = await verifyOtpUtil(otpRecipient, otp_code)
    if (!otpResult.valid) {
      const msgs = {
        NOT_FOUND:    'OTP код олдсонгүй. Шинэ OTP хүсэлт явуулна уу',
        EXPIRED:      'OTP кодын хугацаа дууссан. Шинэ OTP хүсэлт явуулна уу',
        MAX_ATTEMPTS: 'OTP оролдлогын хязгаар хэтэрлээ. Шинэ OTP хүсэлт явуулна уу',
        WRONG_CODE:   'OTP код буруу байна',
      }
      return res.status(400).json({ message: msgs[otpResult.reason] || 'OTP буруу' })
    }

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
    res.status(400).json({ message: safeErrorMessage(err) })
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
    // creator_role-аас seller/buyer-ийг тогтоож livestock_transactions-д INSERT.
    // Бүх мөрийг нэг транзакцид: дунд алдвал бүгд rollback (хагас гүйлгээ
    // үлдэхээс сэргийлнэ). Гэрээ COMPLETED хэвээр — статистик дутах нь
    // main flow-ыг хаахгүй (анхны бизнес логик хадгалагдсан).
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
        await withTransaction(async (db) => {
          for (const it of livestock) {
            const cnt   = parseInt(it.count) || 0
            const price = parseFloat(it.price_per_unit) || 0
            const type  = (it.livestock_type || '').toString().trim()
            if (cnt > 0 && type) {
              await db.query(
                `INSERT INTO livestock_transactions
                   (contract_id, seller_id, buyer_id, livestock_type,
                    count, price_per_unit, total_amount)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [id, sellerId, buyerId, type, cnt, price, cnt * price]
              )
            }
          }
        })
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
    res.status(400).json({ message: safeErrorMessage(err) })
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
    res.status(400).json({ message: safeErrorMessage(err) })
  }
}

// ══════════════════════════════════════════════════════
// returnContract — Negotiation flow: засаад нөгөө талд буцаах
// POST /api/contracts/:id/return
// Body: { filled_data_json?: {...}, note?: string }
//
// Ажиллах нөхцөл:
//   • Гэрээний статус = SENT
//   • Хэрэглэгч current_turn-той тал байх (CREATOR эсвэл COUNTERPARTY)
//   • Гарын үсэг хараахан зурагдаагүй (LOCKED биш)
//
// Үйлдэл:
//   • filled_data_json өөрчилсөн бол: dahin render → contract_versions UPDATE
//     + contract_edit_log diff INSERT (note-той хамт)
//   • Өөрчлөлтгүй ч note байгаа бол note-only лог үлдээнэ
//   • current_turn → нөгөө талд шилжинэ
//   • Нөгөө талд in-app (note-г preview-д) + email notification
// ══════════════════════════════════════════════════════
const returnContract = async (req, res) => {
  try {
    const { id } = req.params
    const { filled_data_json, note } = req.body
    const cleanNote = typeof note === 'string'
      ? note.trim().slice(0, 1000) || null
      : null

    // Гэрээ + миний participant role-ийг шалгах
    const cRes = await query(
      `SELECT c.contract_id, c.contract_number, c.status, c.creator_id, c.creator_role,
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
    // ── Counterparty privilege guard ──────────────────────
    // updateContract-тай ижил логик: counterparty зөвхөн өөрийн талын
    // name/phone/email/address-г засна. Creator бүх талбарыг засаж болно.
    const isCreator = contract.creator_id === req.user.user_id
    let newData
    if (isCreator) {
      newData = filled_data_json || oldData
    } else {
      const myRoleKey = contract.creator_role === 'seller' ? 'buyer' : 'seller'
      const allowedKeys = ['name', 'phone', 'email', 'address']
      const incoming = (filled_data_json && filled_data_json[myRoleKey]) || {}
      const cleanCp = {}
      for (const k of allowedKeys) {
        if (incoming[k] != null) cleanCp[k] = String(incoming[k]).trim()
      }
      newData = {
        ...oldData,
        [myRoleKey]: { ...(oldData[myRoleKey] || {}), ...cleanCp },
      }
    }
    const diff    = computeJsonDiff(oldData, newData)
    const hasChanges = Object.keys(diff).length > 0

    // ── Өөрчлөлт байвал re-render + version UPDATE ──
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
    }

    // ── edit_log: өөрчлөлт ЭСВЭЛ зөвхөн note бичсэн бол үлдээнэ ──
    if (hasChanges || cleanNote) {
      await query(
        `INSERT INTO contract_edit_log (contract_id, edited_by, changed_fields, note)
         VALUES ($1, $2, $3, $4)`,
        [id, req.user.user_id, JSON.stringify(diff), cleanNote]
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
      const baseMessage = hasChanges
        ? `${actorName} "${contract.title}" гэрээнд өөрчлөлт оруулсан`
        : `${actorName} "${contract.title}" гэрээг танд буцаалаа`
      await notify({
        user_id:     other.user_id,
        contract_id: id,
        title:       hasChanges ? 'Гэрээнд өөрчлөлт орлоо' : 'Гэрээг танд буцаалаа',
        message:     cleanNote ? `${baseMessage} — "${cleanNote}"` : baseMessage,
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
        note:          cleanNote,
      }).catch(err => console.error('return email failed:', err.message))
    }

    res.json({
      message: 'Гэрээг буцаалаа',
      data: {
        current_turn: nextTurn,
        changed_fields_count: Object.keys(diff).length,
        note: cleanNote,
      },
    })
  } catch (err) {
    console.error('returnContract error:', err)
    res.status(400).json({ message: safeErrorMessage(err) })
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
    res.status(400).json({ message: safeErrorMessage(err) })
  }
}

// ── Цуцлах ────────────────────────────────────────────

const cancelContract = async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body
    // Шалтгааны урт хязгаарлах (DB-ийн text-ийг unbounded гэж тавьсан ч
    // лог/имэйлд харагдах учир логик хязгаартай)
    const cleanReason = typeof reason === 'string'
      ? reason.trim().slice(0, 500) || null
      : null

    // Гэрээ + миний оролцооны мэдээллийг нэг хүсэлтэд авна.
    // ОНЦ ЧУХАЛ: cp.user_id = $2 нийт зэрэгцээ guard биш — JOIN нь хэрэв
    // хэрэглэгч оролцогч биш бол row буцаахгүй (LEFT JOIN биш). Энэ нь
    // permission-ийн нэг хэсэг.
    const cRes = await query(
      `SELECT c.contract_id, c.status, c.creator_id, c.title,
              cp.role AS my_role
       FROM contracts c
       JOIN contract_participants cp
         ON cp.contract_id = c.contract_id AND cp.user_id = $2
       WHERE c.contract_id = $1`,
      [id, req.user.user_id]
    )
    const contract = cRes.rows[0]
    if (!contract) {
      // Гэрээ байхгүй ЭСВЭЛ хэрэглэгч оролцогч биш — мэдээлэл leak болохгүй
      return res.status(403).json({ message: 'Цуцлах эрх байхгүй' })
    }

    // ── Цуцлах боломжтой статусуудыг шалгах ────────────
    // FULLY_SIGNED = хоёр тал гарын үсэг зурсан → цуцлах БОЛОМЖГҮЙ.
    // COMPLETED/CLOSED/CANCELLED/DECLINED/EXPIRED = аль хэдийн terminal.
    // DRAFT/SENT = ядаж нэг тал зураагүй → цуцлах боломжтой.
    const blocked = ['FULLY_SIGNED', 'COMPLETED', 'CANCELLED', 'CLOSED', 'DECLINED', 'EXPIRED']
    if (blocked.includes(contract.status)) {
      const msg = contract.status === 'FULLY_SIGNED'
        ? 'Хоёр тал гарын үсэг зурсан гэрээг цуцлах боломжгүй'
        : 'Энэ гэрээг цуцлах боломжгүй'
      return res.status(400).json({ message: msg })
    }

    const oldStatus = contract.status

    // ── Атомар цуцлалт + race guard ───────────────────
    // UPDATE-д WHERE status = $oldStatus оруулсанаар: хэрэв энэ хооронд
    // нөгөө тал гарын үсэг зурж FULLY_SIGNED болсон бол rowCount = 0
    // буцаагдана. Бид rollback хийнэ.
    let cancelled = false
    await withTransaction(async (db) => {
      const upd = await db.query(
        `UPDATE contracts
            SET status = 'CANCELLED', updated_at = NOW()
          WHERE contract_id = $1 AND status = $2
        RETURNING contract_id`,
        [id, oldStatus]
      )
      if (upd.rowCount === 0) {
        // Зэрэгцээ статус өөрчлөгдсөн — цуцлах боломжгүй болсон
        return
      }
      await db.query(
        `INSERT INTO contract_status_history (contract_id, from_status, to_status, changed_by, reason)
         VALUES ($1,$2,'CANCELLED',$3,$4)`,
        [id, oldStatus, req.user.user_id, cleanReason]
      )
      cancelled = true
    })

    if (!cancelled) {
      return res.status(409).json({ message: 'Гэрээний статус өөрчлөгдсөн тул цуцлах боломжгүй' })
    }

    await log({ user_id: req.user.user_id, action: LOG.CONTRACT_CANCEL, entity_type: 'contract', entity_id: id, req,
                details: { from_status: oldStatus, cancelled_by_role: contract.my_role } })

    // Бүх оролцогчдод (цуцалсан хүнээс бусад) мэдэгдэх
    await notifyParticipants(id, {
      title:        'Гэрээ цуцлагдлаа',
      message:      `"${contract.title || 'Гэрээ'}" гэрээг цуцаллаа${cleanReason ? `: ${cleanReason}` : ''}`,
      exceptUserId: req.user.user_id,
    })

    res.json({ message: 'Гэрээ цуцлагдлаа' })
  } catch (err) {
    res.status(400).json({ message: safeErrorMessage(err) })
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
    res.status(400).json({ message: safeErrorMessage(err) })
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
    res.status(400).json({ message: safeErrorMessage(err) })
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
    res.status(400).json({ message: safeErrorMessage(err) })
  }
}

// ══════════════════════════════════════════════════════
// ӨӨРЧЛӨЛТИЙН ТҮҮХ (edit log)
// GET /api/contracts/:id/edit-log
// → contract_edit_log + edited_by-н user мэдээлэл, шинэ нь эхэнд
// → Зөвхөн тухайн гэрээний оролцогч
// ══════════════════════════════════════════════════════
const getEditLog = async (req, res) => {
  try {
    const { id } = req.params

    // Оролцогч эсэх шалгах
    const partRes = await query(
      `SELECT 1 FROM contract_participants
       WHERE contract_id = $1 AND user_id = $2`,
      [id, req.user.user_id]
    )
    if (!partRes.rows[0]) return res.status(403).json({ message: 'Харах эрх байхгүй' })

    const result = await query(
      `SELECT el.edit_id, el.contract_id, el.edited_by, el.changed_fields,
              el.note, el.edited_at,
              u.first_name, u.last_name,
              cp.role AS editor_role
       FROM contract_edit_log el
       LEFT JOIN users u  ON u.user_id = el.edited_by
       LEFT JOIN contract_participants cp
         ON cp.contract_id = el.contract_id AND cp.user_id = el.edited_by
       WHERE el.contract_id = $1
       ORDER BY el.edited_at DESC`,
      [id]
    )
    res.json({ data: result.rows })
  } catch (err) {
    console.error('getEditLog error:', err)
    res.status(400).json({ message: safeErrorMessage(err) })
  }
}

// ══════════════════════════════════════════════════════
// ATTACHMENT — Гэрээний хавсралт материал (Cloudinary дээр)
// ══════════════════════════════════════════════════════
const { deleteFromCloudinary } = require('../utils/cloudinary')

// Cloudinary resource_type-ийг mimetype-аас тогтооно.
// PDF болон бүх зураг 'image' (Cloudinary PDF-ийг image-р render хийдэг).
// Зөвхөн DOC/DOCX 'raw' болно.
const resourceTypeFor = (mime) => {
  if (!mime) return 'raw'
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf') return 'image'
  return 'raw'
}

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
      await deleteFromCloudinary(req.file.filename, resourceTypeFor(req.file.mimetype))
      return res.status(404).json({ message: 'Гэрээ олдсонгүй эсвэл эрх байхгүй' })
    }

    // Lock check — гарын үсэг зурагдсан бол хавсралт нэмж болохгүй
    const sigRes = await query(
      `SELECT 1 FROM contract_signatures WHERE contract_id = $1 LIMIT 1`,
      [id]
    )
    if (sigRes.rows[0]) {
      await deleteFromCloudinary(req.file.filename, resourceTypeFor(req.file.mimetype))
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
      await deleteFromCloudinary(req.file.filename, resourceTypeFor(req.file.mimetype))
    }
    res.status(400).json({ message: safeErrorMessage(err) })
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
    await deleteFromCloudinary(att.public_id, resourceTypeFor(att.file_type))

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
    res.status(400).json({ message: safeErrorMessage(err) })
  }
}

module.exports = {
  getTemplates, getTemplateById,
  createContract, getMyContracts, getContractById,
  updateContract, sendContract,
  requestSignOtp, signContract,
  confirmContract, cancelContract, closeContract,
  submitRating, getContractRatings,
  verifyInviteToken,
  fillCounterpartyData,
  returnContract,
  getEditLog,
  uploadAttachment, deleteAttachment,
}