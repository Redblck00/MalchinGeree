// ══════════════════════════════════════════════════════
// contractRating.controller.js
// Гэрээний үнэлгээ (rating). contract.controller.js-аас салгасан —
// бизнес логик өөрчлөгдөөгүй.
// ══════════════════════════════════════════════════════

const repo                 = require('../repositories/contract.repository')
const { log }              = require('../utils/logger')
const { notify }           = require('../utils/notifier')
const { safeErrorMessage } = require('../utils/errors')

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
    const chk = await repo.findRatingEligibility(id, req.user.user_id, rated_user_id)
    if (!chk) return res.status(404).json({ message: 'Гэрээ олдсонгүй' })
    if (chk.status !== 'CLOSED') {
      return res.status(400).json({ message: 'Зөвхөн хаагдсан гэрээнд үнэлгээ өгөх боломжтой' })
    }
    if (!chk.rater_in)  return res.status(403).json({ message: 'Энэ гэрээний оролцогч биш' })
    if (!chk.rated_in)  return res.status(400).json({ message: 'Үнэлэгдэх хүн энэ гэрээнд оролцоогүй' })

    // UPSERT — дахин засаж болно
    const ratingRow = await repo.upsertRating({
      contractId:  id,
      raterId:     req.user.user_id,
      ratedUserId: rated_user_id,
      rating:      star,
      comment:     comment || null,
    })

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

    res.json({ message: 'Үнэлгээ хадгалагдлаа', data: ratingRow })
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
    if (!(await repo.isParticipant(id, req.user.user_id))) {
      return res.status(403).json({ message: 'Харах эрх байхгүй' })
    }

    const rows = await repo.findContractRatings(id)
    res.json({ data: rows })
  } catch (err) {
    res.status(400).json({ message: safeErrorMessage(err) })
  }
}

module.exports = {
  submitRating,
  getContractRatings,
}
