'use client'
import { useRef, useState } from 'react'
import api from '@/lib/api'
import useAuthStore from '@/app/store/authStore'
import { Pencil, Check, X, Camera, Star } from 'lucide-react'

function resolveImg(url) {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '')
  return `${base}/${url.replace(/^\/+/, '')}`
}

function StarRating({ rating = 0, size = 16 }) {
  const rounded = Math.round(rating)
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) =>
        i < rounded
          ? <Star key={i} size={size} className="text-amber-400 fill-amber-400" />
          : <Star key={i} size={size} className="text-white/70" />
      )}
    </div>
  )
}

function InfoCard({ label, value, name, editing, onChange, readonly }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[13px] text-[#1a4d33] font-medium px-1">{label}</span>
      <div
        className="bg-white  h-10 px-4 flex items-center
                   shadow-[0_2px_6px_rgba(0,107,53,0.08)]"
      >
        {editing && !readonly ? (
          <input
            name={name}
            value={value || ''}
            onChange={onChange}
            placeholder={label}
            className="w-full bg-transparent outline-none text-sm text-gray-800
                       placeholder:text-gray-300"
          />
        ) : (
          <span className={`text-sm ${value ? 'text-gray-700' : 'text-gray-300'} uppercase tracking-wide`}>
            {value || label}
          </span>
        )}
      </div>
    </div>
  )
}

export default function ProfileSidebar({
  profile,
  ratings,
  onProfileUpdated,
  // bare=true → bg/rounded/sticky/width хасагдсан "inline" хувилбар.
  // Profile page-ийн зүүн талын scrollable column-д ашиглана.
  bare = false,
}) {
  const { setUser } = useAuthStore()
  const fileInputRef = useRef(null)

  const [editing,   setEditing]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState(null)
  const [success,   setSuccess]   = useState(null)
  const [form,      setForm]      = useState({
    last_name:  profile?.last_name  || '',
    first_name: profile?.first_name || '',
    phone:      profile?.phone      || '',
    address:    profile?.address    || '',
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  const startEdit = () => {
    setEditing(true)
    setError(null); setSuccess(null)
    setForm({
      last_name:  profile?.last_name  || '',
      first_name: profile?.first_name || '',
      phone:      profile?.phone      || '',
      address:    profile?.address    || '',
    })
  }

  const cancelEdit = () => {
    setEditing(false)
    setError(null)
  }

  const handleSave = async () => {
    setSaving(true); setError(null)
    try {
      const res = await api.patch('/users/profile', form)
      const updated = res.data.data || res.data
      onProfileUpdated?.(updated)
      setUser?.(updated)
      setEditing(false)
      setSuccess('Профайл шинэчлэгдлээ')
      setTimeout(() => setSuccess(null), 2500)
    } catch (err) {
      setError(err.response?.data?.message || 'Хадгалахад алдаа гарлаа')
    } finally {
      setSaving(false)
    }
  }

  const triggerFile = () => { if (!uploading) fileInputRef.current?.click() }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Зөвхөн зураг'); return }
    if (file.size > 5 * 1024 * 1024)     { setError('5MB-аас бага');  return }

    setUploading(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await api.post('/users/profile/image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const url = res.data.data?.profile_image_url
      if (url && profile) {
        const next = { ...profile, profile_image_url: url }
        onProfileUpdated?.(next)
        setUser?.(next)
      }
      setSuccess('Зураг шинэчлэгдлээ')
      setTimeout(() => setSuccess(null), 2500)
    } catch (err) {
      setError(err.response?.data?.message || 'Зураг оруулахад алдаа гарлаа')
    } finally {
      setUploading(false)
    }
  }

  const fullName = profile
    ? `${profile.last_name || ''} ${profile.first_name || ''}`.trim() || '—'
    : '—'

  const avatarSrc = resolveImg(profile?.profile_image_url)
  const ratingAvg = ratings?.summary?.rating_avg || 0
  const ratingCnt = ratings?.summary?.rating_count || 0

  // bare режимд: цайвар цагаан no bg, no rounded, no fixed width — parent
  // нь scroll-ийг хариуцна. Default режим: хуучны emerald gradient aside.
  const wrapperClassName = bare
    ? 'w-full flex flex-col px-2 py-2'
    : 'w-90 h-screen flex flex-col sticky top-0 shrink-0 overflow-y-auto no-scrollbar rounded-tl-[40px] rounded-bl-[40px] px-6 py-7'
  const wrapperStyle = bare
    ? undefined
    : { background: 'linear-gradient(to bottom, #C8FAE4 25%, #9CF5D3 100%)' }

  return (
    <aside className={wrapperClassName} style={wrapperStyle}>
      {/* Avatar */}
      <div className="flex justify-center">
        <div className="relative">
          <button
            type="button"
            onClick={triggerFile}
            disabled={uploading}
            title="Профайл зураг солих"
            className="w-44 h-44 rounded-full overflow-hidden bg-white shadow-md
                       border-4 border-white flex items-center justify-center
                       cursor-pointer p-0 hover:opacity-90 disabled:opacity-60"
          >
            {avatarSrc ? (
              <img src={avatarSrc} alt="avatar"
                   className="w-full h-full object-cover" />
            ) : (
              <svg className="w-20 h-20 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={triggerFile}
            disabled={uploading}
            className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-[#006B35]
                       border-2 border-white flex items-center justify-center
                       cursor-pointer hover:bg-[#00582c] transition-colors
                       disabled:opacity-50"
            title="Зураг солих"
          >
            <Camera size={16} className="text-white" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      </div>

      {/* Name + rating */}
      <div className="mt-4 text-center">
        <h2 className="text-xl font-bold text-[#006B35] m-0 leading-tight">
          {fullName}
        </h2>
        <div className="flex items-center justify-center gap-2 mt-1.5">
          <StarRating rating={ratingAvg} />
          <span className="text-sm text-[#1a4d33]/80">
            {ratingCnt} үнэлгээ
          </span>
        </div>
      </div>

      {/* Status */}
      {(success || error) && (
        <div className="mt-4">
          {success && (
            <p className="text-xs text-emerald-800 bg-white/70 border border-emerald-200
                          rounded-xl px-3 py-2 m-0 text-center">
              {success}
            </p>
          )}
          {error && !success && (
            <p className="text-xs text-red-700 bg-white/80 border border-red-200
                          rounded-xl px-3 py-2 m-0 text-center">
              {error}
            </p>
          )}
        </div>
      )}

      {/* Info cards */}
      <div className="mt-6 bg-white/55 rounded-3xl p-4 flex flex-col gap-3">
        <p className="text-[13px] font-medium text-[#1a4d33] m-0 px-1">
          Хэрэглэгчийн мэдээлэл
        </p>

        <InfoCard
          label="Овог"
          name="last_name"
          value={editing ? form.last_name : profile?.last_name}
          editing={editing}
          onChange={handleChange}
        />
        <InfoCard
          label="Нэр"
          name="first_name"
          value={editing ? form.first_name : profile?.first_name}
          editing={editing}
          onChange={handleChange}
        />
        <InfoCard
          label="Утасны дугаар"
          name="phone"
          value={editing ? form.phone : profile?.phone}
          editing={editing}
          onChange={handleChange}
        />
        <InfoCard
          label="Оршин суух хаяг"
          name="address"
          value={editing ? form.address : profile?.address}
          editing={editing}
          onChange={handleChange}
        />
        <InfoCard
          label="И-мэйл"
          value={profile?.email}
          readonly
        />
      </div>

      {/* Edit / Save */}
      <div className="mt-6 flex justify-end gap-2 pb-2">
        {!editing ? (
          <button
            onClick={startEdit}
            className="inline-flex items-center justify-center gap-1.5 w-30 h-12
                       bg-[#006B35] text-white rounded-2xl text-sm font-semibold
                       hover:bg-[#00582c] transition-colors cursor-pointer border-0
                       shadow-sm"
          >
            <Pencil size={16} /> Edit
          </button>
        ) : (
          <>
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="inline-flex items-center justify-center gap-1 px-4 h-12
                         bg-white text-[#1a4d33] rounded-2xl text-sm font-medium
                         border-0 shadow-sm hover:bg-gray-50 cursor-pointer
                         disabled:opacity-50"
            >
              <X size={16} /> Цуцлах
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center gap-1.5 px-5 h-12
                         bg-[#006B35] text-white rounded-2xl text-sm font-semibold
                         hover:bg-[#00582c] cursor-pointer border-0 shadow-sm
                         disabled:opacity-60"
            >
              <Check size={16} />
              {saving ? 'Хадгалж...' : 'Хадгалах'}
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
