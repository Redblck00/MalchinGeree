const { query } = require('../config/db')

// ── Системийн лог бичих ───────────────────────────────
const log = async ({ user_id, action, entity_type, entity_id, details, req }) => {
  try {
    await query(
      `INSERT INTO system_logs
         (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        user_id     || null,
        action,
        entity_type || null,
        entity_id   || null,
        details     ? JSON.stringify(details) : null,
        req?.ip     || null,
        req?.headers?.['user-agent'] || null,
      ]
    )
  } catch (_) {
    // Лог бичихэд алдаа гарсан ч үндсэн үйлдэл зогсохгүй
  }
}

// ── Лог үйлдлийн нэрс ────────────────────────────────
const LOG = {
  // Auth
  REGISTER:         'USER_REGISTER',
  LOGIN:            'USER_LOGIN',
  OTP_VERIFY:       'OTP_VERIFY',

  // Template
  TEMPLATE_CREATE:  'TEMPLATE_CREATE',
  TEMPLATE_UPDATE:  'TEMPLATE_UPDATE',
  TEMPLATE_DELETE:  'TEMPLATE_DELETE',

  // Contract
  CONTRACT_CREATE:  'CONTRACT_CREATE',
  CONTRACT_UPDATE:  'CONTRACT_UPDATE',
  CONTRACT_SEND:    'CONTRACT_SEND',
  CONTRACT_SIGN:    'CONTRACT_SIGN',
  CONTRACT_CONFIRM: 'CONTRACT_CONFIRM',
  CONTRACT_CANCEL:  'CONTRACT_CANCEL',

  // User
  PROFILE_UPDATE:   'PROFILE_UPDATE',
  SIGNATURE_SAVE:   'SIGNATURE_SAVE',
}

module.exports = { log, LOG }