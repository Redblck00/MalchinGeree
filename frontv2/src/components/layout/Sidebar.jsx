'use client'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import useAuthStore from '@/app/store/authStore'
import {
  User, Inbox, Send, Clock, Archive,
  FileText, Bookmark, LayoutGrid, MessageSquare, LogOut,
} from 'lucide-react'

const ADMIN_NAV = [
  { href: '/admin',                 label: 'Dashboard',  icon: '⊞' },
  { href: '/admin/templates',       label: 'Templates',  icon: '📝' },
  { href: '/admin/users',           label: 'Хэрэглэгчид',icon: '👥' },
  { href: '/admin/contracts',       label: 'Гэрээнүүд',  icon: '📄' },
  { href: '/admin/reports/visits',  label: 'Зочдын тайлан', icon: '📊' },
  { href: '/admin/logs',            label: 'Лог',        icon: '📋' },
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

  if (user?.user_type === 'ADMIN')
    return <AdminSidebar pathname={pathname} user={user} onLogout={handleLogout} />

  const filter = searchParams.get('filter')
  const isContractsBase = pathname === '/dashboard/contracts'
  const isFilter = (f) => isContractsBase && filter === f
  const isContractsRoot = isContractsBase && !filter

  return (
    <aside
      className="w-70 h-screen flex flex-col sticky top-0 shrink-0 overflow-hidden
                  px-5 py-6"
      style={{
        background: 'linear-gradient(to bottom, #C8FAE4 25%, #9CF5D3 100%)',
      }}
    >
      {/* ══════════════════════════════════════════════════
          DECORATIVE SHAPES — органик (admin-аас өөр)
          • Leaf (мал, малчин сэдэвт нийцсэн ургамал хэлбэр)
          • Blob (зөөлөн, нялх)
          • Sparkle (4 талт од)
          • Wavy line (S-curve)
          ══════════════════════════════════════════════════ */}

      {/* Том blob — дээд баруун */}
      <svg
        aria-hidden
        viewBox="0 0 200 200"
        className="absolute -top-12 -right-12 w-52 h-52 text-emerald-300/30
                   pointer-events-none"
        fill="currentColor"
      >
        <path d="M44.5,-58.3C56.4,-49.1,63.5,-33.9,67.1,-18C70.7,-2.1,70.8,14.6,63.1,27.1C55.4,39.7,40,48.1,24,54.5C8,60.9,-8.6,65.4,-23.5,61.4C-38.3,57.5,-51.4,45.1,-58.6,30.4C-65.7,15.6,-67,-1.5,-62.5,-16.5C-57.9,-31.4,-47.6,-44.2,-34.7,-53.6C-21.7,-63,-6.1,-69,7.8,-65.2C21.8,-61.4,32.6,-47.4,44.5,-58.3Z" transform="translate(100 100)"/>
      </svg>

      {/* Leaf SVG — middle right */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="absolute top-1/3 -right-6 w-24 h-24 rotate-12 text-emerald-500/20
                   pointer-events-none"
        fill="currentColor"
      >
        <path d="M50,5 C75,20 90,45 80,70 C70,90 45,95 25,80 C10,65 15,40 25,25 C30,15 40,8 50,5 Z M50,15 L50,85" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.6" />
      </svg>

      {/* Leaf-2 — bottom area */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="absolute bottom-40 -left-4 w-20 h-20 -rotate-45 text-emerald-600/15
                   pointer-events-none"
        fill="currentColor"
      >
        <path d="M50,5 C75,20 90,45 80,70 C70,90 45,95 25,80 C10,65 15,40 25,25 C30,15 40,8 50,5 Z" />
      </svg>

      {/* Blob — bottom right */}
      <svg
        aria-hidden
        viewBox="0 0 200 200"
        className="absolute -bottom-16 -right-6 w-44 h-44 text-emerald-400/25
                   pointer-events-none"
        fill="currentColor"
      >
        <path d="M37.8,-49.6C49.4,-39.4,59.3,-27.5,63.4,-13.4C67.4,0.6,65.7,16.9,57.9,29.2C50.1,41.5,36.2,49.8,21.8,55.1C7.4,60.5,-7.5,62.9,-21.4,58.7C-35.4,54.6,-48.4,43.9,-55.3,30.4C-62.1,17,-62.8,0.7,-58,-13.2C-53.2,-27.1,-43,-38.6,-31.1,-48.7C-19.2,-58.8,-5.7,-67.5,5.8,-65.9C17.4,-64.3,26.2,-59.8,37.8,-49.6Z" transform="translate(100 100)"/>
      </svg>

      {/* Sparkle ✦ — top accent */}
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="absolute top-32 right-4 w-5 h-5 text-emerald-700/30 pointer-events-none"
        fill="currentColor"
      >
        <path d="M12 0 L13.5 10.5 L24 12 L13.5 13.5 L12 24 L10.5 13.5 L0 12 L10.5 10.5 Z" />
      </svg>

      {/* Sparkle ✦ — middle accent */}
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="absolute top-1/2 left-2 w-3 h-3 text-emerald-700/40 pointer-events-none"
        fill="currentColor"
      >
        <path d="M12 0 L13.5 10.5 L24 12 L13.5 13.5 L12 24 L10.5 13.5 L0 12 L10.5 10.5 Z" />
      </svg>

      {/* Sparkle ✦ — bottom accent */}
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="absolute bottom-32 right-12 w-4 h-4 text-emerald-700/30 pointer-events-none"
        fill="currentColor"
      >
        <path d="M12 0 L13.5 10.5 L24 12 L13.5 13.5 L12 24 L10.5 13.5 L0 12 L10.5 10.5 Z" />
      </svg>

      {/* Wavy S-curve line */}
      <svg
        aria-hidden
        viewBox="0 0 300 50"
        className="absolute top-1/2 -left-10 w-72 h-12 text-emerald-600/15
                   pointer-events-none"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M0,25 Q50,0 100,25 T200,25 T300,25" />
      </svg>

      {/* ══════════════════════════════════════════════════
          CONTENT
          ══════════════════════════════════════════════════ */}
      <div className="relative z-10 flex flex-col flex-1 min-h-0">

      {/* МалчныГэрээ logo */}
      <div className="px-2 text-center mb-4">
        <h1 className="text-2xl font-bold text-[#006B35] m-0 tracking-tight">
          МалчныГэрээ
        </h1>
      </div>

      {/* Sheep icon hero */}
      <div className="flex justify-center my-2 ">
        <div className="w-25 h-25 rounded-full bg-[#d0f5ee] flex items-center justify-center
                        shadow-sm ring-2 ring-white/60">
          <Image
            src="/systemIcon.png"
            alt="system"
            width={120}
            height={120}
            className="object-contain"
          />
        </div>
      </div>

      {/* Nav */}
      <nav className="mt-15 flex flex-col gap-1">
        <NavItem
          icon={<LayoutGrid size={18} />}
          href="/dashboard"
          active={pathname === '/dashboard'}
        >
          Dashboard
        </NavItem>

        <NavItem
          icon={<User size={18} />}
          href="/dashboard/profile"
          active={pathname.startsWith('/dashboard/profile') || pathname.startsWith('/dashboard/signature')}
        >
          profiles
        </NavItem>

        <NavItem
          icon={<FileText size={18} />}
          href="/dashboard/contracts"
          active={isContractsRoot}
        >
          Баримт бичиг
        </NavItem>

        <SubNavItem icon={<Send size={14} />}    href="/dashboard/contracts?filter=sent"    active={isFilter('sent')}>илгээсэн</SubNavItem>
        <SubNavItem icon={<Inbox size={14} />}   href="/dashboard/contracts?filter=inbox"   active={isFilter('inbox')}>ирсэн</SubNavItem>
        <SubNavItem icon={<Clock size={14} />}   href="/dashboard/contracts?filter=waiting" active={isFilter('waiting')}>хүлээгдэж байгаа</SubNavItem>
        <SubNavItem icon={<Archive size={14} />} href="/dashboard/contracts?filter=closed"  active={isFilter('closed')}>хаагдсан</SubNavItem>

        <NavItem
          icon={<Bookmark size={18} />}
          href="/dashboard/templates"
          active={pathname.startsWith('/dashboard/templates')}
        >
          загвар
        </NavItem>
      </nav>

      {/* Bottom block */}
      <div className="flex-1" />

      <div className="px-3 py-2">
        <button
          className="flex items-center gap-2 text-sm text-[#1a4d33] hover:text-[#006B35]
                     bg-transparent border-0 cursor-pointer p-0"
        >
          <MessageSquare size={16} />
          Санал хүсэлт
        </button>
      </div>

      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-4 py-3 mt-2 text-sm font-medium text-[#1a4d33]
                   bg-white rounded-2xl shadow-sm hover:shadow-md hover:bg-gray-50
                   transition-all cursor-pointer border-0 text-left"
      >
        <LogOut size={16} />
        Log out
      </button>
      </div>
    </aside>
  )
}

function NavItem({ icon, href, active, children }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-4 h-12 rounded-2xl text-[14px]
                  transition-colors
                  ${active
                    ? 'bg-[#BDEFD9] text-[#156c06] font-semibold'
                    : 'text-[#1a4d33] hover:bg-white/40 font-medium'}`}
    >
      <span className="w-5 h-5 flex items-center justify-center shrink-0">{icon}</span>
      {children}
    </Link>
  )
}

function SubNavItem({ icon, href, active, children }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 ml-6 px-3 h-10 rounded-xl text-[13px]
                  transition-colors
                  ${active
                    ? 'bg-[#BDEFD9] text-[#B1275F] font-semibold'
                    : 'text-[#1a4d33]/80 hover:bg-white/40'}`}
    >
      <span className="w-4 h-4 flex items-center justify-center shrink-0 opacity-70">
        {icon}
      </span>
      {children}
    </Link>
  )
}

// ── Admin sidebar (гүн ногоон gradient + чимэглэл) ────
function AdminSidebar({ pathname, user, onLogout }) {
  return (
    <aside
      className="relative w-64 h-screen flex flex-col sticky top-0 shrink-0 overflow-hidden
                 bg-linear-to-b from-emerald-900 via-emerald-950 to-emerald-900
                 text-white"
    >
      {/* ══════════════════════════════════════════════════
          DECORATIVE SHAPES (circle-аас өөр)
          ══════════════════════════════════════════════════ */}

      {/* Том diamond (rotate-45 square) — дээд баруун */}
      <div
        aria-hidden
        className="absolute -top-16 -right-16 w-56 h-56 rotate-45
                   bg-emerald-400/10 blur-2xl pointer-events-none"
      />

      {/* Жижиг diamond accent — top-left */}
      <div
        aria-hidden
        className="absolute top-24 -left-6 w-12 h-12 rotate-45
                   border border-emerald-300/30 pointer-events-none"
      />

      {/* SVG Hexagon — доод зүүн */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="absolute -bottom-10 -left-10 w-44 h-44 text-emerald-400/15
                   pointer-events-none"
        fill="currentColor"
      >
        <polygon points="50,2 95,27 95,75 50,98 5,75 5,27" />
      </svg>

      {/* SVG Triangle — middle-right */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="absolute top-1/2 -right-8 w-24 h-24 rotate-12
                   text-emerald-300/10 pointer-events-none"
        fill="currentColor"
      >
        <polygon points="50,5 95,90 5,90" />
      </svg>

      {/* Diagonal stripe band */}
      <div
        aria-hidden
        className="absolute top-1/3 -left-10 right-0 h-24
                   bg-linear-to-r from-emerald-400/5 via-emerald-300/10 to-transparent
                   -rotate-12 pointer-events-none"
      />

      {/* Dotted grid pattern (radial-gradient — DOM-д жижигхэн боловч density сайн) */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      {/* Жижиг plus accents */}
      <div aria-hidden className="absolute top-44 right-6 text-emerald-300/30 text-xl font-bold pointer-events-none">+</div>
      <div aria-hidden className="absolute bottom-44 right-10 text-emerald-300/20 text-2xl font-bold pointer-events-none">+</div>

      {/* ══════════════════════════════════════════════════
          CONTENT (decoration-ийн дээр)
          ══════════════════════════════════════════════════ */}
      <div className="relative z-10 flex flex-col h-full">

        {/* ── Header / brand ─────────────────────────── */}
        <div className="px-6 py-5 border-b border-emerald-400/15">
          <div className="flex items-center gap-2.5">
            {/* Лого — rotated square + emerald accent */}
            <div className="relative w-8 h-8 shrink-0">
              <div className="absolute inset-0 rotate-45 bg-linear-to-br from-emerald-300 to-emerald-500" />
              <div className="absolute inset-1.5 rotate-45 bg-emerald-900 flex items-center justify-center">
                <span className="-rotate-45 text-emerald-300 font-bold text-[11px]">М</span>
              </div>
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-bold text-base m-0 leading-tight truncate">
                МалчныГэрээ
              </h1>
              <p className="text-emerald-300/70 text-[10px] tracking-widest uppercase mt-0.5 m-0">
                Admin · v2.0
              </p>
            </div>
          </div>
        </div>

        {/* ── User card ──────────────────────────────── */}
        <div className="px-4 py-4 border-b border-emerald-400/15">
          <div className="flex items-center gap-3 px-3 py-2.5
                          bg-emerald-400/10 backdrop-blur-sm
                          border border-emerald-300/15">
            <div className="w-9 h-9 bg-linear-to-br from-emerald-300 to-emerald-500
                            text-emerald-950 flex items-center justify-center
                            font-bold text-sm shrink-0 rotate-45">
              <span className="-rotate-45">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </span>
            </div>
            <div className="overflow-hidden min-w-0">
              <p className="text-white text-sm font-medium truncate m-0">
                {user?.last_name} {user?.first_name}
              </p>
              <p className="text-emerald-300/70 text-[10px] uppercase tracking-wide m-0">
                Админ
              </p>
            </div>
          </div>
        </div>

        {/* ── Nav ────────────────────────────────────── */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto no-scrollbar">
          <p className="text-emerald-300/50 text-[10px] uppercase tracking-widest
                        font-semibold px-3 mb-2">
            Цэс
          </p>

          {ADMIN_NAV.map((item) => {
            const active = pathname === item.href ||
                           (item.href !== '/admin' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 px-3 py-2.5 text-sm
                            transition-all
                            ${active
                              ? 'bg-emerald-400 text-emerald-950 font-semibold shadow-md shadow-emerald-900/40'
                              : 'text-emerald-100/80 hover:bg-emerald-400/10 hover:text-white'}`}
              >
                {/* Active indicator — left bar (diamond) */}
                {active && (
                  <span aria-hidden
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1
                                   w-2 h-2 rotate-45 bg-emerald-300" />
                )}
                <span className="text-base shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* ── Logout ─────────────────────────────────── */}
        <div className="px-3 pb-5 pt-2 border-t border-emerald-400/15">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5
                       text-sm text-emerald-200/70 hover:text-white
                       hover:bg-red-500/20 transition-all
                       cursor-pointer bg-transparent border border-emerald-400/15
                       hover:border-red-400/40 text-left"
          >
            <span className="text-base">↩</span>
            Гарах
          </button>
        </div>
      </div>
    </aside>
  )
}
