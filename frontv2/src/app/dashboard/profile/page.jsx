'use client'
import { useEffect, useRef, useState } from 'react'
import useAuthStore from '@/app/store/authStore'
import api from '@/lib/api'
import { MdEdit, MdCheck, MdClose, MdCameraAlt, MdStar, MdStarBorder } from 'react-icons/md'

const USER_TYPE_LABELS = {
  USER:    'Хэрэглэгч',
  ADMIN:   'Админ',
  SUPPORT: 'Дэмжлэг',
  malchin: 'Малчин',
  buyer:   'Худалдан авагч',
  admin:   'Админ',
}

// ── Star rating display ────────────────────────────────
function StarRating({ rating = 0, size = 16 }) {
  const rounded = Math.round(rating)
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) =>
        i < rounded
          ? <MdStar key={i} size={size} className="text-amber-400" />
          : <MdStarBorder key={i} size={size} className="text-gray-300" />
      )}
    </div>
  )
}

// ── Field (read mode) ──────────────────────────────────
function ReadField({ label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-gray-500">{label}</label>
      <div className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50
                      text-sm text-gray-700 min-h-10.5">
        {value || '—'}
      </div>
    </div>
  )
}

// ── Field (edit mode) ──────────────────────────────────
function EditField({ label, name, value, onChange, type = 'text', placeholder }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-gray-500">{label}</label>
      <input
        type={type}
        name={name}
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white
                   text-sm text-gray-800 outline-none focus:border-[#3d3a8c]
                   placeholder:text-gray-400"
      />
    </div>
  )
}

// ── Read-only display field (системийн утга) ──────────
function StaticField({ label, value, hint }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-gray-500">
        {label} {hint && <span className="text-gray-400 text-xs">· {hint}</span>}
      </label>
      <div className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50
                      text-sm text-gray-500 min-h-10.5">
        {value || '—'}
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { user: storeUser, restoreAuth, setUser } = useAuthStore()

  const [profile,    setProfile]    = useState(null)
  const [ratings,    setRatings]    = useState({ summary: { rating_avg: 0, rating_count: 0 }, recent: [] })
  const [editing,    setEditing]    = useState(false)
  const [form,       setForm]       = useState({ first_name: '', last_name: '', phone: '', address: '' })
  const [saving,     setSaving]     = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [error,      setError]      = useState(null)
  const [success,    setSuccess]    = useState(null)

  const fileInputRef = useRef(null)

  useEffect(() => { restoreAuth() }, [restoreAuth])

  // ── Татах: profile + ratings ───────────────────────
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [pRes, rRes] = await Promise.all([
          api.get('/users/profile'),
          api.get('/users/ratings').catch(() => ({ data: { data: { summary: {}, recent: [] } } })),
        ])
        if (!alive) return
        const p = pRes.data.data || pRes.data
        setProfile(p)
        setForm({
          first_name: p.first_name || '',
          last_name:  p.last_name  || '',
          phone:      p.phone      || '',
          address:    p.address    || '',
        })
        setRatings(rRes.data.data || rRes.data || { summary: {}, recent: [] })
      } catch (err) {
        if (alive) setError(err.response?.data?.message || 'Профайл татаж чадсангүй')
      }
    })()
    return () => { alive = false }
  }, [])

  // ── Form handlers ──────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  const startEdit = () => {
    setEditing(true)
    setError(null)
    setSuccess(null)
  }

  const cancelEdit = () => {
    setEditing(false)
    setError(null)
    if (profile) {
      setForm({
        first_name: profile.first_name || '',
        last_name:  profile.last_name  || '',
        phone:      profile.phone      || '',
        address:    profile.address    || '',
      })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await api.patch('/users/profile', form)
      const updated = res.data.data || res.data
      setProfile(updated)
      setUser?.(updated)
      setEditing(false)
      setSuccess('Профайл шинэчлэгдлээ')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.response?.data?.message || 'Хадгалахад алдаа гарлаа')
    } finally {
      setSaving(false)
    }
  }

  // ── Avatar upload ──────────────────────────────────
  const triggerFilePicker = () => {
    if (uploading) return
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Зөвхөн зураг сонгоно уу')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Зураг 5MB-аас бага байх ёстой')
      return
    }

    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await api.post('/users/profile/image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const url = res.data.data?.profile_image_url
      if (url && profile) {
        const next = { ...profile, profile_image_url: url }
        setProfile(next)
        setUser?.(next)
      }
      setSuccess('Зураг шинэчлэгдлээ')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.response?.data?.message || 'Зураг оруулахад алдаа гарлаа')
    } finally {
      setUploading(false)
    }
  }

  const u = profile || storeUser
  const fullName = u ? `${u.last_name || ''} ${u.first_name || ''}`.trim() : '—'
  const userTypeLabel = USER_TYPE_LABELS[u?.user_type] || u?.user_type || '—'
  const profileImgSrc = u?.profile_image_url
    ? (u.profile_image_url.startsWith('http')
        ? u.profile_image_url
        : `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '')}/${u.profile_image_url}`)
    : null

  const joinedLabel = u?.created_at
    ? (() => {
        const months = Math.floor((Date.now() - new Date(u.created_at)) / (1000 * 60 * 60 * 24 * 30))
        return months <= 0 ? 'Саяхан элссэн' : `${months} сарын өмнө элссэн`
      })()
    : ''

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Профайл</h1>

      {/* Banner */}
      <div
        className="w-full h-44 rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #4fc3f7 0%, #0288d1 40%, #01579b 100%)',
        }}
      />

      {/* Profile card */}
      <div className="bg-white rounded-2xl shadow-sm px-8 py-6 mt-4">

        {/* Top row: avatar + info + edit button */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar with upload */}
            <div className="relative -mt-14 shrink-0">
              <button
                type="button"
                onClick={triggerFilePicker}
                disabled={uploading}
                title="Профайл зураг солих"
                className="w-20 h-20 rounded-full border-4 border-white shadow bg-gray-200
                           overflow-hidden flex items-center justify-center cursor-pointer
                           hover:opacity-90 transition-opacity disabled:opacity-50 p-0"
              >
                {profileImgSrc ? (
                  <img src={profileImgSrc} alt="avatar"
                       className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                  </svg>
                )}
              </button>

              {/* Camera badge */}
              <button
                type="button"
                onClick={triggerFilePicker}
                disabled={uploading}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#3d3a8c]
                           border-2 border-white flex items-center justify-center
                           cursor-pointer hover:bg-[#2d2a7c] transition-colors
                           disabled:opacity-50"
                title="Зураг солих"
              >
                <MdCameraAlt size={14} className="text-white" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Name + rating */}
            <div className="-mt-2">
              <p className="text-xs text-gray-400 mb-0.5">
                {uploading ? 'Зураг хуулагдаж байна...' : 'Дарж зургаа оруулна уу'}
              </p>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">{fullName}</h2>
              <div className="flex items-center gap-2 mt-1">
                <StarRating rating={ratings.summary?.rating_avg || 0} />
                <span className="text-sm text-gray-600">
                  {(ratings.summary?.rating_avg || 0).toFixed(1)}
                </span>
                <span className="text-sm text-gray-400">
                  · {ratings.summary?.rating_count || 0} үнэлгээ
                </span>
              </div>
            </div>
          </div>

          {/* Edit / Save+Cancel */}
          {!editing ? (
            <button
              onClick={startEdit}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#3d3a8c]
                         text-white rounded-xl text-sm font-medium
                         hover:bg-[#2d2a7c] transition-colors shrink-0 cursor-pointer border-0"
            >
              <MdEdit size={16} /> Засах
            </button>
          ) : (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="inline-flex items-center gap-1 px-4 py-2 border border-gray-200
                           text-gray-700 rounded-xl text-sm font-medium
                           hover:bg-gray-50 cursor-pointer bg-white disabled:opacity-50"
              >
                <MdClose size={16} /> Цуцлах
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600
                           text-white rounded-xl text-sm font-medium
                           hover:bg-emerald-700 cursor-pointer border-0
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MdCheck size={16} />
                {saving ? 'Хадгалж байна...' : 'Хадгалах'}
              </button>
            </div>
          )}
        </div>

        {/* Status messages */}
        {(error || success) && (
          <div className="mt-4">
            {success && (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200
                            rounded-lg px-3 py-2 m-0">
                {success}
              </p>
            )}
            {error && !success && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200
                            rounded-lg px-3 py-2 m-0">
                {error}
              </p>
            )}
          </div>
        )}

        {/* Fields grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 mt-7">
          {editing ? (
            <>
              <EditField label="Овог"          name="last_name"  value={form.last_name}  onChange={handleChange} placeholder="Овог" />
              <EditField label="Нэр"           name="first_name" value={form.first_name} onChange={handleChange} placeholder="Нэр" />
              <EditField label="Утасны дугаар" name="phone"      value={form.phone}      onChange={handleChange} placeholder="99001234" />
              <EditField label="Оршин суух хаяг" name="address"  value={form.address}    onChange={handleChange} placeholder="УБ хот, Хан-Уул дүүрэг" />
            </>
          ) : (
            <>
              <ReadField label="Овог"             value={u?.last_name} />
              <ReadField label="Нэр"              value={u?.first_name} />
              <ReadField label="Утасны дугаар"    value={u?.phone} />
              <ReadField label="Оршин суух хаяг"  value={u?.address} />
            </>
          )}

          {/* Системийн утгууд — хэрэглэгч өөрчилж болохгүй */}
          <StaticField label="Хэрэглэгчийн төрөл" value={userTypeLabel} hint="систем тогтоосон" />
          <StaticField label="И-Мэйл"             value={u?.email} hint="өөрчилж болохгүй" />
        </div>

        {/* Email section + meta */}
        {!editing && (
          <div className="mt-9 pt-6 border-t border-gray-100">
            <h3 className="text-base font-semibold text-gray-800 mb-4">И-мэйл хаяг</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800 truncate m-0">{u?.email ?? '—'}</p>
                <p className="text-xs text-gray-400 m-0">{joinedLabel}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Үнэлгээний хэсэг ── */}
      <div className="bg-white rounded-2xl shadow-sm px-8 py-6 mt-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-gray-800 m-0">
            Хүлээн авсан үнэлгээ
          </h3>
          <div className="flex items-center gap-2">
            <StarRating rating={ratings.summary?.rating_avg || 0} />
            <span className="text-sm font-semibold text-gray-900">
              {(ratings.summary?.rating_avg || 0).toFixed(1)}
            </span>
            <span className="text-sm text-gray-400">
              ({ratings.summary?.rating_count || 0})
            </span>
          </div>
        </div>

        {(!ratings.recent || ratings.recent.length === 0) ? (
          <div className="text-center py-10 text-sm text-gray-400">
            Одоохондоо үнэлгээ ирээгүй байна
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {ratings.recent.map(r => (
              <div key={r.rating_id}
                   className="border border-gray-100 rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#3d3a8c] text-white
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
                  <p className="text-sm text-gray-600 m-0 mt-1 pl-10">
                    {r.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
