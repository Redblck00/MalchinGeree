'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MdArrowBack } from 'react-icons/md'
import useOfflineStore from '@/app/store/offlineStore'
import * as db from '@/lib/offlineDb'
import { STORE } from '@/lib/offlineDb'
import OfflineContractCreator from '@/components/contracts/OfflineContractCreator'

// Шууд линк / online хандалтад зориулсан route. Offline үеийн үндсэн урсгал нь
// /dashboard/offline хуудсан дотроо inline үүсгэдэг (navigation хийхгүй).
export default function OfflineNewPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const templateId   = searchParams.get('template_id')
  const role         = searchParams.get('role') === 'buyer' ? 'buyer' : 'seller'

  const getCachedTemplate = useOfflineStore((s) => s.getCachedTemplate)

  const [template, setTemplate] = useState(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!templateId) { setLoading(false); return }
    const fromStore = getCachedTemplate(templateId)
    if (fromStore) { setTemplate(fromStore); setLoading(false); return }
    db.get(STORE.TEMPLATES, templateId)
      .then((t) => setTemplate(t || null))
      .finally(() => setLoading(false))
  }, [templateId, getCachedTemplate])

  return (
    <div className="p-4 sm:p-6 pl-16 lg:pl-6 max-w-5xl mx-auto">
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-gray-200 border-t-[#1e1b4b] rounded-full animate-spin" />
        </div>
      ) : !template ? (
        <div>
          <button
            onClick={() => router.push('/dashboard/offline')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 mb-4 text-sm text-gray-600
                       hover:text-gray-900 hover:bg-gray-50 rounded-lg cursor-pointer
                       bg-transparent border border-gray-200"
          >
            <MdArrowBack size={14} /> Буцах
          </button>
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
            <p className="text-sm text-red-500 m-0">
              Энэ загвар локалд кэшлэгдээгүй байна. Онлайн үед "Offline горим → Загвар шинэчлэх"
              дарж татаж аваарай.
            </p>
          </div>
        </div>
      ) : (
        <OfflineContractCreator
          template={template}
          role={role}
          onCancel={() => router.push('/dashboard/offline')}
          onSaved={() => router.push('/dashboard/offline?saved=1')}
        />
      )}
    </div>
  )
}
