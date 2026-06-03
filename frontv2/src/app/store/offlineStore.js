import { create } from 'zustand'
import api from '@/lib/api'
import * as db from '@/lib/offlineDb'
import { STORE } from '@/lib/offlineDb'

const OFFLINE_MODE_KEY = 'mg.offlineMode'

// Одоогийн нэвтэрсэн хэрэглэгчийн user_id (localStorage-аас).
// Draft-уудыг өмчлөгчөөр нь шүүхэд хэрэглэнэ — IndexedDB нь browser-д хуваалцагддаг
// тул өөр хэрэглэгч нэвтэрвэл бусдын draft харагдахаас сэргийлнэ.
function currentUserId() {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')?.user_id || null
  } catch {
    return null
  }
}

export { currentUserId }

// ──────────────────────────────────────────────────────────────
// useOfflineStore — offline горимын төлөв + локал template cache.
//
//  online       : navigator.onLine (event-ээр шинэчлэгдэнэ)
//  offlineMode  : хэрэглэгч гараар offline горим руу орсон эсэх (localStorage)
//  templates    : IndexedDB-д кэшлэгдсэн offline-enabled загварууд
//  lastSyncedAt : сүүлд cache хийсэн timestamp (ms)
//  syncing      : cache хийж байгаа эсэх
// ──────────────────────────────────────────────────────────────
const useOfflineStore = create((set, get) => ({
  online:       true,
  offlineMode:  false,
  templates:    [],
  drafts:       [],
  lastSyncedAt: null,
  syncing:      false,
  syncingDrafts:false,
  error:        null,

  // ── App эхлэхэд (OfflineInit) дуудна ──────────────────
  init: async () => {
    // 1. online төлөв + localStorage offlineMode сэргээх
    if (typeof navigator !== 'undefined') set({ online: navigator.onLine })
    if (typeof window !== 'undefined') {
      set({ offlineMode: localStorage.getItem(OFFLINE_MODE_KEY) === 'true' })
    }
    // 2. Локал кэшнээс загвар + draft-уудыг ачаалах (сүлжээгүй ч ажиллана)
    await get().loadCachedTemplates()
    await get().loadDrafts()
    // 3. Online + auth байвал шинээр cache + хүлээгдэж буй draft-уудыг sync (best-effort)
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      get().syncTemplates().catch(() => {})
      get().syncDrafts().catch(() => {})
    }
  },

  setOnline: (online) => set({ online }),

  toggleOfflineMode: () => {
    const next = !get().offlineMode
    if (typeof window !== 'undefined') {
      localStorage.setItem(OFFLINE_MODE_KEY, String(next))
    }
    set({ offlineMode: next })
  },

  // ── IndexedDB-аас кэшлэгдсэн загваруудыг унших ─────────
  loadCachedTemplates: async () => {
    try {
      if (!db.isSupported()) return
      const templates    = (await db.getAll(STORE.TEMPLATES)) || []
      const lastSyncedAt = await db.getMeta('templatesSyncedAt')
      set({ templates, lastSyncedAt })
    } catch (err) {
      console.error('[offline] loadCachedTemplates:', err.message)
    }
  },

  // ── Server-ээс offline-enabled загваруудыг татаж IndexedDB-д хадгалах ──
  syncTemplates: async () => {
    if (get().syncing) return
    set({ syncing: true, error: null })
    try {
      const res     = await api.get('/contracts/templates')
      const offline = (res.data.data || []).filter((t) => t.is_offline_enabled)

      // Бүтэн агуулга (template_content + schema_json) тус бүрд нь татах
      const full = await Promise.all(
        offline.map((t) =>
          api
            .get(`/contracts/templates/${t.template_id}`)
            .then((r) => ({ ...(r.data.data || r.data), is_offline_enabled: true })),
        ),
      )

      if (db.isSupported()) {
        await db.clear(STORE.TEMPLATES)
        await db.putAll(STORE.TEMPLATES, full)
        await db.setMeta('templatesSyncedAt', Date.now())
      }
      set({ templates: full, lastSyncedAt: Date.now() })
    } catch (err) {
      set({ error: err?.response?.data?.message || 'Татахад алдаа гарлаа' })
      throw err
    } finally {
      set({ syncing: false })
    }
  },

  // Нэг кэшлэгдсэн загварыг ID-аар авах (offline create-д хэрэгтэй)
  getCachedTemplate: (id) => get().templates.find((t) => t.template_id === id) || null,

  // ── Offline draft (локал хадгалсан гэрээ) ──────────────
  loadDrafts: async () => {
    try {
      if (!db.isSupported()) return
      const all = (await db.getAll(STORE.DRAFTS)) || []
      // Зөвхөн одоогийн хэрэглэгчийн draft-уудыг харуулна (нууцлал)
      const uid = currentUserId()
      const drafts = all
        .filter((d) => d.owner_id === uid)
        .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      set({ drafts })
    } catch (err) {
      console.error('[offline] loadDrafts:', err.message)
    }
  },

  saveDraft: async (draft) => {
    if (db.isSupported()) await db.put(STORE.DRAFTS, draft)
    set((s) => {
      const exists = s.drafts.some((d) => d.draft_id === draft.draft_id)
      const drafts = exists
        ? s.drafts.map((d) => (d.draft_id === draft.draft_id ? draft : d)) // байрлал хадгална
        : [draft, ...s.drafts]
      return { drafts }
    })
  },

  deleteDraft: async (id) => {
    if (db.isSupported()) await db.del(STORE.DRAFTS, id)
    set((s) => ({ drafts: s.drafts.filter((d) => d.draft_id !== id) }))
  },

  // ── Online болоход draft-уудыг серверт sync хийх ────────
  // Draft бүрд: POST /contracts (үүсгэх) → нөгөө тал байвал POST /contracts/:id/send (урилга)
  // Алдаа гарвал тухайн draft дээр sync_error тэмдэглэж, бусдыг үргэлжлүүлнэ.
  syncDrafts: async () => {
    if (get().syncingDrafts) return { synced: 0, failed: 0 }
    if (typeof navigator !== 'undefined' && !navigator.onLine) return { synced: 0, failed: 0 }

    const pending = get().drafts.filter((d) => !d.synced)
    if (pending.length === 0) return { synced: 0, failed: 0 }

    set({ syncingDrafts: true })
    let synced = 0
    let failed = 0
    try {
      for (const d of pending) {
        try {
          // 1. Гэрээ үүсгэх
          const res = await api.post('/contracts', {
            template_id:      d.template_id,
            creator_role:     d.creator_role,
            title:            d.title,
            filled_data_json: d.filled_data_json,
          })
          const contractId = res.data?.data?.contract_id || null

          // 2. Нөгөө тал байвал урилга илгээх (амжилтгүй ч гэрээ үүссэн хэвээр)
          let sendError = null
          if (contractId && d.participant && (d.participant.email || d.participant.phone)) {
            try {
              await api.post(`/contracts/${contractId}/send`, {
                participants: [{
                  role:  'COUNTERPARTY',
                  email: d.participant.email || undefined,
                  phone: d.participant.phone || undefined,
                }],
              })
            } catch (sendErr) {
              sendError = sendErr?.response?.data?.message || 'Урилга илгээж чадсангүй'
            }
          }

          await get().saveDraft({
            ...d,
            synced:             true,
            synced_contract_id: contractId,
            sync_error:         sendError,   // гэрээ үүссэн ч урилга алдаатай бол энд харагдана
            status:             'SYNCED',
            updated_at:         Date.now(),
          })
          synced += 1
        } catch (err) {
          await get().saveDraft({
            ...d,
            sync_error: err?.response?.data?.message || 'Серверт sync хийхэд алдаа гарлаа',
            updated_at: Date.now(),
          })
          failed += 1
        }
      }
    } finally {
      set({ syncingDrafts: false })
    }
    return { synced, failed }
  },
}))

export default useOfflineStore
