'use client'
import { useState, useEffect } from 'react'
import { MdStar, MdStarBorder, MdClose } from 'react-icons/md'

// ══════════════════════════════════════════════════════
// RatingModal — гэрээний нөгөө талыг үнэлэх
// Props:
//   open               (bool)
//   onClose            ()
//   onSubmit           ({ rating, comment }) => Promise
//   ratedUser          { user_id, first_name, last_name } (заавал)
//   existingRating?    { rating, comment }   (засах үед pre-fill)
//   submitting         (bool)
// ══════════════════════════════════════════════════════
export default function RatingModal({
  open, onClose, onSubmit,
  ratedUser, existingRating, submitting,
}) {
  const [rating,  setRating]  = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [error,   setError]   = useState(null)

  // Modal нээгдэх бүрд existing-ийг pre-fill
  useEffect(() => {
    if (open) {
      setRating(existingRating?.rating || 0)
      setComment(existingRating?.comment || '')
      setError(null)
    }
  }, [open, existingRating])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (rating < 1 || rating > 5) {
      setError('1-5 одны үнэлгээ өгнө үү')
      return
    }
    try {
      await onSubmit({ rating, comment: comment.trim() || null })
    } catch (err) {
      setError(err?.response?.data?.message || 'Алдаа гарлаа')
    }
  }

  const ratedName = ratedUser
    ? `${ratedUser.last_name || ''} ${ratedUser.first_name || ''}`.trim() || 'Нөгөө тал'
    : 'Нөгөө тал'

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white shadow-2xl w-full max-w-md flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 m-0">
              {existingRating ? 'Үнэлгээгээ засах' : 'Хэрэглэгчийг үнэлэх'}
            </h2>
            <p className="text-sm text-gray-500 m-0 mt-1">
              <span className="font-medium text-gray-700">{ratedName}</span>-ийг үнэлж байна
            </p>
          </div>
          <button
            type="button" onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none
                       cursor-pointer bg-transparent border-0"
            aria-label="Хаах"
          >
            <MdClose size={22} />
          </button>
        </div>

        {/* Star selector */}
        <div className="px-6 py-6 flex flex-col items-center gap-3">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(n => {
              const filled = n <= (hovered || rating)
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHovered(n)}
                  onMouseLeave={() => setHovered(0)}
                  className="text-yellow-400 hover:scale-110 transition-transform
                             cursor-pointer bg-transparent border-0 p-0"
                  aria-label={`${n} од`}
                >
                  {filled
                    ? <MdStar size={42} />
                    : <MdStarBorder size={42} className="text-gray-300" />}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-500 m-0">
            {rating === 0 && 'Үнэлгээ сонгоно уу'}
            {rating === 1 && '1 од — Маш муу'}
            {rating === 2 && '2 од — Муу'}
            {rating === 3 && '3 од — Дунд'}
            {rating === 4 && '4 од — Сайн'}
            {rating === 5 && '5 од — Маш сайн'}
          </p>
        </div>

        {/* Comment */}
        <div className="px-6 pb-4">
          <label className="text-xs font-medium text-gray-700 mb-1.5 block">
            Сэтгэгдэл <span className="text-gray-400 font-normal">(заавал биш)</span>
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            placeholder="Хамтын ажиллагааны талаархи сэтгэгдлээ үлдээж болно..."
            maxLength={500}
            className="w-full px-3 py-2.5 border border-gray-200 text-sm
                       outline-none focus:border-[#3d3a8c] bg-white resize-none"
          />
          <p className="text-[11px] text-gray-400 text-right mt-1 m-0">
            {comment.length}/500
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-3 px-3 py-2 bg-red-50 border border-red-200
                          text-xs text-red-600">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 text-sm text-gray-600 border border-gray-200
                       hover:bg-gray-50 cursor-pointer bg-white
                       disabled:opacity-50"
          >
            Цуцлах
          </button>
          <button
            type="submit"
            disabled={submitting || rating < 1}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-[#3d3a8c]
                       hover:bg-[#2d2a6e] cursor-pointer border-0
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Илгээж байна...' : (existingRating ? 'Засах' : 'Илгээх')}
          </button>
        </div>
      </form>
    </div>
  )
}
