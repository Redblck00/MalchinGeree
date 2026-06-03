'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Wifi, WifiOff, RefreshCw, CloudOff, FileText, Trash2, Clock, FilePlus, UploadCloud, ExternalLink, AlertTriangle, Pencil } from 'lucide-react'
import useOfflineStore from '@/app/store/offlineStore'
import RoleSelectModal from '@/components/templates/RoleSelectModal'
import OfflineContractCreator from '@/components/contracts/OfflineContractCreator'
import * as db from '@/lib/offlineDb'
import { STORE } from '@/lib/offlineDb'

export default function OfflinePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    online, offlineMode, templates, drafts, lastSyncedAt, syncing, syncingDrafts, error,
    toggleOfflineMode, syncTemplates, deleteDraft, syncDrafts, getCachedTemplate,
  } = useOfflineStore()

  const pendingCount = drafts.filter((d) => !d.synced).length

  const [roleSelecting, setRoleSelecting] = useState(null)
  const [creating, setCreating] = useState(null) // { template, role } — inline create view
  const [msg, setMsg] = useState(null)

  // /dashboard/offline?saved=1 — draft хадгалсны дараа
  useEffect(() => {
    if (searchParams.get('saved') === '1') {
      setMsg({ type: 'success', text: 'Гэрээ offline хадгалагдлаа' })
    }
  }, [searchParams])

  const handleDeleteDraft = async (id) => {
    if (!confirm('Энэ offline draft-ийг устгах уу?')) return
    await deleteDraft(id)
  }

  // Draft-ийг inline нээж үзэх/засах (route шилжихгүй тул offline-д найдвартай)
  // IndexedDB-ээс эх өгөгдлийг дахин уншина (санах ойн stale-ээс сэргийлж).
  const openDraft = async (d) => {
    const tmpl = getCachedTemplate(d.template_id)
    if (!tmpl) {
      setMsg({ type: 'error', text: 'Загвар кэшэнд алга — онлайн үед "Загвар шинэчлэх" дарна уу' })
      return
    }
    let fresh = d
    try {
      const stored = await db.get(STORE.DRAFTS, d.draft_id)
      if (stored) fresh = stored
    } catch (_) { /* IDB уншиж чадахгүй бол санах ойн хувилбараар */ }
    setCreating({ template: tmpl, role: fresh.creator_role, draft: fresh })
  }

  const handleSyncDrafts = async () => {
    setMsg(null)
    const { synced, failed } = await syncDrafts()
    if (synced || failed) {
      setMsg({
        type: failed ? 'error' : 'success',
        text: `${synced} гэрээ серверт бүртгэгдлээ${failed ? `, ${failed} алдаатай` : ''}`,
      })
    }
  }

  const handleSync = async () => {
    setMsg(null)
    try {
      await syncTemplates()
      setMsg({ type: 'success', text: 'Загварууд локалд хадгалагдлаа' })
    } catch {
      setMsg({ type: 'error', text: 'Татаж чадсангүй' })
    }
  }

  // Route руу шилжихгүй — offline navigation/RSC fetch-ээс зайлсхийж inline үүсгэнэ
  const handleRoleSelected = (role) => {
    const tmpl = roleSelecting
    setRoleSelecting(null)
    if (tmpl) setCreating({ template: tmpl, role })
  }

  const syncedLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString('mn-MN')
    : 'хараахан хадгалаагүй'

  // ── Inline create view (route шилжихгүй тул offline-д найдвартай) ──
  if (creating) {
    return (
      <div className="p-4 sm:p-6 pl-16 lg:pl-6 max-w-5xl mx-auto">
        <OfflineContractCreator
          template={creating.template}
          role={creating.role}
          onCancel={() => setCreating(null)}
          onSaved={() => {
            setCreating(null)
            setMsg({ type: 'success', text: 'Гэрээ offline хадгалагдлаа' })
          }}
        />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 pl-16 lg:pl-6 max-w-6xl mx-auto">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 m-0">Offline горим</h1>
          <p className="text-sm text-gray-500 mt-1 m-0">
            Сүлжээгүй үед ашиглах гэрээний загваруудаа локалд хадгална
          </p>
        </div>

        {/* Online/offline badge */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              online
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {online ? <Wifi size={14} /> : <WifiOff size={14} />}
            {online ? 'Онлайн' : 'Сүлжээгүй'}
          </span>
          <button
            onClick={toggleOfflineMode}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs
                        font-medium cursor-pointer border transition-colors ${
              offlineMode
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <CloudOff size={14} />
            {offlineMode ? 'Offline горим: ИДЭВХТЭЙ' : 'Offline горим идэвхжүүлэх'}
          </button>
        </div>
      </div>

      {/* ── Sync bar ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 mb-5
                      bg-white border border-gray-200 rounded-xl">
        <div className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{templates.length}</span> загвар кэшлэгдсэн
          <span className="text-gray-400"> · сүүлд: {syncedLabel}</span>
        </div>
        <button
          onClick={handleSync}
          disabled={!online || syncing}
          title={!online ? 'Онлайн үед л шинэчилнэ' : 'Server-ээс татаж локалд хадгална'}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                     bg-[#1e1b4b] text-white cursor-pointer border-0
                     hover:bg-[#2d2a6e] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Татаж байна…' : 'Загвар шинэчлэх'}
        </button>
      </div>

      {(msg || error) && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm border ${
          msg?.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-600'
        }`}>
          {msg?.text || error}
        </div>
      )}

      {/* ── Хадгалсан offline draft-ууд ─────────────────── */}
      {drafts.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h2 className="text-sm font-semibold text-gray-900 m-0">
              Хадгалсан offline гэрээ ({drafts.length})
            </h2>
            {pendingCount > 0 && (
              <button
                onClick={handleSyncDrafts}
                disabled={!online || syncingDrafts}
                title={!online ? 'Онлайн үед л sync хийнэ' : 'Хүлээгдэж буй гэрээг серверт бүртгэх'}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold
                           bg-emerald-600 text-white cursor-pointer border-0
                           hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <UploadCloud size={14} className={syncingDrafts ? 'animate-pulse' : ''} />
                {syncingDrafts ? 'Sync хийж байна…' : `${pendingCount} гэрээ sync хийх`}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {drafts.map((d) => (
              <div
                key={d.draft_id}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600
                                flex items-center justify-center shrink-0">
                  <FilePlus size={16} />
                </div>
                <div
                  className={`flex-1 min-w-0 ${!d.synced ? 'cursor-pointer' : ''}`}
                  onClick={!d.synced ? () => openDraft(d) : undefined}
                  title={!d.synced ? 'Нээж үзэх / засах' : undefined}
                >
                  <p className="text-sm font-medium text-gray-900 truncate m-0">
                    {d.title || d.template_name}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5 m-0 truncate">
                    {new Date(d.created_at).toLocaleString('mn-MN')}
                    {d.participant?.email ? ` · ${d.participant.email}` : ''}
                  </p>
                  {d.sync_error && (
                    <p className="text-[11px] text-red-500 mt-0.5 m-0 flex items-center gap-1 truncate">
                      <AlertTriangle size={11} className="shrink-0" /> {d.sync_error}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg
                              text-[11px] font-medium ${
                    d.synced
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {d.synced ? 'Бүртгэгдсэн' : (<><Clock size={11} /> Хүлээгдэж буй</>)}
                </span>
                {d.synced && d.synced_contract_id ? (
                  <button
                    onClick={() => router.push(`/dashboard/contracts/${d.synced_contract_id}`)}
                    title="Гэрээ харах"
                    className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-md
                               text-gray-400 hover:text-emerald-600 hover:bg-emerald-50
                               cursor-pointer bg-transparent border-0"
                  >
                    <ExternalLink size={14} />
                  </button>
                ) : !d.synced ? (
                  <>
                    <button
                      onClick={() => openDraft(d)}
                      title="Нээж үзэх / засах"
                      className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-md
                                 text-gray-400 hover:text-[#3d3a8c] hover:bg-indigo-50
                                 cursor-pointer bg-transparent border-0"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteDraft(d.draft_id)}
                      title="Устгах"
                      className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-md
                                 text-gray-400 hover:text-red-600 hover:bg-red-50
                                 cursor-pointer bg-transparent border-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                ) : null}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-2 m-0">
            Online болоход эдгээр гэрээ автоматаар серверт бүртгэгдэж, нөгөө тал руу урилга
            илгээгдэнэ. Гараар sync хийхдээ дээрх товчийг дарна уу.
          </p>
        </div>
      )}

      {/* ── Cached templates ───────────────────────────── */}
      <h2 className="text-sm font-semibold text-gray-900 mb-2">Шинэ offline гэрээ үүсгэх</h2>
      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 text-gray-400
                          flex items-center justify-center mb-4">
            <CloudOff size={28} />
          </div>
          <p className="text-base font-semibold text-gray-900 m-0">Кэшлэгдсэн загвар алга</p>
          <p className="text-sm text-gray-500 mt-1 m-0">
            {online
              ? '"Загвар шинэчлэх" дарж offline загваруудаа татаж аваарай'
              : 'Онлайн болоод загвараа татаж авна уу'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((t) => (
            <button
              key={t.template_id}
              onClick={() => setRoleSelecting(t)}
              className="text-left p-4 rounded-xl border border-gray-200 bg-white
                         hover:border-emerald-300 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600
                                flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate m-0">{t.name}</p>
                  {t.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 m-0">{t.description}</p>
                  )}
                  <p className="text-[11px] text-gray-400 mt-1.5 m-0">
                    {t.schema_json?.fields?.length || 0} талбар
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {roleSelecting && (
        <RoleSelectModal
          template={roleSelecting}
          onClose={() => setRoleSelecting(null)}
          onSelect={handleRoleSelected}
        />
      )}
    </div>
  )
}
