'use client'
import { useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import {
  MdSearch, MdPersonAdd, MdClose, MdStar,
  MdMail, MdPhone, MdSend, MdPersonOutline,
} from 'react-icons/md'

// ══════════════════════════════════════════════════════════════
// AddParticipantModal — "Талыг нэмэх" modal цонх
//
// Бизнес урсгал:
//   DRAFT гэрээнд нөгөө тал нэмэх → modal нээгдэнэ →
//     • "Хайх" таб:   өмнө гэрээ байгуулсан хүмүүсээс хайж сонгоно
//     • "Шинээр" таб: имэйл/нэр/гарчиг бөглөж урилга илгээнэ
//   → onSubmit({ user_id?, email, name?, subject? }) →
//   → parent POST /:id/send → DRAFT → SENT
//
// Props:
//   open       boolean
//   onClose    () => void
//   onSubmit   ({ user_id?, email, name?, subject? }) => Promise
//   submitting boolean   (parent-аас sending state)
// ══════════════════════════════════════════════════════════════
function resolveProfileImg(url) {
  if (!url) return null
  if (url.startsWith('http')) return url
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api')
    .replace(/\/api$/, '')
  return `${base}/${url}`
}

function displayName(p) {
  const last  = (p.last_name  || '').trim()
  const first = (p.first_name || '').trim()
  if (first || last) return `${last ? last[0] + '.' : ''} ${first}`.trim()
  return p.email || p.phone || '—'
}

function initials(p) {
  if (p.first_name) {
    return (p.last_name?.[0] || '') + (p.first_name?.[0] || '')
  }
  if (p.email) return p.email[0].toUpperCase()
  return '?'
}

export default function AddParticipantModal({
  open,
  onClose,
  onSubmit,
  submitting = false,
}) {
  const [tab, setTab] = useState('search')   // 'search' | 'new'

  // Search tab
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState(null)   // {user_id, email, ...}

  // New tab
  const [subject, setSubject] = useState('')
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')

  const [error, setError] = useState(null)
  const searchTimer = useRef(null)

  // ── Modal нээгдэх бүрд state-ийг арчина ──
  useEffect(() => {
    if (!open) return
    setTab('search')
    setQuery(''); setResults([]); setSelected(null)
    setSubject(''); setName(''); setEmail('')
    setError(null)
  }, [open])

  // ── Debounced search (300ms) ─────────────
  useEffect(() => {
    if (!open || tab !== 'search') return
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await api.get('/users/past-counterparties', {
          params: query.trim() ? { q: query.trim() } : {},
        })
        setResults(res.data.data || [])
      } catch (err) {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(searchTimer.current)
  }, [query, tab, open])

  if (!open) return null

  const canSubmit = tab === 'search'
    ? !!selected
    : (email.trim() && /\S+@\S+\.\S+/.test(email.trim()))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit || submitting) return
    setError(null)
    try {
      if (tab === 'search' && selected) {
        await onSubmit({
          user_id: selected.user_id,
          email:   selected.email,
          name:    displayName(selected),
        })
      } else {
        await onSubmit({
          email:   email.trim(),
          name:    name.trim() || null,
          subject: subject.trim() || null,
        })
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Илгээхэд алдаа гарлаа')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center
                 justify-center p-0 sm:p-4 animate-modal-backdrop"
      onClick={submitting ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="font-forum w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[88vh]
                   flex flex-col shadow-2xl animate-modal-popup
                   border-t sm:border border-[#ece8df] bg-white overflow-hidden "
       
      >
         <div className="pointer-events-none absolute -bottom-20 -right-20 w-72 h-72x`
                  bg-[radial-gradient(circle,rgba(20,184,166,0.25)_0%,transparent_70%)]
                  blur-2xl" />

 

        {/* ── Header ── */}
        <div className="flex items-start gap-3 px-5 sm:px-6 pt-5 sm:pt-6 pb-3
                        border-b border-[#ece8df]">
          <div className="shrink-0 w-10 h-10 bg-[#3d3a8c]/10 flex items-center justify-center">
            <MdPersonAdd size={22} className="text-[#3d3a8c]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg sm:text-xl text-slate-900 m-0 tracking-wide">
              Гэрээнд оролцогч нэмэх
            </h3>
            <p className="text-xs text-slate-500 m-0 mt-0.5 font-sans">
              Өмнөх харилцагчдаасаа сонгох эсвэл имэйлээр шинээр урих
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Хаах"
            className="shrink-0 p-1.5 text-slate-400 hover:text-slate-700
                       hover:bg-slate-100 cursor-pointer bg-transparent border-0
                       disabled:opacity-40"
          >
            <MdClose size={20} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-0 px-5 sm:px-6 pt-3 shrink-0">
          <TabBtn active={tab === 'search'} onClick={() => setTab('search')}>
            <MdSearch size={16} /> Хайх
          </TabBtn>
          <TabBtn active={tab === 'new'} onClick={() => setTab('new')}>
            <MdPersonAdd size={16} /> Шинээр нэмэх
          </TabBtn>
        </div>

        {/* ── Body (scrollable) ── */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4">
            {tab === 'search'
              ? <SearchTab
                  query={query} setQuery={setQuery}
                  results={results} loading={loading}
                  selected={selected} setSelected={setSelected}
                />
              : <NewTab
                  subject={subject} setSubject={setSubject}
                  name={name}       setName={setName}
                  email={email}     setEmail={setEmail}
                />
            }

            {error && (
              <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200
                              text-xs text-red-700 font-sans">
                {error}
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3
                          px-5 sm:px-6 py-4 border-t border-[#ece8df] shrink-0
                          bg-white/40">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 border border-[#ece8df] text-slate-700
                         text-sm hover:bg-slate-50 cursor-pointer bg-white
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Цуцлах
            </button>
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="flex-1 px-4 py-2.5 bg-[#3d3a8c] hover:bg-[#2d2a6e]
                         text-white text-sm font-semibold cursor-pointer border-0
                         inline-flex items-center justify-center gap-1.5
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MdSend size={14} />
              {submitting ? 'Илгээж байна…' : 'Илгээх'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm tracking-wide
                  cursor-pointer border-0 border-b-2 bg-transparent
                  transition-colors
                  ${active
                    ? 'text-[#3d3a8c] border-[#3d3a8c]'
                    : 'text-slate-500 border-transparent hover:text-slate-800'}`}
    >
      {children}
    </button>
  )
}

// ──────────────────────────────────────────────────────────────
function SearchTab({ query, setQuery, results, loading, selected, setSelected }) {
  return (
    <div className="flex flex-col gap-3">
      {/* Search input */}
      <div className="relative">
        <MdSearch size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Нэр, имэйл, утсаар хайх…"
          className="w-full pl-10 pr-3 py-2.5 text-sm font-sans text-slate-900
                     bg-white border border-[#ece8df] outline-none
                     focus:border-[#3d3a8c] placeholder:text-slate-400"
        />
      </div>

      {/* Results */}
      {loading && (
        <p className="text-xs text-slate-500 font-sans text-center py-6 m-0">
          Хайж байна…
        </p>
      )}

      {!loading && results.length === 0 && (
        <div className="px-3 py-8 text-center bg-white/60 border border-dashed border-[#ece8df]">
          <p className="text-sm text-slate-600 m-0">
            {query.trim()
              ? 'Тохирох харилцагч олдсонгүй'
              : 'Танд өмнөх харилцагч байхгүй байна'}
          </p>
          <p className="text-xs text-slate-400 mt-1 m-0 font-sans">
            "Шинээр нэмэх" таб руу шилжиж имэйлээр урина уу
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <ul className="flex flex-col gap-2 m-0 p-0 list-none">
          {results.map(p => {
            const isSel = selected?.user_id === p.user_id
            const img   = resolveProfileImg(p.profile_image_url)
            return (
              <li key={p.user_id}>
                <button
                  type="button"
                  onClick={() => setSelected(p)}
                  className={`w-full flex items-center gap-3 p-3 text-left
                              cursor-pointer border bg-white transition-colors
                              ${isSel
                                ? 'border-[#3d3a8c] ring-1 ring-[#3d3a8c]/30'
                                : 'border-[#ece8df] hover:border-[#3d3a8c]/40'}`}
                >
                  {/* Avatar */}
                  <div className="shrink-0 w-10 h-10 rounded-full overflow-hidden
                                  bg-slate-100 relative">
                    {img ? (
                      <img src={img} alt={displayName(p)}
                           className="w-full h-full object-cover"
                           onError={(e) => { e.currentTarget.style.display = 'none' }} />
                    ) : (
                      <div className="absolute inset-0 bg-[#3d3a8c] text-white
                                      flex items-center justify-center text-sm font-bold uppercase">
                        {initials(p)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 m-0 truncate">
                      {displayName(p)}
                    </p>
                    <p className="text-[11px] text-slate-500 m-0 mt-0.5 font-sans truncate
                                  inline-flex items-center gap-1">
                      <MdMail size={11} /> {p.email || '—'}
                      {p.phone && <><span className="opacity-60">·</span><MdPhone size={11} /> {p.phone}</>}
                    </p>
                  </div>
                  {p.rating_count > 0 && (
                    <span className="shrink-0 inline-flex items-center gap-0.5
                                     text-[11px] font-sans text-slate-600">
                      <MdStar size={12} className="text-amber-400" />
                      {Number(p.rating_avg).toFixed(1)}
                      <span className="text-slate-400">· {p.rating_count}</span>
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
function NewTab({ subject, setSubject, name, setName, email, setEmail }) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Мэйлийн гарчиг" hint="(заавал биш)">
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value.slice(0, 120))}
          maxLength={120}
          placeholder='Жишээ нь: "Мал худалдан авах гэрээний урилга"'
          className="w-full px-3 py-2.5 text-sm font-sans text-slate-900
                     bg-white border border-[#ece8df] outline-none
                     focus:border-[#3d3a8c] placeholder:text-slate-400"
        />
      </Field>

      <Field label="Хүлээн авагчийн нэр" hint="(заавал биш)">
        <div className="relative">
          <MdPersonOutline size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 80))}
            placeholder="Б. Болд"
            className="w-full pl-9 pr-3 py-2.5 text-sm font-sans text-slate-900
                       bg-white border border-[#ece8df] outline-none
                       focus:border-[#3d3a8c] placeholder:text-slate-400"
          />
        </div>
      </Field>

      <Field label="Имэйл хаяг" hint="заавал" required>
        <div className="relative">
          <MdMail size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@mail.com"
            className="w-full pl-9 pr-3 py-2.5 text-sm font-sans text-slate-900
                       bg-white border border-[#ece8df] outline-none
                       focus:border-[#3d3a8c] placeholder:text-slate-400"
          />
        </div>
      </Field>

      <p className="text-[11px] text-slate-500 font-sans m-0 mt-1">
        Урилгын линк имэйлээр илгээгдэнэ. Линк <strong>7 хоног</strong> хүчинтэй.
      </p>
    </div>
  )
}

function Field({ label, hint, required, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-sans font-semibold text-slate-700
                       inline-flex items-center gap-1.5">
        {label}
        {hint && (
          <span className={`text-[10px] font-normal
                            ${required ? 'text-[#3d3a8c]' : 'text-slate-400'}`}>
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  )
}
