'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import useAuthStore from '@/app/store/authStore'
import api from '@/lib/api'
import SignatureModal from '@/components/signature/SignatureModal'
import ProfileSidebar from '@/components/profile/ProfileSidebar'
import { Star, ArrowLeft } from 'lucide-react'
import NotificationDropdown from '@/components/layout/NotificationDropdown'
import { FiEdit3, FiTrash2 } from 'react-icons/fi'
const MN_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatToday() {
  const d = new Date()
  return `${d.getFullYear()} ${MN_MONTHS[d.getMonth()]} ${d.getDate()}`
}

function StarRating({ rating = 0, size = 16 }) {
  const rounded = Math.round(rating)
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) =>
        i < rounded
          ? <Star key={i} size={size} className="text-amber-400 fill-amber-400" />
          : <Star key={i} size={size} className="text-gray-300" />
      )}
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, restoreAuth } = useAuthStore()

  const [profile,      setProfile]      = useState(null)
  const [ratings,      setRatings]      = useState({ summary: { rating_avg: 0, rating_count: 0 }, recent: [] })
  const [signatureImg, setSignatureImg] = useState(null)
  const [signatureId,  setSignatureId]  = useState(null)
  const [modalOpen,    setModalOpen]    = useState(false)
  const [savingSig,    setSavingSig]    = useState(false)
  const [sigMessage,   setSigMessage]   = useState(null)

  useEffect(() => { restoreAuth() }, [restoreAuth])

  // Load profile + ratings + signature in parallel
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [pRes, rRes, sRes] = await Promise.all([
          api.get('/users/profile'),
          api.get('/users/ratings').catch(() => ({ data: { data: { summary: {}, recent: [] } } })),
          api.get('/users/signatures').catch(() => ({ data: { data: [] } })),
        ])
        if (!alive) return
        setProfile(pRes.data.data || pRes.data)
        setRatings(rRes.data.data || rRes.data || { summary: {}, recent: [] })
        const list = sRes.data.data || sRes.data || []
        if (list.length > 0) {
          const def = list.find(s => s.is_default) || list[0]
          setSignatureImg(def.signature_blob)
          setSignatureId(def.user_signature_id)
        }
      } catch (_) { /* swallow — sidebar shows errors */ }
    })()
    return () => { alive = false }
  }, [])

  const fullName = user
    ? `${user.last_name ?? ''} ${user.first_name ?? ''}`.trim()
    : ''

  // ── Гарын үсэг CRUD ─────────────────────────────────
  const handleSaveSignature = async (blob, signature_type) => {
    setSavingSig(true); setSigMessage(null)
    try {
      const res = await api.post('/users/signatures', {
        signature_type,
        signature_blob: blob,
        is_default: true,
      })
      setSignatureImg(blob)
      setSignatureId(res.data.data?.user_signature_id || res.data?.user_signature_id)
      setModalOpen(false)
      setSigMessage({ type: 'success', text: 'Гарын үсэг хадгалагдлаа' })
      setTimeout(() => setSigMessage(null), 2500)
    } catch (err) {
      setSigMessage({
        type: 'error',
        text: err.response?.data?.message || 'Хадгалахад алдаа гарлаа',
      })
    } finally {
      setSavingSig(false)
    }
  }

  const handleDeleteSignature = async () => {
    if (!signatureId) return
    if (!confirm('Гарын үсгийг устгах уу?')) return
    try {
      await api.delete(`/users/signatures/${signatureId}`)
      setSignatureImg(null)
      setSignatureId(null)
      setSigMessage({ type: 'success', text: 'Гарын үсэг устгагдлаа' })
      setTimeout(() => setSigMessage(null), 2500)
    } catch (err) {
      setSigMessage({
        type: 'error',
        text: err.response?.data?.message || 'Устгахад алдаа гарлаа',
      })
    }
  }

  return (
    // Mobile: natural scroll. Desktop (lg+): h-screen overflow-hidden
    <div className="flex flex-col min-h-screen lg:h-screen lg:overflow-hidden bg-white">

      {/* ── TOP BAR ────────────────────────────────────
          Зүүн: нүүр хуудас руу буцах icon
          Баруун: огноо + notification bell
          pl-16 lg:pl-8 — mobile-д hamburger button-ийн орон зайг үлдээнэ */}
      <header className="shrink-0 flex items-center justify-between px-4 sm:px-6 lg:px-8 pl-16 lg:pl-8 py-4">
        <button
          onClick={() => router.push('/dashboard')}
          aria-label="Нүүр хуудас руу буцах"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600
                     hover:text-[#006B35] cursor-pointer bg-transparent border-0 p-0
                     transition-colors"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-600 font-medium m-0">
            {formatToday()}
          </p>
          <NotificationDropdown iconClassName="text-[#006B35]" />
        </div>
      </header>

      {/* ── WELCOME BANNER ─────────────────────────────
          Teal gradient (#5eead4 → цагаан) + illusrationBro.png       */}
      <section className="shrink-0 px-4 sm:px-6 lg:px-8 mb-4 lg:mb-6">
        <div
          className="rounded-3xl px-5 sm:px-8 lg:px-10 py-5 lg:py-7
                     flex items-center justify-between gap-4 overflow-hidden relative"
          style={{
            background: 'linear-gradient(to right, rgba(94, 234, 212, 0.35), rgba(255, 255, 255, 1))',
          }}
        >
          <div className="max-w-md relative z-10">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-[#0f766e] m-0 leading-tight">
              Сайн байна уу{fullName && <span>, {fullName.split(' ')[0]}</span>}
            </h2>
            <p className="text-xs sm:text-sm text-teal-800/80 mt-2 sm:mt-3 m-0 leading-relaxed">
              Та өөрийн мэдээллээ бүрэн бөглөснөөр гэрээ байгуулах
              боломжтой болно
            </p>
          </div>
          {/* Жижиг mobile (< sm) дээр illustration нуугдана */}
          <div className="hidden sm:block shrink-0 relative">
            <Image
              src="/illusrationBro.png"
              alt="profile illustration"
              width={260}
              height={260}
              style={{ width: 'auto', height: 'auto' }}
              className="object-contain w-32 sm:w-44 lg:w-60"
              priority
            />
          </div>
        </div>
      </section>

      {/* ── 2-COL LAYOUT ──────────────────────────────
          Mobile: stacked (1-col, natural height + page scroll)
          Desktop (lg+): 2-col fixed-height with internal scroll                */}
      <div className="lg:flex-1 lg:min-h-0 px-4 sm:px-6 lg:px-8 pb-6 grid grid-cols-1
                      lg:grid-cols-[1fr_1.5fr] gap-4 lg:gap-6 lg:overflow-hidden">

        {/* ── ЗҮҮН: Profile card (mobile: natural, lg: scrollable) ── */}
        <div className="lg:min-h-0 lg:overflow-y-auto no-scrollbar">
          <ProfileSidebar
            bare
            profile={profile}
            ratings={ratings}
            onProfileUpdated={setProfile}
          />
        </div>

        {/* ── БАРУУН: Signature + Rating (mobile: stacked natural, lg: 50/50 fixed) ── */}
        <div className="flex flex-col gap-4 lg:min-h-0 lg:overflow-hidden">

          {/* ══════════════════════════════════════════════
              Signature card — mobile: natural height, lg+: flex-1 50%
              ══════════════════════════════════════════════ */}
          <div className="lg:flex-1 lg:min-h-0">
          <div className="lg:h-full bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">

            {/* Header */}
            <div className="shrink-0 flex items-start justify-between gap-4 px-5 py-3 border-b border-gray-100">
              <div className="flex items-start gap-3 min-w-0">
                <div className="shrink-0 w-9 h-9 rounded-xl bg-emerald-50
                                flex items-center justify-center">
                  <FiEdit3 size={16} className="text-[#006B35]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-gray-900 m-0">
                    Хэрэглэгчийн гарын үсэг
                  </h3>
                  <p className="text-xs text-gray-500 m-0 mt-0.5">
                    Гэрээнд ашиглах цахим гарын үсгээ зурна уу
                  </p>
                </div>
              </div>

              {/* Status badge */}
              <span className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1
                                rounded-full text-xs font-medium
                                ${signatureImg
                                  ? 'bg-emerald-50 text-[#006B35] border border-emerald-200'
                                  : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  signatureImg ? 'bg-emerald-500' : 'bg-gray-400'
                }`} />
                {signatureImg ? 'Хадгалсан' : 'Үүсгээгүй'}
              </span>
            </div>

            {/* Status message */}
            {sigMessage && (
              <div className={`mx-6 mt-4 px-4 py-2.5 rounded-xl text-sm font-medium ${
                sigMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-600 border border-red-200'
              }`}>
                {sigMessage.text}
              </div>
            )}

            {/* Body — clickable dashed canvas
                Mobile: fixed h-52 (canvas) — natural card height
                Desktop: flex-1 dynamic — canvas wrapper-ийн дагуу өсдөг */}
            <div className="lg:flex-1 lg:min-h-0 p-4 flex flex-col">
              <button
                type="button"
                onClick={() => { setSigMessage(null); setModalOpen(true) }}
                aria-label={signatureImg ? 'Гарын үсэг солих' : 'Гарын үсэг үүсгэх'}
                className="group w-full h-44 sm:h-52 lg:h-auto lg:flex-1 lg:min-h-0
                           rounded-2xl border-2 border-dashed border-gray-200
                           hover:border-[#006B35]/40 hover:bg-emerald-50/30
                           bg-gray-50/40 transition-colors cursor-pointer
                           flex items-center justify-center relative overflow-hidden p-4"
              >
                {signatureImg ? (
                  <img
                    src={signatureImg}
                    alt="signature"
                    className="max-w-[70%] max-h-[80%] object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-400
                                  group-hover:text-[#006B35] transition-colors">
                    <FiEdit3 size={28} />
                    <p className="text-sm m-0">Энд гарын үсгээ зурна уу</p>
                    <div className="w-40 h-px bg-gray-300 mt-3" />
                  </div>
                )}
              </button>

              {/* Footer — тайлбар + action товчнууд (shrink-0: canvas хэмжээтэй өрсөлдөхгүй) */}
              <div className="shrink-0 flex items-center justify-between gap-3 mt-3 flex-wrap">
                <p className="text-xs text-gray-500 m-0 max-w-md leading-relaxed">
                  {signatureImg
                    ? 'Энэ гарын үсэг таны үүсгэх гэрээнд автоматаар ашиглагдана.'
                    : 'Нэг удаа хадгалсан гарын үсгээ дараа гэрээ зурахдаа дахин ашиглана.'}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  {signatureImg && (
                    <button
                      onClick={handleDeleteSignature}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium
                                 text-red-600 hover:bg-red-50 rounded-lg
                                 cursor-pointer border-0 bg-transparent transition-colors"
                    >
                      <FiTrash2 size={13} />
                      Устгах
                    </button>
                  )}
                  <button
                    onClick={() => { setSigMessage(null); setModalOpen(true) }}
                    className="inline-flex items-center gap-1.5 px-5 py-2
                               bg-[#006B35] hover:bg-[#00582c] text-white
                               text-sm font-semibold rounded-xl
                               cursor-pointer border-0 transition-colors shadow-sm"
                  >
                    <FiEdit3 size={14} />
                    {signatureImg ? 'Солих' : 'Үүсгэх'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
          {/* End signature card wrapper */}

          {/* ══════════════════════════════════════════════
              Rating card
              Mobile: natural height (page scroll)
              Desktop: lg:flex-1 lg:overflow-hidden + internal scroll
              ══════════════════════════════════════════════ */}
          <div className="lg:flex-1 lg:min-h-0 bg-white border border-gray-200 rounded-2xl
                          shadow-sm flex flex-col lg:overflow-hidden">
            <div className="shrink-0 flex items-center justify-between gap-2 px-4 sm:px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm sm:text-base font-bold text-[#006B35] m-0">
                Хүлээн авсан үнэлгээ
              </h3>
              <div className="flex items-center gap-2">
                <StarRating rating={ratings.summary?.rating_avg || 0} size={16} />
                <span className="text-sm sm:text-base font-semibold text-gray-800">
                  {(ratings.summary?.rating_avg || 0).toFixed(1)}
                </span>
                <span className="text-xs sm:text-sm text-gray-400">
                  ({ratings.summary?.rating_count || 0})
                </span>
              </div>
            </div>

            <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto no-scrollbar p-4 sm:p-6">
              {(!ratings.recent || ratings.recent.length === 0) ? (
                <div className="text-center py-12 text-sm text-gray-400
                                border border-dashed border-gray-200 rounded-2xl">
                  Одоохондоо үнэлгээ ирээгүй байна
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {ratings.recent.map(r => (
                    <div key={r.rating_id}
                         className="border border-gray-100 rounded-2xl p-4 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-full bg-[#006B35] text-white
                                          flex items-center justify-center text-xs font-bold uppercase">
                            {((r.rater_last_name?.[0] || '') + (r.rater_first_name?.[0] || '')) || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 m-0">
                              {`${r.rater_last_name || ''} ${r.rater_first_name || ''}`.trim() || 'Хэрэглэгч'}
                            </p>
                            <p className="text-[11px] text-gray-400 m-0">
                              {r.contract_number && <span>{r.contract_number} · </span>}
                              {new Date(r.created_at).toLocaleDateString('mn-MN')}
                            </p>
                          </div>
                        </div>
                        <StarRating rating={r.rating} />
                      </div>
                      {r.comment && (
                        <p className="text-sm text-gray-600 m-0 mt-1 pl-11">
                          {r.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* End rating card */}

        </div>
        {/* End right column */}
      </div>
      {/* End 2-col grid */}

      {/* Signature modal */}
      {modalOpen && (
        <SignatureModal
          onClose={() => setModalOpen(false)}
          onSave={handleSaveSignature}
          userName={fullName}
          loading={savingSig}
        />
      )}
    </div>
  )
}
