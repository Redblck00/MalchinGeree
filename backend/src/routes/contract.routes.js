const express = require('express')
const router  = express.Router()
const auth    = require('../middlewares/auth.middleware')
const c       = require('../controllers/contract.controller')
const att     = require('../controllers/contractAttachment.controller')
const tmpl    = require('../controllers/contractTemplate.controller')
const rating  = require('../controllers/contractRating.controller')
const { attachmentUpload, handleUploadError } = require('../utils/upload')
const { signOtpLimiter } = require('../middlewares/rateLimit.middleware')

// ══════════════════════════════════════════════════════
// PUBLIC — нэвтрэлт шаардахгүй
// ══════════════════════════════════════════════════════

// POST /api/contracts/invite/:token/verify
// Email-ээр ирсэн урилгын линк дарахад дуудагдана
// → { contract_id, participant_email, has_user_account, role, status }
router.post('/invite/:token/verify', c.verifyInviteToken)

// ══════════════════════════════════════════════════════
// AUTHENTICATED — JWT шаардлагатай
// ══════════════════════════════════════════════════════
router.use(auth)

// ══════════════════════════════════════════════════════
// TEMPLATE ХАРАХ — хэрэглэгчид
// ══════════════════════════════════════════════════════

// GET /api/contracts/templates
// → is_active=true template-уудын жагсаалт (schema_json-тай, content-гүй)
router.get('/templates',            tmpl.getTemplates)

// GET /api/contracts/templates/:id
// → Нэг template-ийн schema_json (форм үүсгэхэд хэрэгтэй)
router.get('/templates/:id',        tmpl.getTemplateById)

// ══════════════════════════════════════════════════════
// ГЭРЭЭ ҮҮСГЭХ
// ══════════════════════════════════════════════════════

// POST /api/contracts
// Body: {
//   template_id,
//   title?,
//   filled_data_json: { seller: {...}, buyer: {...}, livestock: [...], ... }
// }
// → template_content + filled_data_json → Handlebars render
// → contracts + contract_versions хүснэгтэд хадгална
// → creator CREATOR role-той participant болно
router.post('/',                    c.createContract)

// ══════════════════════════════════════════════════════
// ГЭРЭЭ ХАРАХ
// ══════════════════════════════════════════════════════

// GET /api/contracts
// → Миний оролцсон бүх гэрээ (contract_participants-аар)
router.get('/',                     c.getMyContracts)

// GET /api/contracts/:id
// → Нэг гэрээний дэлгэрэнгүй:
//   contract + latest_version (rendered_content) + participants + signatures
router.get('/:id',                  c.getContractById)

// ══════════════════════════════════════════════════════
// ГЭРЭЭ ЗАСАХ — зөвхөн DRAFT үед
// ══════════════════════════════════════════════════════

// PATCH /api/contracts/:id
// Body: { filled_data_json?, title? }
// → Дахин render хийж шинэ version үүснэ
router.patch('/:id',                c.updateContract)

// ══════════════════════════════════════════════════════
// ГЭРЭЭ ИЛГЭЭХ — нөгөө талд
// ══════════════════════════════════════════════════════

// POST /api/contracts/:id/send
// Body: {
//   participants: [
//     { role: 'COUNTERPARTY', email: '...', phone: '...', user_id?: '...' }
//   ]
// }
// → contract_participants үүснэ
// → Имейлээр урилга явна
// → contract.status = SENT болно
router.post('/:id/send',            c.sendContract)

// ══════════════════════════════════════════════════════
// ГАРЫН ҮСЭГ ЗУРАХ
// ══════════════════════════════════════════════════════

// POST /api/contracts/:id/sign/request-otp
// → Хэрэглэгчийн нэвтэрсэн имэйл рүү 6 оронтой OTP илгээнэ (5 минут хүчинтэй)
// → Rate limit: 15 минутад 5 удаа
// → /sign endpoint-д заавал шаардлагатай otp_code-ийг бэлдэх
router.post('/:id/sign/request-otp', signOtpLimiter, c.requestSignOtp)

// POST /api/contracts/:id/sign
// Body: { signature_blob: 'data:image/...;base64,...',
//         placeholder_key: 'seller_signature',
//         otp_code: '123456' }    ← заавал
// → contract_signatures хүснэгтэд хадгална
// → Trigger: participant.status = SIGNED
// → Trigger: бүгд зурсан бол contract.status = FULLY_SIGNED
router.post('/:id/sign',            c.signContract)

// ══════════════════════════════════════════════════════
// COUNTERPARTY ӨӨРИЙН МЭДЭЭЛЭЛ БӨГЛӨХ
// ══════════════════════════════════════════════════════

// PATCH /api/contracts/:id/counterparty-fill
// Body: { filled_data: { name, phone, email, address } }
// → Зөвхөн нөгөө талын role-ын талбарыг merge хийж шинэ version үүсгэнэ
router.patch('/:id/counterparty-fill', c.fillCounterpartyData)

// ══════════════════════════════════════════════════════
// NEGOTIATION — засаад нөгөө талд буцаах
// ══════════════════════════════════════════════════════

// POST /api/contracts/:id/return
// Body: { filled_data_json?: {...}, note?: string }
// → SENT status, current_turn-той тал л дуудна
// → filled_data өөрчилсөн бол contract_versions UPDATE + edit_log (note-той)
// → current_turn нөгөө талд шилжинэ
// → Нөгөө талд in-app + email notification (note preview-д)
router.post('/:id/return', c.returnContract)

// GET /api/contracts/:id/edit-log
// → Гэрээний бүх өөрчлөлтийн түүх (changed_fields JSON + note + editor name)
// → Зөвхөн оролцогч
router.get('/:id/edit-log', c.getEditLog)

// ══════════════════════════════════════════════════════
// БАТАЛГААЖУУЛАХ — үүсгэгч
// ══════════════════════════════════════════════════════

// POST /api/contracts/:id/confirm
// → FULLY_SIGNED → COMPLETED
// → Trigger: contract_confirmations-д хадгалагдана
router.post('/:id/confirm',         c.confirmContract)

// ══════════════════════════════════════════════════════
// ЦУЦЛАХ
// ══════════════════════════════════════════════════════

// POST /api/contracts/:id/cancel
// Body: { reason? }
// → Аль ч талын оролцогч (CREATOR эсвэл COUNTERPARTY) дуудаж болно.
// → Хоёр тал гарын үсэг зурсан (FULLY_SIGNED) ЭСВЭЛ terminal статуст бол блокно.
// → DRAFT/SENT статусаас CANCELLED руу шилждэг.
router.post('/:id/cancel',          c.cancelContract)

// ══════════════════════════════════════════════════════
// ХААХ + ҮНЭЛГЭЭ
// ══════════════════════════════════════════════════════

// POST /api/contracts/:id/close
// Body: { reason? }
// → Creator only · status COMPLETED → CLOSED
router.post('/:id/close',           c.closeContract)

// POST /api/contracts/:id/ratings
// Body: { rated_user_id, rating, comment? }
// → UPSERT (дахин засаж болно)
router.post('/:id/ratings',         rating.submitRating)

// GET /api/contracts/:id/ratings
// → Энэ гэрээний бүх үнэлгээ
router.get('/:id/ratings',          rating.getContractRatings)

// ══════════════════════════════════════════════════════
// ХАВСРАЛТ — Cloudinary дээр upload
// ══════════════════════════════════════════════════════

// POST /api/contracts/:id/attachments  (multipart/form-data, field: "file")
// Гарын үсэг зурагдаагүй үед оролцогч хэн ч upload хийж болно
router.post(
  '/:id/attachments',
  attachmentUpload.single('file'),
  handleUploadError,
  att.uploadAttachment
)

// DELETE /api/contracts/:id/attachments/:attachmentId
// Зөвхөн uploaded_by өөрөө
router.delete('/:id/attachments/:attachmentId', att.deleteAttachment)

module.exports = router