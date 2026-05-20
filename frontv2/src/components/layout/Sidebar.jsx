'use client'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import useAuthStore from '@/app/store/authStore'
import {
  FiUser, FiInbox, FiSend, FiClock, FiArchive,
  FiFileText, FiBookmark,
} from 'react-icons/fi'

// Backend дээрх "uploads/profiles/xxx.jpg" relative path-г бүрэн URL болгох
// (route-аас хамаарахгүй).
function resolveProfileImg(url) {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '')
  return `${base}/${url.replace(/^\/+/, '')}`
}

// Хэрэглэгчийн навигацыг ADMIN-аас тусад нь барина — admin Sidebar нь өөр layout-д ажилладаг
const ADMIN_NAV = [
  { href: '/admin',           label: 'Dashboard',  icon: '⊞' },
  { href: '/admin/templates', label: 'Templates',  icon: '📝' },
  { href: '/admin/users',     label: 'Хэрэглэгчид',icon: '👥' },
  { href: '/admin/contracts', label: 'Гэрээнүүд',  icon: '📄' },
  { href: '/admin/logs',      label: 'Лог',        icon: '📋' },
]

export default function Sidebar() {
  const pathname     = usePathname()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  // Admin sidebar — энгийн dark загвар хэвээр
  if (user?.user_type === 'ADMIN') return <AdminSidebar pathname={pathname} user={user} onLogout={handleLogout} />

  // ── User sidebar (light theme) ─────────────────────
  const filter = searchParams.get('filter')
  const fullName = user
    ? `${user.last_name || ''} ${user.first_name || ''}`.trim()
    : 'user name'
  const initials = user
    ? `${(user.first_name?.[0] || '')}${(user.last_name?.[0] || '')}`.toUpperCase()
    : ''

  // Active checks
  const isContractsBase = pathname === '/dashboard/contracts'
  const isFilter = (f) => isContractsBase && filter === f
  const isContractsRoot = isContractsBase && !filter

  return (
    <aside className="w-66 h-screen bg-white border-r border-gray-100 flex flex-col
                      sticky top-0 shrink-0 overflow-hidden">

      {/* ── System logo ─────────────────────────────── */}
      <div className="px-5 py-5 flex items-center gap-2.5">
        <Image src="/user-multiple.png" alt="" width={26} height={26} className="opacity-70" />
        <span className="text-[15px] font-medium text-gray-700">System Logo here</span>
      </div>

      {/* ── User card ───────────────────────────────── */}
      <div className="px-5 pb-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl overflow-hidden bg-gray-100 shrink-0
                        flex items-center justify-center">
          {user?.profile_image_url ? (
            <img
              src={resolveProfileImg(user.profile_image_url)}
              alt="avatar"
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          ) : initials ? (
            <span className="text-sm font-semibold text-gray-500">{initials}</span>
          ) : (
            <FiUser className="text-gray-400" size={22} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate m-0">
            {fullName || 'user name'}
          </p>
          <p className="text-xs text-gray-400 m-0 mt-0.5">
            user rating score {user?.rating_avg || 0}
          </p>
        </div>
      </div>

      {/* ── DASHBOARD section ──────────────────────── */}
      <SectionHeader>DASHBOARD</SectionHeader>

      <ParentItem
        icon={<Image src="/dashboard-square-01.png" alt="" width={20} height={20} className="opacity-70" />}
        href="/dashboard"
        active={pathname === '/dashboard'}>
        Dashboard
      </ParentItem>

      <SubItem
        icon={<FiUser size={16} />}
        href="/dashboard/profile"
        active={pathname.startsWith('/dashboard/profile')}>
        profiles
      </SubItem>

      <SubItem
        icon={<Image src="/Pen tool.png" alt="" width={16} height={16} className="opacity-60" />}
        href="/dashboard/signature"
        active={pathname.startsWith('/dashboard/signature')}>
        гарын үсэг
      </SubItem>

      <ParentItem
        icon={<FiFileText size={20} className="text-gray-500" />}
        href="/dashboard/contracts"
        active={isContractsRoot}>
        Барим бичиг
      </ParentItem>

      <SubItem
        icon={<FiInbox size={16} />}
        href="/dashboard/contracts?filter=inbox"
        active={isFilter('inbox')}>
        ирсэн
      </SubItem>
      <SubItem
        icon={<FiSend size={16} />}
        href="/dashboard/contracts?filter=sent"
        active={isFilter('sent')}>
        илгээсэн
      </SubItem>
      <SubItem
        icon={<FiClock size={16} />}
        href="/dashboard/contracts?filter=waiting"
        active={isFilter('waiting')}>
        хүлээгдэж байгаа
      </SubItem>
      <SubItem
        icon={<FiArchive size={16} />}
        href="/dashboard/contracts?filter=closed"
        active={isFilter('closed')}>
        Хаагдсан
      </SubItem>

      <ParentItem
        icon={<FiBookmark size={20} className="text-gray-500" />}
        href="/templates"
        active={pathname.startsWith('/templates')}>
        Загвар
      </ParentItem>

      {/* ── COMMUNICATION section ─────────────────── */}
      <SectionHeader>COMMUNICATION</SectionHeader>

      <ParentItem
        icon={<Image src="/user-multiple.png" alt="" width={20} height={20} className="opacity-70" />}
        href="/dashboard/contacts"
        active={pathname.startsWith('/dashboard/contacts')}>
        Харилцагч
      </ParentItem>

      {/* ── Spacer + Log out ──────────────────────── */}
      <div className="flex-1" />

      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-5 py-4 text-sm text-gray-700
                   hover:bg-gray-50 cursor-pointer border-0 bg-transparent text-left
                   border-t border-gray-100">
        <Image src="/logout-03.png" alt="" width={20} height={20} className="opacity-70" />
        Log out
      </button>
    </aside>
  )
}

// ══════════════════════════════════════════════════════
// SUBCOMPONENTS
// ══════════════════════════════════════════════════════

function SectionHeader({ children }) {
  return (
    <div className="px-5 pt-5 pb-2 text-[10px] font-semibold text-gray-400
                    uppercase tracking-wider">
      {children}
    </div>
  )
}

// Дээд түвшний цэс (Dashboard, Барим бичиг гэх мэт)
function ParentItem({ icon, href, active, children }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors
                  ${active
                    ? 'bg-[#3d3a8c]/10 text-[#3d3a8c] font-medium'
                    : 'text-gray-700 hover:bg-gray-50 font-medium'}`}>
      <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
      {children}
    </Link>
  )
}

// Дэд цэс — мөр зайтай, rounded highlight
function SubItem({ icon, href, active, children }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 mx-3 my-0.5 pl-7 py-2 rounded-xl text-[13px] transition-colors
                  ${active
                    ? 'bg-[#dfe7ff] text-[#3d3a8c] font-medium'
                    : 'text-gray-500 hover:bg-gray-50'}`}>
      <span className="w-4 h-4 flex items-center justify-center text-gray-500 shrink-0">
        {icon}
      </span>
      {children}
    </Link>
  )
}

// ══════════════════════════════════════════════════════
// ADMIN SIDEBAR (өөр загвар)
// ══════════════════════════════════════════════════════
function AdminSidebar({ pathname, user, onLogout }) {
  return (
    <aside className="w-64 h-screen bg-[#1e1b4b] flex flex-col sticky top-0 shrink-0 overflow-hidden">
      <div className="px-6 py-5 border-b border-white/10">
        <h1 className="text-white font-bold text-lg m-0">Цахим Гэрээ</h1>
        <p className="text-white/40 text-xs mt-0.5 m-0">Admin v2.0</p>
      </div>

      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center
                          text-white font-semibold text-sm shrink-0">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div className="overflow-hidden">
            <p className="text-white text-sm font-medium truncate m-0">
              {user?.last_name} {user?.first_name}
            </p>
            <p className="text-white/40 text-xs m-0">Админ</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {ADMIN_NAV.map((item) => {
          const active = pathname === item.href ||
                         (item.href !== '/admin' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all
                          ${active
                            ? 'bg-white text-[#1e1b4b] font-semibold'
                            : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pb-5">
        <button onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                     text-sm text-white/50 hover:text-white hover:bg-white/10 transition-all
                     cursor-pointer bg-transparent border-0 text-left">
          <span>↩</span>Гарах
        </button>
      </div>
    </aside>
  )
}
