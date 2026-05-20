'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  MdArrowBack, MdChevronRight, MdHome, MdHelpOutline,
  MdNotificationsNone,
} from 'react-icons/md'
import api from '@/lib/api'
import useAuthStore from '@/app/store/authStore'
import ContractForm from '@/components/contracts/ContractForm'

export default function NewContractPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const templateId   = searchParams.get('template_id')
  const creatorRole  = searchParams.get('role') === 'buyer' ? 'buyer' : 'seller'

  const { user, restoreAuth } = useAuthStore()

  const [template,   setTemplate]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState(null)

  useEffect(() => { restoreAuth() }, [restoreAuth])

  useEffect(() => {
    if (!templateId) {
      setError('Загвар сонгогдоогүй байна')
      setLoading(false)
      return
    }
    api.get(`/contracts/templates/${templateId}`)
      .then(res => setTemplate(res.data.data || res.data))
      .catch(err => setError(err.response?.data?.message || 'Загвар татаж чадсангүй'))
      .finally(() => setLoading(false))
  }, [templateId])

  const handleSubmit = async (formData) => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await api.post('/contracts', {
        template_id:      templateId,
        creator_role:     creatorRole,
        title:            template.name,
        filled_data_json: formData,
      })
      const newId = res.data.data?.contract_id
      router.push(newId ? `/dashboard/contracts/${newId}` : '/dashboard/contracts')
    } catch (err) {
      setError(err.response?.data?.message || 'Гэрээ үүсгэхэд алдаа гарлаа')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-[#3d3a8c] rounded-full animate-spin" />
      </div>
    )
  }

  if (!template) {
    return (
      <div className="p-8 max-w-md mx-auto text-center">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <p className="text-sm text-red-500 m-0">{error || 'Загвар олдсонгүй'}</p>
          <button
            onClick={() => router.push('/templates')}
            className="mt-5 px-4 py-2 text-sm text-white bg-[#3d3a8c]
                       rounded-lg cursor-pointer border-0 hover:bg-[#2d2a6e]"
          >
            Загварууд руу буцах
          </button>
        </div>
      </div>
    )
  }

  const roleLabel = creatorRole === 'seller' ? 'Худалдагч' : 'Худалдан авагч'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Breadcrumb header (sticky) ─────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          <nav className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-500 min-w-0">
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center gap-1 hover:text-gray-900 cursor-pointer
                         bg-transparent border-0 p-0"
            >
               Dashboard
            </button>
            <MdChevronRight size={14} className="text-gray-300 shrink-0" />
            <button
              onClick={() => router.push('/dashboard/contracts')}
              className="hover:text-gray-900 cursor-pointer bg-transparent border-0 p-0
                         hidden sm:inline truncate"
            >
              Барим бичиг
            </button>
            <MdChevronRight size={14} className="text-gray-300 shrink-0 hidden sm:inline" />
            <span className="text-gray-900 font-semibold truncate">Шинэ гэрээ</span>
          </nav>
          <div className="flex items-center gap-2 text-gray-400 shrink-0">
            <button
              className="w-8 h-8 rounded-full hover:bg-gray-100 cursor-pointer
                         bg-transparent border-0 inline-flex items-center justify-center"
              title="Тусламж"
            >
              <MdHelpOutline size={16} />
            </button>
            <button
              className="w-8 h-8 rounded-full hover:bg-gray-100 cursor-pointer
                         bg-transparent border-0 inline-flex items-center justify-center"
              title="Мэдэгдэл"
            >
              <MdNotificationsNone size={16} />
            </button>
          </div>
        </div>

        {/* ── Toolbar: back + title + role ──────────────────────── */}
        <div className="px-4 sm:px-6 py-3 flex items-center gap-3 border-t border-gray-100">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm
                       text-gray-600 hover:text-gray-900 hover:bg-gray-50
                       rounded-lg cursor-pointer bg-transparent border border-gray-200 shrink-0"
          >
            <MdArrowBack size={14} /> <span className="hidden sm:inline">Буцах</span>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm sm:text-lg font-bold text-gray-900 m-0 truncate">
              {template.name}
            </h1>
            <p className="text-[11px] sm:text-xs text-gray-500 m-0 mt-0.5">
              Та{' '}
              <span className="font-semibold text-[#3d3a8c]">{roleLabel}</span>
              {' '}талаас гэрээ үүсгэж байна
            </p>
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-5 sm:py-6 max-w-7xl mx-auto">
        <ContractForm
          template={template}
          initialData={null}
          creatorRole={creatorRole}
          user={user}
          submitting={submitting}
          error={error}
          submitLabel="Гэрээ үүсгэх"
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
        />
      </div>
    </div>
  )
}
