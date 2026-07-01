// ══════════════════════════════════════════════════════
// contract.repository.js — Гэрээний өгөгдлийн давхарга (data-access)
// Зөвхөн SQL агуулна. Бизнес логик, render, email, notification байхгүй —
// тэдгээр нь contract.controller.js-д хэвээр үлдэнэ.
//
// Транзакц: функц бүр сонголттой `exec` параметр авна. Default нь pool.
// withTransaction(async (client) => { ... }) дотроос client-ийг exec болгон
// дамжуулбал тухайн query транзакцид нэгдэнэ. `client` болон default `pool`
// хоёул адил `.query(text, params)` интерфэйстэй тул дуудлага өөрчлөгдөхгүй.
// ══════════════════════════════════════════════════════

const { query } = require('../config/db')

// Pool-level query-г .query(text, params) интерфэйс болгон боож,
// транзакцийн client-тэй ижил хэлбэртэй болгоно.
const pool = { query: (text, params) => query(text, params) }

// ── Templates ─────────────────────────────────────────

const findActiveTemplates = async (exec = pool) => {
  // schema_json (хүнд JSONB) энд ЗОРИУДААР ОРООГҮЙ — жагсаалтын карт зөвхөн
  // name/description/is_standard-г үзүүлдэг. Талбарын бүтэц (schema_json) нь
  // template сонгож форм үүсгэх үед findTemplateById-аар тусдаа татагдана.
  const r = await exec.query(
    `SELECT template_id, name, description, is_standard, is_offline_enabled, created_at
       FROM contract_templates
      WHERE is_active = true
      ORDER BY is_standard DESC, created_at DESC`
  )
  return r.rows
}

const findTemplateById = async (id, exec = pool) => {
  const r = await exec.query(
    `SELECT template_id, name, description, template_content,
            schema_json, is_standard
       FROM contract_templates
      WHERE template_id = $1 AND is_active = true`,
    [id]
  )
  return r.rows[0]
}

const findTemplateForContract = async (id, exec = pool) => {
  const r = await exec.query(
    `SELECT template_id, name, template_content, schema_json
       FROM contract_templates WHERE template_id = $1 AND is_active = true`,
    [id]
  )
  return r.rows[0]
}

// ── Contracts — үүсгэх / харах ────────────────────────

const insertContract = async ({ templateId, creatorId, title, filledData, creatorRole }, exec = pool) => {
  const r = await exec.query(
    `INSERT INTO contracts (template_id, creator_id, title, filled_data_json, creator_role)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING contract_id, contract_number, title, status, creator_role, created_at`,
    [templateId, creatorId, title, filledData, creatorRole]
  )
  return r.rows[0]
}

const insertVersion = async ({ contractId, rendered, hash }, exec = pool) => {
  const r = await exec.query(
    `INSERT INTO contract_versions
       (contract_id, rendered_content, rendered_hash)
     VALUES ($1, $2, $3)
     RETURNING version_id`,
    [contractId, rendered, hash]
  )
  return r.rows[0]
}

const insertCreatorParticipant = async (contractId, userId, exec = pool) => {
  await exec.query(
    `INSERT INTO contract_participants
       (contract_id, user_id, role, status)
     VALUES ($1,$2,'CREATOR','VIEWED')`,
    [contractId, userId]
  )
}

const findContractsForUser = async (userId, exec = pool) => {
  const r = await exec.query(
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
    [userId]
  )
  return r.rows
}

const findParticipant = async (contractId, userId, exec = pool) => {
  const r = await exec.query(
    `SELECT participant_id, role, status FROM contract_participants
     WHERE contract_id = $1 AND user_id = $2`,
    [contractId, userId]
  )
  return r.rows[0]
}

const findContractWithTemplate = async (contractId, exec = pool) => {
  const r = await exec.query(
    `SELECT c.*, t.name AS template_name, t.schema_json, t.template_content
     FROM contracts c
     LEFT JOIN contract_templates t ON c.template_id = t.template_id
     WHERE c.contract_id = $1`,
    [contractId]
  )
  return r.rows[0]
}

const updateContractData = async (contractId, data, exec = pool) => {
  await exec.query(
    `UPDATE contracts
       SET filled_data_json = $1, updated_at = NOW()
     WHERE contract_id = $2`,
    [data, contractId]
  )
}

const updateVersionRender = async (contractId, rendered, hash, exec = pool) => {
  await exec.query(
    `UPDATE contract_versions
       SET rendered_content = $1, rendered_hash = $2
     WHERE contract_id = $3`,
    [rendered, hash, contractId]
  )
}

const markParticipantViewed = async (participantId, exec = pool) => {
  await exec.query(
    `UPDATE contract_participants
       SET status = 'VIEWED'
     WHERE participant_id = $1`,
    [participantId]
  )
}

const findVersionFull = async (contractId, exec = pool) => {
  const r = await exec.query(
    `SELECT version_id, rendered_content, rendered_hash,
            pdf_url, qr_code_url,
            blockchain_hash, blockchain_at, blockchain_tx_id,
            created_at
     FROM contract_versions
     WHERE contract_id = $1`,
    [contractId]
  )
  return r.rows[0]
}

const updateVersionBlockchainBackfill = async (
  { versionId, blockHash, blockAt, blockTxId, qrDataUrl }, exec = pool
) => {
  await exec.query(
    `UPDATE contract_versions
     SET blockchain_hash = COALESCE(blockchain_hash, $1),
         blockchain_at   = COALESCE(blockchain_at, $2),
         blockchain_tx_id = COALESCE(blockchain_tx_id, $3),
         qr_code_url     = $4
     WHERE version_id = $5`,
    [blockHash, blockAt, blockTxId, qrDataUrl, versionId]
  )
}

const findParticipantsDetailed = async (contractId, exec = pool) => {
  const r = await exec.query(
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
    [contractId]
  )
  return r.rows
}

const findSignatures = async (contractId, exec = pool) => {
  const r = await exec.query(
    `SELECT cs.signature_id, cs.placeholder_key, cs.signed_at,
            cs.participant_id, cs.signature_blob,
            cp.role
     FROM contract_signatures cs
     JOIN contract_participants cp ON cs.participant_id = cp.participant_id
     WHERE cs.contract_id = $1`,
    [contractId]
  )
  return r.rows
}

const findAttachments = async (contractId, exec = pool) => {
  const r = await exec.query(
    `SELECT a.attachment_id, a.file_name, a.file_url, a.file_type,
            a.file_size, a.sort_order, a.created_at, a.uploaded_by,
            u.first_name AS uploader_first_name,
            u.last_name  AS uploader_last_name
     FROM contract_attachments a
     LEFT JOIN users u ON u.user_id = a.uploaded_by
     WHERE a.contract_id = $1
     ORDER BY a.sort_order, a.created_at`,
    [contractId]
  )
  return r.rows
}

// ── Update ────────────────────────────────────────────

const findContractForUpdate = async (contractId, userId, exec = pool) => {
  const r = await exec.query(
    `SELECT c.contract_id, c.contract_number, c.status, c.creator_id, c.creator_role, c.current_turn,
            c.filled_data_json, c.title,
            cp.role AS my_role,
            t.template_content, t.schema_json
     FROM contracts c
     LEFT JOIN contract_participants cp
       ON cp.contract_id = c.contract_id AND cp.user_id = $2
     LEFT JOIN contract_templates t ON c.template_id = t.template_id
     WHERE c.contract_id = $1`,
    [contractId, userId]
  )
  return r.rows[0]
}

const hasSignature = async (contractId, exec = pool) => {
  const r = await exec.query(
    `SELECT 1 FROM contract_signatures WHERE contract_id = $1 LIMIT 1`,
    [contractId]
  )
  return !!r.rows[0]
}

const updateContractDataAndTitle = async (contractId, data, title, exec = pool) => {
  const r = await exec.query(
    `UPDATE contracts
       SET filled_data_json = $1,
           title            = COALESCE($2, title),
           updated_at       = NOW()
     WHERE contract_id = $3
     RETURNING contract_id, contract_number, title, status`,
    [data, title, contractId]
  )
  return r.rows[0]
}

const insertEditLog = async ({ contractId, editedBy, changedFields, note = null }, exec = pool) => {
  await exec.query(
    `INSERT INTO contract_edit_log (contract_id, edited_by, changed_fields, note)
     VALUES ($1, $2, $3, $4)`,
    [contractId, editedBy, changedFields, note]
  )
}

// ── Send ──────────────────────────────────────────────

const findContractForSend = async (contractId, exec = pool) => {
  const r = await exec.query(
    `SELECT contract_id, contract_number, title, status, creator_id
     FROM contracts WHERE contract_id = $1`,
    [contractId]
  )
  return r.rows[0]
}

const countCounterparties = async (contractId, exec = pool) => {
  const r = await exec.query(
    `SELECT COUNT(*) AS cnt FROM contract_participants
     WHERE contract_id = $1 AND role = 'COUNTERPARTY'`,
    [contractId]
  )
  return parseInt(r.rows[0]?.cnt || '0', 10)
}

const insertInvitedParticipant = async ({ contractId, userId, role, email, phone }, exec = pool) => {
  const r = await exec.query(
    `INSERT INTO contract_participants
       (contract_id, user_id, role, invite_email, invite_phone, status, invited_at)
     VALUES ($1,$2,$3,$4,$5,'INVITED',NOW())
     ON CONFLICT DO NOTHING
     RETURNING participant_id, role, invite_email`,
    [contractId, userId, role, email, phone]
  )
  return r.rows[0]
}

const insertInvitation = async ({ participantId, tokenHash, email, phone }, exec = pool) => {
  await exec.query(
    `INSERT INTO participant_invitations
       (participant_id, token_hash, sent_to_email, sent_to_phone)
     VALUES ($1, $2, $3, $4)`,
    [participantId, tokenHash, email, phone]
  )
}

const markContractSent = async (contractId, exec = pool) => {
  await exec.query(
    `UPDATE contracts
       SET status       = 'SENT',
           current_turn = 'COUNTERPARTY',
           sent_at      = NOW(),
           updated_at   = NOW()
     WHERE contract_id = $1`,
    [contractId]
  )
}

// ── Sign ──────────────────────────────────────────────

// requestSignOtp + signContract хоёулаа ашиглана. title нь зөвхөн OTP имэйлд
// хэрэгтэй боловч signContract-д буцаасан ч ашиглахгүй — нэмэлт нөлөөгүй.
const findSignContext = async (contractId, userId, exec = pool) => {
  const r = await exec.query(
    `SELECT cp.participant_id, cp.role, cp.status AS my_status,
            c.status AS contract_status, c.title
     FROM contract_participants cp
     JOIN contracts c ON c.contract_id = cp.contract_id
     WHERE cp.contract_id = $1 AND cp.user_id = $2`,
    [contractId, userId]
  )
  return r.rows[0]
}

const findVersionId = async (contractId, exec = pool) => {
  const r = await exec.query(
    `SELECT version_id FROM contract_versions WHERE contract_id = $1`,
    [contractId]
  )
  return r.rows[0]
}

const upsertSignature = async (
  { contractId, participantId, versionId, placeholderKey, blob, ip, userAgent }, exec = pool
) => {
  await exec.query(
    `INSERT INTO contract_signatures
       (contract_id, participant_id, version_id, placeholder_key, signature_blob,
        signed_ip, signed_user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (contract_id, participant_id, placeholder_key) DO UPDATE
     SET signature_blob = EXCLUDED.signature_blob, signed_at = NOW()`,
    [contractId, participantId, versionId, placeholderKey, blob, ip, userAgent]
  )
}

const updateTurnAfterSign = async (contractId, nextTurn, exec = pool) => {
  await exec.query(
    `UPDATE contracts
       SET current_turn = CASE WHEN status = 'FULLY_SIGNED' THEN NULL ELSE $1::participant_role_enum END,
           updated_at   = NOW()
     WHERE contract_id = $2`,
    [nextTurn, contractId]
  )
}

const findContractStatusInfo = async (contractId, exec = pool) => {
  const r = await exec.query(
    `SELECT c.contract_id, c.status, c.title, c.creator_id, c.current_turn
     FROM contracts c WHERE c.contract_id = $1`,
    [contractId]
  )
  return r.rows[0]
}

const findParticipantContactByRole = async (contractId, role, exec = pool) => {
  const r = await exec.query(
    `SELECT cp.user_id, cp.invite_email, u.email AS user_email
     FROM contract_participants cp
     LEFT JOIN users u ON u.user_id = cp.user_id
     WHERE cp.contract_id = $1 AND cp.role = $2
     LIMIT 1`,
    [contractId, role]
  )
  return r.rows[0]
}

// ── Confirm ───────────────────────────────────────────

const findContractForConfirm = async (contractId, exec = pool) => {
  const r = await exec.query(
    `SELECT contract_id, status, creator_id, creator_role, filled_data_json
     FROM contracts WHERE contract_id = $1`,
    [contractId]
  )
  return r.rows[0]
}

const insertConfirmation = async ({ contractId, confirmedBy, versionId, ip, userAgent }, exec = pool) => {
  await exec.query(
    `INSERT INTO contract_confirmations (contract_id, confirmed_by, version_id, confirmed_ip, confirmed_user_agent)
     VALUES ($1,$2,$3,$4,$5)`,
    [contractId, confirmedBy, versionId, ip, userAgent]
  )
}

const findParticipantsWithUser = async (contractId, exec = pool) => {
  const r = await exec.query(
    `SELECT user_id, role FROM contract_participants
     WHERE contract_id = $1 AND user_id IS NOT NULL`,
    [contractId]
  )
  return r.rows
}

const insertLivestockTransaction = async (
  { contractId, sellerId, buyerId, type, count, pricePerUnit, totalAmount }, exec = pool
) => {
  await exec.query(
    `INSERT INTO livestock_transactions
       (contract_id, seller_id, buyer_id, livestock_type,
        count, price_per_unit, total_amount)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [contractId, sellerId, buyerId, type, count, pricePerUnit, totalAmount]
  )
}

const findVersionWithHash = async (contractId, exec = pool) => {
  const r = await exec.query(
    `SELECT version_id, rendered_hash FROM contract_versions
     WHERE contract_id = $1`,
    [contractId]
  )
  return r.rows[0]
}

const updateVersionBlockchain = async (
  { versionId, blockHash, blockAt, blockTxId, qrDataUrl }, exec = pool
) => {
  await exec.query(
    `UPDATE contract_versions
     SET blockchain_hash = $1,
         blockchain_at   = $2,
         blockchain_tx_id = $3,
         qr_code_url     = $4
     WHERE version_id = $5`,
    [blockHash, blockAt, blockTxId, qrDataUrl, versionId]
  )
}

const findContractTitle = async (contractId, exec = pool) => {
  const r = await exec.query(
    `SELECT title FROM contracts WHERE contract_id = $1`,
    [contractId]
  )
  return r.rows[0]
}

// ── Counterparty fill ─────────────────────────────────

const findContractForCounterpartyFill = async (contractId, userId, exec = pool) => {
  const r = await exec.query(
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
    [contractId, userId]
  )
  return r.rows[0]
}

// ── Return (negotiation) ──────────────────────────────

const findContractForReturn = async (contractId, userId, exec = pool) => {
  const r = await exec.query(
    `SELECT c.contract_id, c.contract_number, c.status, c.creator_id, c.creator_role,
            c.current_turn, c.title, c.filled_data_json,
            cp.participant_id, cp.role AS my_role,
            t.template_content, t.schema_json
     FROM contracts c
     JOIN contract_participants cp
       ON cp.contract_id = c.contract_id AND cp.user_id = $2
     LEFT JOIN contract_templates t ON c.template_id = t.template_id
     WHERE c.contract_id = $1`,
    [contractId, userId]
  )
  return r.rows[0]
}

const updateTurn = async (contractId, nextTurn, exec = pool) => {
  await exec.query(
    `UPDATE contracts
       SET current_turn = $1::participant_role_enum,
           updated_at   = NOW()
     WHERE contract_id = $2`,
    [nextTurn, contractId]
  )
}

// ── Invitation token (public) ─────────────────────────

const insertTokenAccessLog = async (
  { invitationId, tokenHashPartial, result, ip, userAgent }, exec = pool
) => {
  return exec.query(
    `INSERT INTO token_access_log
       (invitation_id, token_hash_partial, result, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [invitationId, tokenHashPartial, result, ip, userAgent]
  )
}

const findInvitationByTokenHash = async (tokenHash, exec = pool) => {
  const r = await exec.query(
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
  return r.rows[0]
}

const incrementInvitationUse = async ({ invitationId, ip, userAgent }, exec = pool) => {
  await exec.query(
    `UPDATE participant_invitations
     SET use_count        = use_count + 1,
         last_used_at     = NOW(),
         first_ip         = COALESCE(first_ip, $1::inet),
         first_user_agent = COALESCE(first_user_agent, $2)
     WHERE invitation_id = $3`,
    [ip, userAgent, invitationId]
  )
}

const markParticipantLinkOpened = async (participantId, exec = pool) => {
  await exec.query(
    `UPDATE contract_participants
     SET status = 'LINK_OPENED', link_opened_at = NOW()
     WHERE participant_id = $1`,
    [participantId]
  )
}

// ── Cancel ────────────────────────────────────────────

const findContractForCancel = async (contractId, userId, exec = pool) => {
  const r = await exec.query(
    `SELECT c.contract_id, c.status, c.creator_id, c.title,
            cp.role AS my_role
     FROM contracts c
     JOIN contract_participants cp
       ON cp.contract_id = c.contract_id AND cp.user_id = $2
     WHERE c.contract_id = $1`,
    [contractId, userId]
  )
  return r.rows[0]
}

// Race guard: WHERE status = $2 — энэ хооронд статус өөрчлөгдсөн бол rowCount=0.
const cancelContractIfStatus = async (contractId, oldStatus, exec = pool) => {
  const r = await exec.query(
    `UPDATE contracts
        SET status = 'CANCELLED', updated_at = NOW()
      WHERE contract_id = $1 AND status = $2
    RETURNING contract_id`,
    [contractId, oldStatus]
  )
  return r.rowCount
}

const insertStatusHistory = async (
  { contractId, fromStatus, toStatus, changedBy, reason }, exec = pool
) => {
  await exec.query(
    `INSERT INTO contract_status_history (contract_id, from_status, to_status, changed_by, reason)
     VALUES ($1,$2,$3,$4,$5)`,
    [contractId, fromStatus, toStatus, changedBy, reason]
  )
}

// ── Close ─────────────────────────────────────────────

const findContractForClose = async (contractId, exec = pool) => {
  const r = await exec.query(
    `SELECT contract_id, status, creator_id, title FROM contracts WHERE contract_id = $1`,
    [contractId]
  )
  return r.rows[0]
}

const closeContractRow = async (contractId, reason, exec = pool) => {
  await exec.query(
    `UPDATE contracts
     SET status = 'CLOSED',
         closed_at = NOW(),
         close_reason = $1,
         updated_at = NOW()
     WHERE contract_id = $2`,
    [reason, contractId]
  )
}

// ── Ratings ───────────────────────────────────────────

const findRatingEligibility = async (contractId, raterId, ratedUserId, exec = pool) => {
  const r = await exec.query(
    `SELECT c.status,
            EXISTS(SELECT 1 FROM contract_participants
                   WHERE contract_id = $1 AND user_id = $2) AS rater_in,
            EXISTS(SELECT 1 FROM contract_participants
                   WHERE contract_id = $1 AND user_id = $3) AS rated_in
     FROM contracts c WHERE c.contract_id = $1`,
    [contractId, raterId, ratedUserId]
  )
  return r.rows[0]
}

const upsertRating = async ({ contractId, raterId, ratedUserId, rating, comment }, exec = pool) => {
  const r = await exec.query(
    `INSERT INTO user_ratings (contract_id, rater_id, rated_user_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (contract_id, rater_id, rated_user_id)
     DO UPDATE SET rating = EXCLUDED.rating,
                   comment = EXCLUDED.comment,
                   created_at = NOW()
     RETURNING rating_id, rating, comment, created_at`,
    [contractId, raterId, ratedUserId, rating, comment]
  )
  return r.rows[0]
}

const isParticipant = async (contractId, userId, exec = pool) => {
  const r = await exec.query(
    `SELECT 1 FROM contract_participants WHERE contract_id = $1 AND user_id = $2`,
    [contractId, userId]
  )
  return !!r.rows[0]
}

const findContractRatings = async (contractId, exec = pool) => {
  const r = await exec.query(
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
    [contractId]
  )
  return r.rows
}

// ── Edit log ──────────────────────────────────────────

const findEditLog = async (contractId, exec = pool) => {
  const r = await exec.query(
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
    [contractId]
  )
  return r.rows
}

// ── Attachments ───────────────────────────────────────

const findContractForAttachment = async (contractId, userId, exec = pool) => {
  const r = await exec.query(
    `SELECT c.contract_id, c.status, c.creator_id,
            cp.participant_id, cp.role AS my_role
     FROM contracts c
     JOIN contract_participants cp
       ON cp.contract_id = c.contract_id AND cp.user_id = $2
     WHERE c.contract_id = $1`,
    [contractId, userId]
  )
  return r.rows[0]
}

const nextAttachmentOrder = async (contractId, exec = pool) => {
  const r = await exec.query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
     FROM contract_attachments WHERE contract_id = $1`,
    [contractId]
  )
  return r.rows[0].next_order
}

const insertAttachment = async (
  { contractId, uploadedBy, fileName, fileUrl, publicId, fileType, fileSize, sortOrder }, exec = pool
) => {
  const r = await exec.query(
    `INSERT INTO contract_attachments
       (contract_id, uploaded_by, file_name, file_url, public_id,
        file_type, file_size, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING attachment_id, file_name, file_url, file_type,
               file_size, sort_order, created_at, uploaded_by`,
    [contractId, uploadedBy, fileName, fileUrl, publicId, fileType, fileSize, sortOrder]
  )
  return r.rows[0]
}

const findAttachmentById = async (attachmentId, contractId, exec = pool) => {
  const r = await exec.query(
    `SELECT attachment_id, public_id, file_type, uploaded_by
     FROM contract_attachments
     WHERE attachment_id = $1 AND contract_id = $2`,
    [attachmentId, contractId]
  )
  return r.rows[0]
}

const deleteAttachmentById = async (attachmentId, exec = pool) => {
  await exec.query(
    `DELETE FROM contract_attachments WHERE attachment_id = $1`,
    [attachmentId]
  )
}

module.exports = {
  // templates
  findActiveTemplates, findTemplateById, findTemplateForContract,
  // contracts core
  insertContract, insertVersion, insertCreatorParticipant,
  findContractsForUser, findParticipant, findContractWithTemplate,
  updateContractData, updateVersionRender, markParticipantViewed,
  findVersionFull, updateVersionBlockchainBackfill,
  findParticipantsDetailed, findSignatures, findAttachments,
  // update
  findContractForUpdate, hasSignature, updateContractDataAndTitle, insertEditLog,
  // send
  findContractForSend, countCounterparties, insertInvitedParticipant,
  insertInvitation, markContractSent,
  // sign
  findSignContext, findVersionId, upsertSignature, updateTurnAfterSign,
  findContractStatusInfo, findParticipantContactByRole,
  // confirm
  findContractForConfirm, insertConfirmation, findParticipantsWithUser,
  insertLivestockTransaction, findVersionWithHash, updateVersionBlockchain,
  findContractTitle,
  // counterparty fill
  findContractForCounterpartyFill,
  // return
  findContractForReturn, updateTurn,
  // invitation token
  insertTokenAccessLog, findInvitationByTokenHash, incrementInvitationUse,
  markParticipantLinkOpened,
  // cancel
  findContractForCancel, cancelContractIfStatus, insertStatusHistory,
  // close
  findContractForClose, closeContractRow,
  // ratings
  findRatingEligibility, upsertRating, isParticipant, findContractRatings,
  // edit log
  findEditLog,
  // attachments
  findContractForAttachment, nextAttachmentOrder, insertAttachment,
  findAttachmentById, deleteAttachmentById,
}
