'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import useAuthStore from '@/app/store/authStore'
import api from '@/lib/api'
import SignatureModal from '@/components/signature/SignatureModal'
import ProfileSidebar from '@/components/profile/ProfileSidebar'
import { Star } from 'lucide-react'
import NotificationDropdown from '@/components/layout/NotificationDropdown'
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

function EmptySignatureIllustration() {
  return (
    <Image
      src="/signatureEmptyImg.png"
      alt="empty signature"
      width={240}
      height={180}
      style={{ width: 'auto', height: 'auto' }}
      className="opacity-80 object-contain"
    />
  )
}

export default function ProfilePage() {
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
    <div className="flex h-screen overflow-hidden">
      {/* ── MAIN CONTENT ───────────────────────────── */}
      <main className="flex-1 min-w-0 bg-white overflow-y-auto no-scrollbar px-8 py-6">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500 m-0">
            dashboard &gt; Profiles
          </p>
          <p className="text-sm text-gray-700 font-medium m-0">
            {formatToday()}
          </p>
          <NotificationDropdown iconClassName="text-[#006B35]" />
        </div>

        {/* Welcome banner */}
        <div
          className="rounded-3xl px-10 py-8 flex items-center justify-between gap-6
                     overflow-hidden"
          style={{
            background: 'linear-gradient(to right, #EEFBEF, #E7FFF1)',
            minHeight: 220,
          }}
        >
          <div className="max-w-md">
            <h2 className="text-4xl font-semibold text-[#1a3a26] m-0 leading-tight">
              Сайн байна уу {fullName && <span>, {fullName.split(' ')[0]}</span>}
            </h2>
            <p className="text-sm text-[#3a5a44] mt-3 m-0 leading-relaxed">
              Та өөрийн мэдээллээ бүрэн бөглөснөөр гэрээ байгуулах
              боломжтой болно
            </p>
          </div>
          <div className="shrink-0">
            <Image
              src="/SheepWelcomeCard.png"
              alt="sheep welcome"
              width={220}
              height={200}
              style={{ width: 'auto', height: 'auto' }}
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Signature heading */}
        <h2 className="text-3xl font-semibold text-[#006B35] mt-10 mb-6">
          Хэрэглэгчийн гарын үсэг
        </h2>

        {/* Status message */}
        {sigMessage && (
          <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium inline-block ${
            sigMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-600 border border-red-200'
          }`}>
            {sigMessage.text}
          </div>
        )}

        {/* Signature section */}
        <div className="flex flex-col md:flex-row items-start gap-10">
          {/* Preview frame */}
          <div className="w-full max-w-105 h-75 border border-gray-200 rounded-3xl
                          bg-white flex flex-col items-center justify-center gap-2 shrink-0">
            {signatureImg ? (
              <img
                src={signatureImg}
                alt="signature"
                className="max-w-[80%] max-h-[70%] object-contain"
              />
            ) : (
              <>
                <EmptySignatureIllustration />
                <p className="text-xs text-gray-400 m-0">Гарын үсэг байхгүй байна</p>
              </>
            )}
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3 pt-4">
            <p className="text-sm font-medium text-[#1a4d33] m-0">
              {signatureImg ? 'Хадгалсан гарын үсэг' : 'Хэрэглэгчийн гарын үсэг'}
            </p>
            <button
              onClick={() => { setSigMessage(null); setModalOpen(true) }}
              className="w-47.5 h-12.5 bg-[#006B35] text-white text-sm font-medium
                         rounded-2xl hover:bg-[#00582c] transition-colors cursor-pointer
                         border-0 shadow-sm"
            >
              {signatureImg ? 'солих' : 'үүсгэх'}
            </button>
            <p className="text-xs text-gray-400 max-w-xs m-0">
              өөрийн гарын үсгийг оруулна уу
            </p>
            {signatureImg && (
              <button
                onClick={handleDeleteSignature}
                className="text-xs text-red-400 hover:text-red-600 transition-colors w-fit
                           cursor-pointer bg-transparent border-0 p-0 mt-1"
              >
                Устгах
              </button>
            )}
          </div>
        </div>

        {/* Ratings */}
        <div className="mt-14 pb-10">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-2xl font-semibold text-[#006B35] m-0">
              Хүлээн авсан үнэлгээ
            </h3>
            <div className="flex items-center gap-2">
              <StarRating rating={ratings.summary?.rating_avg || 0} size={18} />
              <span className="text-base font-semibold text-gray-800">
                {(ratings.summary?.rating_avg || 0).toFixed(1)}
              </span>
              <span className="text-sm text-gray-400">
                ({ratings.summary?.rating_count || 0})
              </span>
            </div>
          </div>

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
      </main>

      {/* ── RIGHT PROFILE SIDEBAR ─────────────────── */}
      <ProfileSidebar
        profile={profile}
        ratings={ratings}
        onProfileUpdated={setProfile}
      />

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
