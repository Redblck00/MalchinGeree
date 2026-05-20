'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Card, Spinner, Badge, Alert } from '@/components/ui'

// "WAITING" нь PARTIALLY_SIGNED + FULLY_SIGNED-ийг нэг "Хүлээгдэж байгаа" хэлбэрээр харуулах
// зориулалттай virtual статус (DB-д байхгүй, зөвхөн UI display-д ашиглана)
const STATUS_LABELS = {
  DRAFT:     { label: 'Ноорог',           color: 'gray'   },
  SENT:      { label: 'Илгээгдсэн',       color: 'yellow' },
  WAITING:   { label: 'Хүлээгдэж байгаа', color: 'yellow' },
  COMPLETED: { label: 'Баталгаажсан',     color: 'green'  },
  DECLINED:  { label: 'Татгалзсан',       color: 'red'    },
  CANCELLED: { label: 'Цуцлагдсан',       color: 'red'    },
  EXPIRED:   { label: 'Хугацаа дууссан',  color: 'gray'   },
}

// Бодит DB статусыг UI label-руу хөрвүүлэх
const displayStatus = (s) => {
  if (s === 'PARTIALLY_SIGNED' || s === 'FULLY_SIGNED') return STATUS_LABELS.WAITING
  return STATUS_LABELS[s] || { label: s, color: 'gray' }
}

const CANCELLABLE_STATUSES = ['DRAFT', 'SENT', 'PARTIALLY_SIGNED', 'FULLY_SIGNED']

export default function AdminContractsPage() {
  const router = useRouter()

  const [contracts, setContracts] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [message,   setMessage]   = useState(null)
  const [updating,  setUpdating]  = useState(null)

  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchContracts = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/contracts')
      setContracts(res.data.data || [])
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Алдаа' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchContracts() }, [])

  const handleCancel = async (contractId, num) => {
    if (!confirm(`"${num}" гэрээг цуцлах уу?`)) return
    setUpdating(contractId)
    try {
      await api.patch(`/admin/contracts/${contractId}/status`, { status: 'CANCELLED' })
      setMessage({ type: 'success', text: 'Гэрээ цуцлагдлаа' })
      fetchContracts()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Алдаа' })
    } finally {
      setUpdating(null)
    }
  }

  const filtered = useMemo(() => {
    return contracts.filter(c => {
      const text = `${c.contract_number || ''} ${c.title || ''} ${c.creator_name || ''} ${c.template_name || ''}`.toLowerCase()
      const matchSearch = !search || text.includes(search.toLowerCase())
      // WAITING сонговол PARTIALLY_SIGNED болон FULLY_SIGNED-ийг хоёуланг шүүнэ
      const matchStatus = !statusFilter ||
        (statusFilter === 'WAITING'
          ? ['PARTIALLY_SIGNED', 'FULLY_SIGNED'].includes(c.status)
          : c.status === statusFilter)
      return matchSearch && matchStatus
    })
  }, [contracts, search, statusFilter])

  const stats = useMemo(() => ({
    total:    contracts.length,
    draft:    contracts.filter(c => c.status === 'DRAFT').length,
    sent:     contracts.filter(c => ['SENT', 'PARTIALLY_SIGNED', 'FULLY_SIGNED'].includes(c.status)).length,
    completed:contracts.filter(c => c.status === 'COMPLETED').length,
    cancelled:contracts.filter(c => ['CANCELLED', 'DECLINED', 'EXPIRED'].includes(c.status)).length,
  }), [contracts])

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Гэрээнүүд</h1>
        <p className="text-sm text-gray-500 mt-1">
          Системийн бүх гэрээний жагсаалт ({contracts.length})
        </p>
      </div>

      {message && (
        <div className="mb-4">
          <Alert type={message.type}>{message.text}</Alert>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <StatBox label="Нийт"          value={stats.total}     color="bg-gray-50 text-gray-700" />
        <StatBox label="Ноорог"         value={stats.draft}     color="bg-slate-50 text-slate-700" />
        <StatBox label="Идэвхтэй"       value={stats.sent}      color="bg-yellow-50 text-yellow-700" />
        <StatBox label="Дууссан"        value={stats.completed} color="bg-green-50 text-green-700" />
        <StatBox label="Цуцлагдсан"     value={stats.cancelled} color="bg-red-50 text-red-700" />
      </div>

      {/* Filters */}
      <Card className="p-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Дугаар, гарчиг, үүсгэгчээр хайх..."
            className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none
                       focus:border-[#1e1b4b] bg-white"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none
                       focus:border-[#1e1b4b] bg-white"
          >
            <option value="">Бүх статус</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1.5fr_2fr_1.5fr_1.5fr_1fr_1fr_80px] gap-4 px-5 py-3
                        bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
          <span>Дугаар</span>
          <span>Гарчиг</span>
          <span>Загвар</span>
          <span>Үүсгэгч</span>
          <span>Статус</span>
          <span>Огноо</span>
          <span>Үйлдэл</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">
            Гэрээ олдсонгүй
          </div>
        ) : filtered.map((c, i) => {
          const status = displayStatus(c.status)
          const isUpdating = updating === c.contract_id
          const canCancel = CANCELLABLE_STATUSES.includes(c.status)

          return (
            <div key={c.contract_id}
              className={`grid grid-cols-[1.5fr_2fr_1.5fr_1.5fr_1fr_1fr_80px] gap-4 px-5 py-3.5
                          items-center text-sm cursor-pointer hover:bg-gray-50 transition-colors
                          ${i < filtered.length - 1 ? 'border-b border-gray-100' : ''}`}
              onClick={() => router.push(`/dashboard/contracts/${c.contract_id}`)}>
              <span className="font-mono text-xs text-[#3d3a8c] font-semibold">
                {c.contract_number || '—'}
              </span>
              <span className="text-gray-900 truncate">{c.title || '—'}</span>
              <span className="text-gray-500 text-xs truncate">{c.template_name || '—'}</span>
              <span className="text-gray-700 truncate">{c.creator_name || '—'}</span>
              <Badge color={status.color}>{status.label}</Badge>
              <span className="text-gray-400 text-xs">
                {c.created_at ? new Date(c.created_at).toLocaleDateString('mn-MN') : '—'}
              </span>
              <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                {canCancel && (
                  <button
                    onClick={() => handleCancel(c.contract_id, c.contract_number)}
                    disabled={isUpdating}
                    title="Цуцлах"
                    className="px-2.5 py-1 text-xs text-red-600 border border-red-200
                               rounded-lg hover:bg-red-50 disabled:opacity-40 cursor-pointer bg-white">
                    ×
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </Card>
    </div>
  )
}

function StatBox({ label, value, color }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${color}`}>
      <p className="text-2xl font-bold m-0">{value}</p>
      <p className="text-xs opacity-80 m-0 mt-0.5">{label}</p>
    </div>
  )
}
