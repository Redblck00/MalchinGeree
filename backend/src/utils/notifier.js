const { query } = require('../config/db')

// Хэрэглэгч рүү IN_APP мэдэгдэл оруулах
const notify = async ({ user_id, contract_id = null, title, message }) => {
  if (!user_id) return
  try {
    await query(
      `INSERT INTO notifications
         (user_id, contract_id, channel, title, message,
          delivery_status, delivered_at)
       VALUES ($1, $2, 'IN_APP', $3, $4, 'DELIVERED', NOW())`,
      [user_id, contract_id, title, message]
    )
  } catch (err) {
    console.error('Notify failed:', err.message)
  }
}

// Хэд хэдэн хэрэглэгчид зэрэг мэдэгдэл явуулах
const notifyMany = async ({ user_ids, contract_id = null, title, message }) => {
  for (const uid of user_ids || []) {
    if (uid) await notify({ user_id: uid, contract_id, title, message })
  }
}

// Гэрээний бүх оролцогчдод (CREATOR, COUNTERPARTY, WITNESS гэх мэт) мэдэгдэх
// exceptUserId өгвөл түүнийг алгасна (жишээ: action хийсэн хүн өөрөө)
const notifyParticipants = async (contractId, { title, message, exceptUserId = null }) => {
  const params = exceptUserId ? [contractId, exceptUserId] : [contractId]
  const filter = exceptUserId ? 'AND user_id <> $2' : ''
  const partRes = await query(
    `SELECT user_id FROM contract_participants
     WHERE contract_id = $1 AND user_id IS NOT NULL ${filter}`,
    params
  )
  const ids = partRes.rows.map(r => r.user_id)
  await notifyMany({ user_ids: ids, contract_id: contractId, title, message })
}

module.exports = { notify, notifyMany, notifyParticipants }
