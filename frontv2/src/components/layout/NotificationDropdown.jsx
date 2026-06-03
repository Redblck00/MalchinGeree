'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Bell } from 'lucide-react'

// Цаг өнгөрснийг хүн уншигдахуйцаар форматлах
function timeAgo(timestamp) {
  if (!timestamp) return ''
  const diff = Date.now() - new Date(timestamp).getTime()
  const min  = Math.floor(diff / 60000)
  if (min < 1)  return 'Дөнгөж сая'
  if (min < 60) return `${min} мин өмнө`
  const hr   = Math.floor(min / 60)
  if (hr < 24)  return `${hr} цагийн өмнө`
  const days = Math.floor(hr / 24)
  if (days < 7) return `${days} өдрийн өмнө`
  return new Date(timestamp).toLocaleDateString('mn-MN')
}

export default function NotificationDropdown({ transparent = false, iconClassName = '' }) {
  const router = useRouter()
  const [open,    setOpen]    = useState(false)
  const [notifs,  setNotifs]  = useState([])
  const [unread,  setUnread]  = useState(0)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  // Backend-аас мэдэгдэл татах
  const fetchNotifs = async () => {
    try {
      const res  = await api.get('/users/notifications')
      const list = res.data.data || res.data || []
      const u    = res.data.unread ?? list.filter(n => !n.is_read).length
      setNotifs(list)
      setUnread(u)
    } catch (_) {}
  }

  useEffect(() => {
    fetchNotifs()
    const id = setInterval(fetchNotifs, 30000) // 30с тутамд polling
    return () => clearInterval(id)
  }, [])

  // Dropdown-аас гадуур click → хаах
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleClick = async (notif) => {
    setOpen(false)
    if (!notif.is_read) {
      api.patch(`/users/notifications/${notif.notification_id}/read`).catch(() => {})
    }
    if (notif.contract_id) {
      router.push(`/dashboard/contracts/${notif.contract_id}`)
    }
    setTimeout(fetchNotifs, 300)
  }

  const handleMarkAllRead = async (e) => {
    e.stopPropagation()
    setLoading(true)
    try {
      await api.patch('/users/notifications/read-all')
      await fetchNotifs()
    } catch (_) {}
    setLoading(false)
  }

  return (
    <div className="relative" ref={ref}>
      {/* Bell button + unread badge */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Мэдэгдэл"
        className={`relative p-2 rounded-lg transition-colors cursor-pointer
                    border-0 bg-transparent ${
                      transparent
                        ? 'text-white hover:bg-white/10'
                        : 'hover:bg-gray-100'
                    } ${iconClassName || 'text-gray-700'}`}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-red-500 text-white
                           text-[10px] font-bold rounded-full
                           flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown overlay */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-sm shadow-xl
                        border border-gray-100 z-50 max-h-96  flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 m-0">Мэдэгдэл</p>
              {unread > 0 && (
                <p className="text-xs text-gray-500 m-0 mt-0.5">{unread} шинэ</p>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-xs text-[#3d3a8c] hover:underline cursor-pointer
                           bg-transparent border-0 disabled:opacity-50"
              >
                Бүгдийг уншсан
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto overflow-hidden">
            {notifs.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Bell size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400 m-0">Мэдэгдэл байхгүй</p>
              </div>
            ) : (
              notifs.map(n => (
                <button
                  key={n.notification_id}
                  onClick={() => handleClick(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left
                              hover:bg-gray-50 transition-colors cursor-pointer border-0
                              ${!n.is_read ? 'bg-blue-50/40' : 'bg-white'}`}
                >
                  {/* Unread dot */}
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0
                                    ${!n.is_read ? 'bg-[#3d3a8c]' : 'bg-transparent'}`} />

                  <div className="min-w-0 flex-1">
                    <p className={`text-sm m-0 truncate
                                   ${!n.is_read
                                     ? 'font-semibold text-gray-900'
                                     : 'font-medium text-gray-700'}`}>
                      {n.title || 'Мэдэгдэл'}
                    </p>
                    {n.message && (
                      <p className="text-xs text-gray-500 m-0 mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400 m-0 mt-1">
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
