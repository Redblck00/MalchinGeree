'use client'

import { useState, useEffect } from 'react'
import { MdArrowBack, MdPersonAddAlt } from 'react-icons/md'
import { CloudOff } from 'lucide-react'
import useOfflineStore from '@/app/store/offlineStore'
import useAuthStore from '@/app/store/authStore'
import ContractForm from '@/components/contracts/ContractForm'

// Offline гэрээ үүсгэгч — тусдаа route руу шилжихгүйгээр inline ашиглагдана
// (offline navigation/RSC fetch-ээс зайлсхийнэ). Бөглөсөн гэрээг IndexedDB
// drafts store-д хадгална. Props: template, role, onSaved(), onCancel().
export default function OfflineContractCreator({ template, role = 'seller', draft = null, onSaved, onCancel }) {
  const saveDraft = useOfflineStore((s) => s.saveDraft)
  const { user, restoreAuth } = useAuthStore()

  const isEditing = !!draft
  const [saving,  setSaving]  = useState(false)
  const [cpEmail, setCpEmail] = useState(draft?.participant?.email || '')
  const [cpPhone, setCpPhone] = useState(draft?.participant?.phone || '')

  useEffect(() => { restoreAuth() }, [restoreAuth])

  const handleSubmit = async (formData) => {
    setSaving(true)
    try {
      const trimmedEmail = cpEmail.trim()
      const trimmedPhone = cpPhone.trim()
      const next = {
        // Засаж байгаа бол ижил draft_id (шинэчлэгдэнэ), эс бол шинэ
        draft_id:         draft?.draft_id || (globalThis.crypto?.randomUUID?.() || `d-${Date.now()}`),
        // Өмчлөгч — зөвхөн энэ хэрэглэгчид харагдана (нэг browser дээр олон хэрэглэгч)
        owner_id:         user?.user_id || draft?.owner_id || null,
        template_id:      template.template_id,
        template_name:    template.name || '',
        creator_role:     role,
        title:            template.name || 'Offline гэрээ',
        filled_data_json: formData,
        participant:
          trimmedEmail || trimmedPhone
            ? { email: trimmedEmail || null, phone: trimmedPhone || null }
            : null,
        status:             'DRAFT',
        synced:             false,
        synced_contract_id: null,
        sync_error:         null,
        created_at:         draft?.created_at || Date.now(),
        updated_at:         Date.now(),
      }
      await saveDraft(next)
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  const roleLabel = role === 'seller' ? 'Худалдагч' : 'Худалдан авагч'

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600
                     hover:text-gray-900 hover:bg-gray-50 rounded-lg cursor-pointer
                     bg-transparent border border-gray-200"
        >
          <MdArrowBack size={14} /> Буцах
        </button>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                         bg-amber-50 text-amber-700 text-xs font-medium">
          <CloudOff size={14} /> Offline горим
        </span>
      </div>

      <div className="mb-4">
        <h1 className="text-lg sm:text-xl font-bold text-gray-900 m-0">{template.name}</h1>
        <p className="text-xs text-gray-500 mt-1 m-0">
          Та <span className="font-semibold text-emerald-700">{roleLabel}</span> талаас offline
          гэрээ үүсгэж байна — мэдээлэл локалд хадгалагдана
        </p>
      </div>

      {/* Нөгөө тал */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <MdPersonAddAlt size={18} className="text-[#3d3a8c]" />
          <h2 className="text-sm font-semibold text-gray-900 m-0">Оролцогч (заавал биш)</h2>
        </div>
        <p className="text-xs text-gray-500 mb-3 m-0">
          Online болоход энэ хүн рүү урилга (mailbox) илгээгдэнэ.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-700">Имэйл</label>
            <input
              type="email" value={cpEmail} onChange={(e) => setCpEmail(e.target.value)}
              placeholder="buyer@example.com"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900
                         outline-none focus:border-[#3d3a8c] focus:ring-2 focus:ring-[#3d3a8c]/10"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-700">Утас</label>
            <input
              type="tel" value={cpPhone} onChange={(e) => setCpPhone(e.target.value)}
              placeholder="99112233"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900
                         outline-none focus:border-[#3d3a8c] focus:ring-2 focus:ring-[#3d3a8c]/10"
            />
          </div>
        </div>
      </div>

      <ContractForm
        template={template}
        initialData={draft?.filled_data_json || null}
        creatorRole={role}
        user={user}
        submitting={saving}
        submitLabel={isEditing ? 'Өөрчлөлт хадгалах' : 'Offline хадгалах'}
        onSubmit={handleSubmit}
        onCancel={onCancel}
      />
    </div>
  )
}
