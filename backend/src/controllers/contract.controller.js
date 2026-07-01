const crypto              = require('crypto')
const Handlebars          = require('handlebars')
const { withTransaction } = require('../config/db')
const repo                = require('../repositories/contract.repository')
const { renderContract, renderPreview, extractPlaceholders } = require('../utils/render')
const { sendInviteEmail, sendContractEventEmail, sendSignOtpEmail } = require('../utils/email')
const { generateOtp, saveOtp, verifyOtp: verifyOtpUtil } = require('../utils/otp')
const { log, LOG }        = require('../utils/logger')
const { notify, notifyParticipants } = require('../utils/notifier')
const { addBlock, anchorOnChain, setBlockOnchainTx } = require('../utils/blockchain')
const { generateQRDataUrl }          = require('../utils/qrcode')
const { safeErrorMessage }           = require('../utils/errors')
// ── Public frontend base URL ─────────────────────────────
// FRONTEND_URL нь CORS-д зориулж comma-аар тусгаарласан олон origin
// (production + Vercel preview wildcard + localhost) байж болно. Гэвч
// имэйлийн линк / QR-д ганц бодит хаяг хэрэгтэй. Тиймээс эхний wildcard
// биш, бодит хаягийг сонгож авна (trailing "/" арилгана).
const publicFrontendUrl = () => {
  const raw = process.env.FRONTEND_URL || 'http://localhost:3000'
  const first = raw
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter((s) => s && !s.includes('*'))[0]
  return first || 'http://localhost:3000'
}

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
    const tmpl = await repo.findTemplateForContract(template_id)
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
      const c = await repo.insertContract({
        templateId:  template_id,
        creatorId:   req.user.user_id,
        title:       title || tmpl.name,
        filledData:  enriched,
        creatorRole: creator_role,
      }, db)

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
      const version = await repo.insertVersion(
        { contractId: c.contract_id, rendered, hash }, db
      )

      // Creator-г CREATOR role-той participant болгон нэмэх
      // Status='VIEWED' — бодит signature_blob орохоос өмнө 'SIGNED' болгохгүй.
      // /sign endpoint signature оруулсны дараа trigger автоматаар SIGNED болгоно.
      await repo.insertCreatorParticipant(c.contract_id, req.user.user_id, db)

      return { contract: c, rendered, versionId: version.version_id }
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
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ── Миний гэрээнүүд ───────────────────────────────────

const getMyContracts = async (req, res) => {
  try {
    const rows = await repo.findContractsForUser(req.user.user_id)
    res.json({ data: rows })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ── Нэг гэрээний дэлгэрэнгүй 

const getContractById = async (req, res) => {
  try {
    const { id } = req.params

    // Оролцогч эсэх шалгах
    const myParticipantRow = await repo.findParticipant(id, req.user.user_id)
    if (!myParticipantRow) return res.status(403).json({ message: 'Харах эрх байхгүй' })

    // Хариу JSON-д буцаах my_status шинэчлэгдсэн утгаар явахын тулд reference барина
    // (auto-fill block доор myParticipant.status-г өөрчилнө)

    // Гэрээний мэдээлэл — template_content-ийг ч авна (re-render-д хэрэгтэй)
    const contract = await repo.findContractWithTemplate(id)
    if (!contract) return res.status(404).json({ message: 'Гэрээ олдсонгүй' })

    // ── Auto-fill: үзэгчийн өөрийн талын мэдээлэл (name/phone/email/address)
    //    хоосон бол user профайлаас дүүргээд contract-ыг re-render хийнэ ──
    // Зөвхөн lock-гүй (DRAFT/SENT) үед, бичих ажил байвал л хийнэ (idempotent).
    // CREATOR-д createContract аль хэдийн хийсэн боловч user профайл сүүлд
    // шинэчлэгдсэн бол энэ хэсэг засна. COUNTERPARTY-н хувьд анхны үзэлтэд эхэлж дүүргэгдэнэ.
    const myParticipant = myParticipantRow
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

          await repo.updateContractData(id, newData)
          await repo.updateVersionRender(id, rendered, hash)

          contract.filled_data_json = newData
        }

        // Counterparty анх удаа орж ирсэн бол status-ийг VIEWED болгох
        // (status гэрчилгээний түүхэнд ач холбогдолтой)
        if (
          myParticipant.role === 'COUNTERPARTY' &&
          ['INVITED', 'LINK_OPENED', 'REGISTERED'].includes(myParticipant.status)
        ) {
          await repo.markParticipantViewed(myParticipant.participant_id)
          myParticipant.status = 'VIEWED'
        }
      } catch (err) {
        console.error('Profile auto-fill failed:', err.message)
        // Auto-fill амжилтгүй ч main flow зогсохгүй
      }
    }

    // ── Үлдсэн уншилтуудыг зэрэг (parallel) гүйцэтгэх ──
    // Дөрвүүлээ хоорондоо хамааралгүй бөгөөд бүгд дээрх auto-fill-ийн
    // (updateVersionRender) ДАРАА уншигдах ёстой тул энд нэг Promise.all-аар
    // нэгтгэв. 4 round-trip → 1 болж latency буурна.
    const [versionRow, participants, signatures, attachments] = await Promise.all([
      repo.findVersionFull(id),        // contract_versions — ганц row (Migration 007)
      repo.findParticipantsDetailed(id), // profile_image_url + үнэлгээний дундаж/тоо
      repo.findSignatures(id),           // гарын үсгүүд
      repo.findAttachments(id),          // хавсралт материал
    ])

    // Version байхгүй бол (DRAFT) preview render хийнэ
    let latestVersion = versionRow || null
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

        const verifyUrl = `${publicFrontendUrl()}/verify/${id}`
        const qrDataUrl = await generateQRDataUrl(verifyUrl)

        await repo.updateVersionBlockchainBackfill({
          versionId: latestVersion.version_id,
          blockHash, blockAt, blockTxId, qrDataUrl,
        })

        latestVersion.blockchain_hash  = blockHash
        latestVersion.blockchain_at    = blockAt
        latestVersion.blockchain_tx_id = blockTxId
        latestVersion.qr_code_url      = qrDataUrl
      } catch (err) {
        console.error('QR backfill failed:', err.message)
      }
    }
    // ── Display зориулалтаар гарын үсэгтэй дахин рендер ──
    // schema-д signature key-уудыг нэмж, filled_data-д <img> blob нэмнэ
    if (contract.template_content && signatures.length > 0) {
      const baseFields = contract.schema_json?.fields || []
      const sigFields  = signatures.map(s => ({
        type: 'signature',
        key:  s.placeholder_key,
      }))
      const displaySchema = { ...contract.schema_json, fields: [...baseFields, ...sigFields] }

      // filled_data-д nested signature blob тавих
      // SafeString-ээр боож, signature_blob утгыг HTML-attribute escape хийнэ
      // (XSS-аас сэргийлэх — хуучин буюу зөрчилтэй blob утга байсан ч аюулгүй).
      const displayData = JSON.parse(JSON.stringify(contract.filled_data_json || {}))
      signatures.forEach(s => {
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
        my_role:        myParticipantRow.role,
        my_status:      myParticipantRow.status,
        latest_version: latestVersion,
        participants:   participants,
        signatures:     signatures,
        attachments:    attachments,
      },
    })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}
const updateContract = async (req, res) => {
  try {
    const { id } = req.params
    const { filled_data_json, title, note } = req.body
    const cleanNote = typeof note === 'string'
      ? note.trim().slice(0, 1000) || null
      : null

    const contract = await repo.findContractForUpdate(id, req.user.user_id)
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
    if (await repo.hasSignature(id)) {
      return res.status(400).json({ message: 'Гарын үсэг зурагдсан гэрээг засаж болохгүй' })
    }

    const oldData = contract.filled_data_json || {}
    // ── Counterparty privilege guard ──────────────────────
    // Үүсгэгч (creator) бүх талбарыг засаж болно. Нөгөө тал (counterparty)
    // нь хэлэлцээрийн нөхцөлүүдийг (мал, хүргэлт, төлбөр) болон өөрийн талын
    // мэдээлэл (нэр/утас/имейл/хаяг/регистр)-г засна. Гэхдээ ҮҮСГЭГЧИЙН талын
    // хувийн мэдээллийг солихоос сэргийлнэ (creator_role subtree хамгаалагдана).
    // Бүх өөрчлөлт turn-based + change-log-той тул хэлэлцээрийн хүрээнд хяналттай.
    let newData
    if (isCreator) {
      newData = filled_data_json || oldData
    } else {
      const incoming = filled_data_json || {}
      newData = {
        ...oldData,
        ...incoming,
        // Үүсгэгчийн талын хувийн мэдээллийг хуучнаар нь үлдээнэ (солих эрхгүй)
        [contract.creator_role]: oldData[contract.creator_role] || {},
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
    await repo.updateVersionRender(id, rendered, hash)

    // ── contracts шинэчлэх ────────────────────────────
    const updated = await repo.updateContractDataAndTitle(id, newData, title || null)

    // ── Аудит — өөрчлөгдсөн талбаруудыг л log хийх ────
    const diff = computeJsonDiff(oldData, newData)
    if (Object.keys(diff).length > 0 || cleanNote) {
      await repo.insertEditLog({
        contractId: id,
        editedBy: req.user.user_id,
        changedFields: JSON.stringify(diff),
        note: cleanNote,
      })
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
        ...updated,
        rendered_content: rendered,
        changed_fields_count: Object.keys(diff).length,
      },
    })
  } catch (err) {
    console.error('updateContract error:', err)
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}
const sendContract = async (req, res) => {
  try {
    const { id } = req.params
    const { participants, email_subject } = req.body
    // participants:   [{ role: 'COUNTERPARTY', email, phone, user_id? }]
    // email_subject?: AddParticipantModal-аас ирсэн custom invite subject

    const contract = await repo.findContractForSend(id)
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
    const existingCpCount = await repo.countCounterparties(id)
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
        const addedPart = await repo.insertInvitedParticipant({
          contractId: id,
          userId:     p.user_id || null,
          role:       p.role || 'COUNTERPARTY',
          email:      p.email || null,
          phone:      p.phone || null,
        }, db)
        if (addedPart) {
          addedRows.push(addedPart)

          // ── Invitation token үүсгэж participant_invitations-д хадгалах ──
          const token     = generateInviteToken()
          const tokenHash = hashToken(token)
          await repo.insertInvitation({
            participantId: addedPart.participant_id,
            tokenHash,
            email: p.email || null,
            phone: p.phone || null,
          }, db)

          if (p.email)   emailQueue.push({ to: p.email, token })
          if (p.user_id) notifyQueue.push({ user_id: p.user_id })
        }
      }

      // Contract-г SENT болгох + ээлж нөгөө талд шилжих
      await repo.markContractSent(id, db)

      return addedRows
    })

    // ── Имэйл болон notification — commit-ийн дараа ──
    const senderName = `${req.user.last_name} ${req.user.first_name}`
    for (const e of emailQueue) {
      // Token-г URL fragment-д (# дараа) тавьсанаар Referer / server лог /
      // Slack OG preview гэх мэт газруудад token leak хийгдэхгүй.
      const inviteUrl = `${publicFrontendUrl()}/invite#token=${e.token}`
      await sendInviteEmail({
        to: e.to,
        contractTitle: contract.title,
        inviteUrl,
        senderName,
        customSubject: email_subject,
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
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
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
    const part = await repo.findSignContext(id, req.user.user_id)
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
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
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
    const part = await repo.findSignContext(id, req.user.user_id)
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
    const version = await repo.findVersionId(id)
    if (!version) return res.status(400).json({ message: 'Гэрээний хувилбар олдсонгүй' })

    // Гарын үсэг хадгалах
    await repo.upsertSignature({
      contractId:     id,
      participantId:  part.participant_id,
      versionId:      version.version_id,
      placeholderKey: placeholder_key,
      blob:           signature_blob,
      ip:             req.ip,
      userAgent:      req.headers['user-agent'],
    })
    // → after_signature_insert trigger: participant.status = SIGNED
    // → after_participant_signed trigger: contract.status шинэчлэгдэнэ

    await log({ user_id: req.user.user_id, action: LOG.CONTRACT_SIGN, entity_type: 'contract', entity_id: id, req })

    // ── Ээлж шилжүүлэх (нөгөө тал зурах ёстой) ──────
    // FULLY_SIGNED болсон үед current_turn = NULL (хэн ч хүлээхгүй)
    const nextTurn = part.role === 'CREATOR' ? 'COUNTERPARTY' : 'CREATOR'
    await repo.updateTurnAfterSign(id, nextTurn)

    // ── Notification logic ──────────────────────────
    const updatedContract = await repo.findContractStatusInfo(id)
    const signerName = `${req.user.last_name} ${req.user.first_name}`.trim()

    // Эсрэг талын user_id + email-г олж IN_APP + EMAIL хосоор мэдэгдэх
    const otherSideRole = part.role === 'CREATOR' ? 'COUNTERPARTY' : 'CREATOR'
    const other = await repo.findParticipantContactByRole(id, otherSideRole)
    const contractUrl = `${publicFrontendUrl()}/dashboard/contracts/${id}`

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
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ── Баталгаажуулах ────────────────────────────────────

const confirmContract = async (req, res) => {
  try {
    const { id } = req.params

    const contract = await repo.findContractForConfirm(id)
    if (!contract) return res.status(404).json({ message: 'Гэрээ олдсонгүй' })
    if (contract.creator_id !== req.user.user_id) return res.status(403).json({ message: 'Эрх байхгүй' })
    if (contract.status !== 'FULLY_SIGNED') return res.status(400).json({ message: 'Бүх оролцогч гарын үсэг зурсан байх ёстой' })

    const confirmVersion = await repo.findVersionId(id)

    await repo.insertConfirmation({
      contractId:  id,
      confirmedBy: req.user.user_id,
      versionId:   confirmVersion.version_id,
      ip:          req.ip,
      userAgent:   req.headers['user-agent'],
    })
    // → after_confirmation_insert trigger: status = COMPLETED

    // ── Малын гүйлгээ хадгалах ──────────────────────────
    // creator_role-аас seller/buyer-ийг тогтоож livestock_transactions-д INSERT.
    // Бүх мөрийг нэг транзакцид: дунд алдвал бүгд rollback (хагас гүйлгээ
    // үлдэхээс сэргийлнэ). Гэрээ COMPLETED хэвээр — статистик дутах нь
    // main flow-ыг хаахгүй (анхны бизнес логик хадгалагдсан).
    try {
      const parts = await repo.findParticipantsWithUser(id)
      const counterparty = parts.find(p => p.role === 'COUNTERPARTY')
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
              await repo.insertLivestockTransaction({
                contractId:   id,
                sellerId,
                buyerId,
                type,
                count:        cnt,
                pricePerUnit: price,
                totalAmount:  cnt * price,
              }, db)
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
      const ver = await repo.findVersionWithHash(id)
      if (ver) {
        // 1. Шинэ блок үүсгэх
        const block = await addBlock(id, ver.rendered_hash)

        // 2. Public verification URL → QR
        const verifyUrl = `${publicFrontendUrl()}/verify/${id}`
        const qrDataUrl = await generateQRDataUrl(verifyUrl)

        // 3. contract_versions-д blockchain мэдээллийг шинэчлэх
        await repo.updateVersionBlockchain({
          versionId: ver.version_id,
          blockHash: block.block_hash,
          blockAt:   block.timestamp,
          blockTxId: block.block_id,
          qrDataUrl,
        })

        // 4. (Сонголтоор) жинхэнэ testnet рүү анкорлох — BLOCKCHAIN_MODE=testnet.
        //    DB ledger хэвээр; зөвхөн hash-ыг гинж рүү тавьж tx hash-ыг хадгална.
        try {
          const anchor = await anchorOnChain(ver.rendered_hash)
          if (anchor) {
            await setBlockOnchainTx(block.block_id, anchor.txHash, anchor.network)
          }
        } catch (anchorErr) {
          console.error('Testnet anchor failed:', anchorErr.message)
          // Анкор амжилтгүй ч DB ledger хүчинтэй — main flow зогсохгүй
        }
      }
    } catch (err) {
      console.error('Blockchain registration failed:', err.message)
      // Confirm амжилттай — blockchain дутуу хадгалалт main flow-ыг зогсоохгүй
    }

    // Бүх оролцогчдод (creator-аас бусад) баталгаажсан тухай мэдэгдэх
    const titleRow = await repo.findContractTitle(id)
    await notifyParticipants(id, {
      title:        'Гэрээ баталгаажлаа ✓',
      message:      `"${titleRow?.title || 'Гэрээ'}" амжилттай баталгаажиж, хүчин төгөлдөр болсон`,
      exceptUserId: req.user.user_id,
    })

    res.json({ message: 'Гэрээ баталгаажлаа' })
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
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
    const contract = await repo.findContractForCounterpartyFill(id, req.user.user_id)
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
      await repo.updateVersionRender(id, rendered, hash)
    }

    // ── contracts шинэчлэх ──
    await repo.updateContractData(id, newData)

    // ── Аудит — өөрчлөгдсөн талбаруудыг л log хийх ──
    const diff = computeJsonDiff(contract.filled_data_json || {}, newData)
    if (Object.keys(diff).length > 0) {
      await repo.insertEditLog({
        contractId: id,
        editedBy: req.user.user_id,
        changedFields: JSON.stringify(diff),
      })
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
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
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
const returnContract = async (req, res) => {
  try {
    const { id } = req.params
    const { filled_data_json, note } = req.body
    const cleanNote = typeof note === 'string'
      ? note.trim().slice(0, 1000) || null
      : null

    // Гэрээ + миний participant role-ийг шалгах
    const contract = await repo.findContractForReturn(id, req.user.user_id)
    if (!contract)                return res.status(404).json({ message: 'Гэрээ олдсонгүй эсвэл эрх байхгүй' })
    if (contract.status !== 'SENT') return res.status(400).json({ message: 'Зөвхөн илгээгдсэн гэрээг буцаах боломжтой' })
    if (contract.my_role !== contract.current_turn) {
      return res.status(403).json({ message: 'Одоо таны ээлж биш байна' })
    }

    // Гарын үсэг зурагдсан эсэхийг шалгах (LOCK)
    if (await repo.hasSignature(id)) {
      return res.status(400).json({ message: 'Гарын үсэг зурагдсан гэрээг засаж болохгүй' })
    }

    const oldData = contract.filled_data_json || {}
    // ── Counterparty privilege guard ──────────────────────
    // updateContract-тай ижил логик: counterparty хэлэлцээрийн нөхцөл болон
    // өөрийн талын мэдээллийг засна, гэхдээ ҮҮСГЭГЧИЙН талын хувийн мэдээллийг
    // солихгүй. Creator бүх талбарыг засаж болно.
    const isCreator = contract.creator_id === req.user.user_id
    let newData
    if (isCreator) {
      newData = filled_data_json || oldData
    } else {
      const incoming = filled_data_json || {}
      newData = {
        ...oldData,
        ...incoming,
        // Үүсгэгчийн талын хувийн мэдээллийг хуучнаар нь үлдээнэ (солих эрхгүй)
        [contract.creator_role]: oldData[contract.creator_role] || {},
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
        await repo.updateVersionRender(id, rendered, hash)
      }

      await repo.updateContractData(id, newData)
    }

    // ── edit_log: өөрчлөлт ЭСВЭЛ зөвхөн note бичсэн бол үлдээнэ ──
    if (hasChanges || cleanNote) {
      await repo.insertEditLog({
        contractId: id,
        editedBy: req.user.user_id,
        changedFields: JSON.stringify(diff),
        note: cleanNote,
      })
    }

    // ── Ээлж шилжүүлэх ───────────────────────────────
    const nextTurn = contract.my_role === 'CREATOR' ? 'COUNTERPARTY' : 'CREATOR'
    await repo.updateTurn(id, nextTurn)

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
    const other = await repo.findParticipantContactByRole(id, nextTurn)
    const actorName = `${req.user.last_name} ${req.user.first_name}`.trim()
    const contractUrl = `${publicFrontendUrl()}/dashboard/contracts/${id}`

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
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ── Invitation token шалгах (PUBLIC — auth шаардахгүй) ──
// Email-ээр ирсэн линк дээр дарахад дуудагдана.
// Хариу: { contract_id, participant_email, has_user_account, role, status }

const verifyInviteToken = async (req, res) => {
  const { token } = req.params
  const tokenHash = hashToken(token)

  const logAttempt = async (invitationId, result) => {
    await repo.insertTokenAccessLog({
      invitationId:     invitationId || null,
      tokenHashPartial: tokenHash.slice(0, 16),
      result,
      ip:               req.ip,
      userAgent:        req.headers['user-agent'],
    }).catch(() => {})
  }

  try {
    // EXISTS subquery — invite_email-тэй таарах хэрэглэгч users хүснэгтэд байгаа эсэхийг шалгана.
    // Энэ нь counterparty өмнө бүртгэгдсэн хэдий ч participant_invitations
    // үүсгэх үед user_id-аар холбогдоогүй (зөвхөн email-ээр) тохиолдолд хэрэгтэй.
    const inv = await repo.findInvitationByTokenHash(tokenHash)

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
    await repo.incrementInvitationUse({
      invitationId: inv.invitation_id,
      ip:           req.ip,
      userAgent:    req.headers['user-agent'] || null,
    })

    // INVITED → LINK_OPENED болгох
    if (inv.status === 'INVITED') {
      await repo.markParticipantLinkOpened(inv.participant_id)
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
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
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
    const contract = await repo.findContractForCancel(id, req.user.user_id)
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
      const rowCount = await repo.cancelContractIfStatus(id, oldStatus, db)
      if (rowCount === 0) {
        // Зэрэгцээ статус өөрчлөгдсөн — цуцлах боломжгүй болсон
        return
      }
      await repo.insertStatusHistory({
        contractId: id,
        fromStatus: oldStatus,
        toStatus:   'CANCELLED',
        changedBy:  req.user.user_id,
        reason:     cleanReason,
      }, db)
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
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
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

    const contract = await repo.findContractForClose(id)
    if (!contract) return res.status(404).json({ message: 'Гэрээ олдсонгүй' })
    if (contract.creator_id !== req.user.user_id) {
      return res.status(403).json({ message: 'Зөвхөн үүсгэгч хаах эрхтэй' })
    }
    if (contract.status !== 'COMPLETED') {
      return res.status(400).json({ message: 'Зөвхөн баталгаажсан гэрээг хаах боломжтой' })
    }

    await repo.closeContractRow(id, reason || null)

    await repo.insertStatusHistory({
      contractId: id,
      fromStatus: 'COMPLETED',
      toStatus:   'CLOSED',
      changedBy:  req.user.user_id,
      reason:     reason || 'creator closed',
    })

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
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

// ӨӨРЧЛӨЛТИЙН ТҮҮХ (edit log)
// GET /api/contracts/:id/edit-log
// → contract_edit_log + edited_by-н user мэдээлэл, шинэ нь эхэнд
// → Зөвхөн тухайн гэрээний оролцогч
const getEditLog = async (req, res) => {
  try {
    const { id } = req.params

    // Оролцогч эсэх шалгах
    if (!(await repo.isParticipant(id, req.user.user_id))) {
      return res.status(403).json({ message: 'Харах эрх байхгүй' })
    }

    const rows = await repo.findEditLog(id)
    res.json({ data: rows })
  } catch (err) {
    console.error('getEditLog error:', err)
    res.status(err.statusCode || 500).json({ message: safeErrorMessage(err) })
  }
}

module.exports = {
  createContract, getMyContracts, getContractById,
  updateContract, sendContract,
  requestSignOtp, signContract,
  confirmContract, cancelContract, closeContract,
  verifyInviteToken,
  fillCounterpartyData,
  returnContract,
  getEditLog,
}