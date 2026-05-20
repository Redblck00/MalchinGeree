'use client'
import { useState, useEffect, useMemo } from 'react'
import api from '@/lib/api'
import { Card, Spinner, Badge, Button, Alert } from '@/components/ui'

const STATUS_LABELS = {
  PENDING:   { label: 'Хүлээгдэж байгаа', color: 'yellow' },
  ACTIVE:    { label: 'Идэвхтэй',         color: 'green'  },
  SUSPENDED: { label: 'Түр хаасан',       color: 'red'    },
  DELETED:   { label: 'Устгасан',         color: 'gray'   },
}
const TYPE_LABELS = {
  USER:    { label: 'Хэрэглэгч', color: 'blue'   },
  ADMIN:   { label: 'Админ',     color: 'purple' },
  SUPPORT: { label: 'Туслалцаа', color: 'gray'   },
}

export default function AdminUsersPage() {
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [updating, setUpdating] = useState(null)

  const [search,     setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter,   setTypeFilter]   = useState('')

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/users')
      setUsers(res.data.data || [])
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Алдаа' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  // Status шинэчлэх
  const handleStatusChange = async (userId, status, name) => {
    const labels = { ACTIVE: 'идэвхжүүлэх', SUSPENDED: 'түр хаах', DELETED: 'устгах' }
    if (!confirm(`"${name}"-ийг ${labels[status]} үү?`)) return
    setUpdating(userId)
    try {
      await api.patch(`/admin/users/${userId}/status`, { status })
      setMessage({ type: 'success', text: 'Статус шинэчлэгдлээ' })
      fetchUsers()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Алдаа' })
    } finally {
      setUpdating(null)
    }
  }

  const filtered = useMemo(() => {
    return users.filter(u => {
      const text = `${u.first_name} ${u.last_name} ${u.email || ''} ${u.phone || ''}`.toLowerCase()
      const matchSearch = !search || text.includes(search.toLowerCase())
      const matchStatus = !statusFilter || u.status === statusFilter
      const matchType   = !typeFilter   || u.user_type === typeFilter
      return matchSearch && matchStatus && matchType
    })
  }, [users, search, statusFilter, typeFilter])

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Хэрэглэгчид</h1>
        <p className="text-sm text-gray-500 mt-1">
          Бүх бүртгэлтэй хэрэглэгчдийн жагсаалт ({users.length})
        </p>
      </div>

      {message && (
        <div className="mb-4">
          <Alert type={message.type}>{message.text}</Alert>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px] gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Нэр, имэйл, утсаар хайх..."
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
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none
                       focus:border-[#1e1b4b] bg-white"
          >
            <option value="">Бүх төрөл</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-[2fr_2fr_1.5fr_1fr_1fr_1.5fr_180px] gap-4 px-5 py-3
                        bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
          <span>Нэр</span>
          <span>Имэйл</span>
          <span>Утас</span>
          <span>Төрөл</span>
          <span>Статус</span>
          <span>Бүртгэл</span>
          <span>Үйлдэл</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">
            Хэрэглэгч олдсонгүй
          </div>
        ) : filtered.map((u, i) => {
          const status = STATUS_LABELS[u.status] || { label: u.status, color: 'gray' }
          const type   = TYPE_LABELS[u.user_type] || { label: u.user_type, color: 'gray' }
          const name   = `${u.last_name || ''} ${u.first_name || ''}`.trim() || '—'
          const isUpdating = updating === u.user_id

          return (
            <div key={u.user_id}
              className={`grid grid-cols-[2fr_2fr_1.5fr_1fr_1fr_1.5fr_180px] gap-4 px-5 py-3.5
                          items-center text-sm
                          ${i < filtered.length - 1 ? 'border-b border-gray-100' : ''}`}>
              <span className="text-gray-900 font-medium truncate">{name}</span>
              <span className="text-gray-600 truncate">{u.email || '—'}</span>
              <span className="text-gray-600">{u.phone || '—'}</span>
              <Badge color={type.color}>{type.label}</Badge>
              <Badge color={status.color}>{status.label}</Badge>
              <span className="text-gray-400 text-xs">
                {u.created_at ? new Date(u.created_at).toLocaleDateString('mn-MN') : '—'}
              </span>
              <div className="flex gap-1.5">
                {u.status !== 'ACTIVE' && (
                  <button
                    onClick={() => handleStatusChange(u.user_id, 'ACTIVE', name)}
                    disabled={isUpdating || u.user_type === 'ADMIN'}
                    className="px-2.5 py-1 text-xs text-green-700 border border-green-200
                               rounded-lg hover:bg-green-50 disabled:opacity-40 cursor-pointer bg-white">
                    ✓
                  </button>
                )}
                {u.status !== 'SUSPENDED' && u.status !== 'DELETED' && (
                  <button
                    onClick={() => handleStatusChange(u.user_id, 'SUSPENDED', name)}
                    disabled={isUpdating || u.user_type === 'ADMIN'}
                    title="Түр хаах"
                    className="px-2.5 py-1 text-xs text-yellow-700 border border-yellow-200
                               rounded-lg hover:bg-yellow-50 disabled:opacity-40 cursor-pointer bg-white">
                    ⏸
                  </button>
                )}
                {u.status !== 'DELETED' && (
                  <button
                    onClick={() => handleStatusChange(u.user_id, 'DELETED', name)}
                    disabled={isUpdating || u.user_type === 'ADMIN'}
                    title="Устгах"
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
