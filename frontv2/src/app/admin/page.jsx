'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { Card, Spinner } from '@/components/ui'

export default function AdminDashboard() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/stats')
      .then(r => setStats(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const cards = stats ? [
    { label: 'Нийт хэрэглэгч',  value: stats.users?.total,     sub: `${stats.users?.active} идэвхтэй`,     icon: '👥', href: '/admin/users',     color: 'blue'   },
    { label: 'Нийт гэрээ',       value: stats.contracts?.total, sub: `${stats.contracts?.completed} дууссан`, icon: '📄', href: '/admin/contracts', color: 'green'  },
    { label: 'Шинэ (30 хоног)',  value: stats.contracts?.new_30d, sub: 'Сүүлийн сар',                        icon: '📈', href: '/admin/contracts', color: 'purple' },
    { label: 'Template',         value: stats.templates?.total, sub: 'Идэвхтэй загварууд',                  icon: '📝', href: '/admin/templates', color: 'yellow' },
  ] : []

  const colorMap = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Системийн ерөнхий байдал</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-8">
            {cards.map((c, i) => (
              <Link key={i} href={c.href}>
                <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                                   text-xl mb-3 ${colorMap[c.color]}`}>
                    {c.icon}
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{c.value || 0}</p>
                  <p className="text-sm font-medium text-gray-700 mt-0.5">{c.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
                </Card>
              </Link>
            ))}
          </div>

          {/* Quick links */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Хурдан холбоосууд</h2>
            <div className="flex gap-3">
              <Link href="/admin/templates"
                className="px-4 py-2 bg-[#1e1b4b] text-white text-sm rounded-xl hover:bg-[#2d2a6e]">
                + Шинэ загвар
              </Link>
              <Link href="/admin/users"
                className="px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-xl hover:bg-gray-50">
                Хэрэглэгчид
              </Link>
              <Link href="/admin/logs"
                className="px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-xl hover:bg-gray-50">
                Лог харах
              </Link>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}