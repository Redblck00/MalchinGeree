'use client'
import { useState, useEffect } from 'react'
import useAuthStore from '@/app/store/authStore'
import SignatureModal from '@/components/signature/SignatureModal'
import api from '@/lib/api'

// ── Хоосон үед харагдах SVG ────────────────────────────
function EmptySignatureIllustration() {
  return (
    <svg viewBox="0 0 220 140" fill="none" className="w-44 h-32 opacity-40">
      <path
        d="M20 95 C40 50, 60 105, 80 75 C95 53, 115 95, 135 65 C150 45, 170 80, 195 60"
        stroke="#9ca3af"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <line x1="20" y1="115" x2="200" y2="115" stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="4 4" />
    </svg>
  )
}

// ── Гарын үсгийн frame ─────────────────────────────────
// Зурагт жишээний дагуу — "E-Geree баталгаажуулсан:" гарчигтай хүрээ
function SignatureFrame({ src }) {
  return (
    <div className="w-full max-w-md">
      <div className="border-[3px] border-[#1e1b4b] rounded-2xl bg-white px-6 py-5 shadow-sm">
        <p className="text-sm font-medium text-[#1e1b4b] mb-2 m-0">
          E-Geree баталгаажуулсан:
        </p>
        <div className="flex items-center justify-center min-h-32">
          {src ? (
            <img
              src={src}
              alt="signature"
              className="max-w-full max-h-40 object-contain"
            />
          ) : (
            <EmptySignatureIllustration />
          )}
        </div>
      </div>
    </div>
  )
}

export default function SignaturePage() {
  const { user, restoreAuth } = useAuthStore()

  const [modalOpen,    setModalOpen]    = useState(false)
  const [signatureImg, setSignatureImg] = useState(null)
  const [signatureId,  setSignatureId]  = useState(null)
  const [saving,       setSaving]       = useState(false)
  const [message,      setMessage]      = useState(null)

  useEffect(() => { restoreAuth() }, [restoreAuth])

  // Backend-с гарын үсэг авах — GET /api/users/signatures
  useEffect(() => {
    const fetchSignature = async () => {
      try {
        const res = await api.get('/users/signatures')
        const list = res.data.data || res.data || []
        if (list.length > 0) {
          const def = list.find(s => s.is_default) || list[0]
          setSignatureImg(def.signature_blob)
          setSignatureId(def.user_signature_id)
        }
      } catch (_) {}
    }
    fetchSignature()
  }, [])

  const fullName = user
    ? `${user.last_name ?? ''} ${user.first_name ?? ''}`.trim()
    : '—'

  // SignatureModal "Хадгалах" → POST /api/users/signatures
  const handleSave = async (blob, signature_type) => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await api.post('/users/signatures', {
        signature_type,
        signature_blob: blob,
        is_default: true,
      })
      setSignatureImg(blob)
      setSignatureId(res.data.data?.user_signature_id || res.data?.user_signature_id)
      setModalOpen(false)
      setMessage({ type: 'success', text: 'Гарын үсэг амжилттай хадгалагдлаа' })
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Хадгалахад алдаа гарлаа',
      })
    } finally {
      setSaving(false)
    }
  }

  // DELETE /api/users/signatures/:id
  const handleDelete = async () => {
    if (!signatureId) return
    if (!confirm('Гарын үсгийг устгах уу?')) return
    try {
      await api.delete(`/users/signatures/${signatureId}`)
      setSignatureImg(null)
      setSignatureId(null)
      setMessage({ type: 'success', text: 'Гарын үсэг устгагдлаа' })
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Устгахад алдаа гарлаа',
      })
    }
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Гарын үсэг</h1>

      {/* Banner */}
      <div
        className="w-full h-44 rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #4fc3f7 0%, #0288d1 40%, #01579b 100%)' }}
      />

      {/* Profile strip */}
      <div className="bg-white rounded-2xl shadow-sm px-8 py-5 mt-4 flex items-center gap-5">
        <div className="relative -mt-12 shrink-0">
          <div className="w-20 h-20 rounded-full border-4 border-white shadow bg-gray-200 overflow-hidden flex items-center justify-center">
            {user?.profile_image_url ? (
              <img src={user.profile_image_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
              </svg>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-400 m-0">Та өөрийн профайл зургийг оруулна уу</p>
          <h2 className="text-lg font-bold text-gray-900 m-0">{fullName}</h2>
          <p className="text-sm text-gray-400 m-0">{user?.email ?? '—'}</p>
        </div>
      </div>

      {/* Мэдэгдэл */}
      {message && (
        <div className={`mt-4 px-4 py-3 rounded-xl text-sm font-medium ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-600 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Гарын үсгийн хэсэг */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Хэрэглэгчийн гарын үсэг
        </h2>

        <div className="flex flex-col md:flex-row items-start gap-10">
          {/* Frame preview */}
          <SignatureFrame src={signatureImg} />

          {/* Товчлуурууд */}
          <div className="flex flex-col gap-3 pt-2">
            <p className="text-sm font-medium text-gray-700 m-0">
              {signatureImg ? 'Хадгалсан гарын үсэг' : 'Гарын үсэг үүсгэх'}
            </p>
            <button
              onClick={() => { setMessage(null); setModalOpen(true) }}
              className="px-7 py-3 bg-[#1e1b4b] text-white text-sm font-semibold
                         rounded-xl hover:bg-[#2d2a6e] transition-colors w-fit
                         cursor-pointer border-0"
            >
              {signatureImg ? 'Гарын үсэг солих' : 'Гарын үсэг оруулах'}
            </button>
            <p className="text-xs text-gray-400 max-w-xs m-0">
              Та өөрөө зурах эсвэл нэрээрээ автоматаар үүсгэж болно
            </p>
            {signatureImg && (
              <button
                onClick={handleDelete}
                className="text-xs text-red-400 hover:text-red-600 transition-colors w-fit
                           cursor-pointer bg-transparent border-0 p-0 mt-1"
              >
                Устгах
              </button>
            )}
          </div>
        </div>

        <hr className="mt-10 border-gray-200" />
      </div>

      {/* Modal — зурах эсвэл автомат үүсгэх */}
      {modalOpen && (
        <SignatureModal
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          userName={fullName}
          loading={saving}
        />
      )}
    </div>
  )
}
