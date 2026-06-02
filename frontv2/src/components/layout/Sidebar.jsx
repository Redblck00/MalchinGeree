'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import useAuthStore from '@/app/store/authStore'
import {
  LayoutDashboard, User, FileText, Send, Inbox, Clock, Archive,
  Bookmark, MessageSquare, LogOut, ChevronsLeft, ChevronsRight,
  Menu, X,
} from 'lucide-react'

// Sidebar collapsed/expanded төлвийн localStorage түлхүүр
const STORAGE_KEY = 'mg.sidebar.collapsed'

const ADMIN_NAV = [
  { href: '/admin',                 label: 'Dashboard',  icon: '⊞' },
  { href: '/admin/templates',       label: 'Templates',  icon: '📝' },
  { href: '/admin/users',           label: 'Хэрэглэгчид',icon: '👥' },
  { href: '/admin/contracts',       label: 'Гэрээнүүд',  icon: '📄' },
  { href: '/admin/reports/visits',  label: 'Зочдын тайлан', icon: '📊' },
  { href: '/admin/logs',            label: 'Лог',        icon: '📋' },
]

// ══════════════════════════════════════════════════════════════
// Sidebar router — ADMIN бол AdminSidebar (өөрчлөгдөөгүй),
// бусад тохиолдолд шинэ UserSidebar
// ══════════════════════════════════════════════════════════════
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

  return (
    <UserSidebar
      pathname={pathname}
      searchParams={searchParams}
      user={user}
      onLogout={handleLogout}
    />
  )
}

// ══════════════════════════════════════════════════════════════
// USER SIDEBAR — Linear/Vercel/Notion стиль
//
// • Цайвар цагаан фон, 1px border (no shadow, no gradient)
// • Emerald-600 зөвхөн active state + brand mark-д accent
// • rounded-md (4px) — large rounded байхгүй
// • Group label: uppercase tracking-widest text-gray-400
// • Collapsed mode (64px): icon-only + title attribute tooltip
// • Persisted via localStorage
// ══════════════════════════════════════════════════════════════
function UserSidebar({ pathname, searchParams, user, onLogout }) {
  const [collapsed,  setCollapsed]  = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'true') setCollapsed(true)
    } catch (_) { /* private-mode: localStorage хааж байх боломжтой */ }
  }, [])

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(STORAGE_KEY, String(next)) } catch (_) {}
  }

  // Pathname солигдох үед mobile drawer автомат хаагдана
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // ESC дарж мобайл drawer хаах + body scroll lock
  useEffect(() => {
    if (!mobileOpen) return
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') setMobileOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [mobileOpen])

  const filter          = searchParams.get('filter')
  const isContractsBase = pathname === '/dashboard/contracts'
  const isFilter        = (f) => isContractsBase && filter === f
  const isContractsRoot = isContractsBase && !filter

  const fullName = user
    ? `${user.last_name || ''} ${user.first_name || ''}`.trim()
    : ''
  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : ''

  return (
    <>
      {/* ── Mobile hamburger (< lg) ────────────────────
          Drawer хаагдсан үед л харагдана. Бусад page-аас өмнөх z-index биш */}
      {!mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Цэс нээх"
          className="lg:hidden fixed top-3 left-3 z-30 w-10 h-10 rounded-md
                     bg-white border border-gray-200 shadow-sm
                     inline-flex items-center justify-center
                     text-gray-700 hover:bg-gray-50 cursor-pointer"
        >
          <Menu size={20} />
        </button>
      )}

      {/* ── Backdrop (mobile-only) ─────────────────── */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          aria-hidden
        />
      )}

      <aside
        className={`
          flex flex-col border-r border-gray-200
          transition-transform duration-200 ease-out

          lg:sticky lg:top-0 lg:shrink-0 lg:h-screen lg:translate-x-0
          ${collapsed ? 'lg:w-16' : 'lg:w-60'}

          fixed top-0 left-0 bottom-0 z-50 lg:z-auto w-72 max-w-[85vw]
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          // Зүүн доод буланд бүүдгэр teal цэвэрлэгээ — цайвар цагаан фоны
          // дунд "уусаж" харагдана.
          background:
            'radial-gradient(circle at 0% 100%, rgba(94, 234, 212, 0.5) 0%, transparent 55%), #ffffff',
        }}
        aria-label="Үндсэн цэс"
      >
      {/* ── Brand header ────────────────────────────── */}
      <div className="h-16 px-3 flex items-center justify-between border-b border-gray-100 shrink-0">
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-md bg-emerald-600 flex items-center justify-center shrink-0">
            <Image src="/systemIcon.png" alt="" width={18} height={18}
                   className="object-contain" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-gray-900 truncate">
              МалчныГэрээ
            </span>
          )}
        </Link>
        {!collapsed && (
          <CollapseButton onClick={toggle} icon={<ChevronsLeft size={16} />} label="Хумих" />
        )}
      </div>

      {/* ── Collapsed: expand товч ──────────────────── */}
      {collapsed && (
        <div className="px-1.5 py-2 border-b border-gray-100">
          <CollapseButton
            onClick={toggle}
            icon={<ChevronsRight size={16} />}
            label="Сунгах"
            wide
          />
        </div>
      )}

      {/* ── Nav ─────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-2 py-3 flex flex-col gap-5">
        <NavGroup label="Үндсэн" collapsed={collapsed}>
          <NavItem icon={LayoutDashboard} href="/dashboard" collapsed={collapsed}
                   active={pathname === '/dashboard'}>
            Хяналтын самбар
          </NavItem>
          <NavItem icon={User} href="/dashboard/profile" collapsed={collapsed}
                   active={pathname.startsWith('/dashboard/profile') ||
                           pathname.startsWith('/dashboard/signature')}>
            Профайл
          </NavItem>
        </NavGroup>

        <NavGroup label="Ажлын урсгал" collapsed={collapsed}>
          <NavItem icon={FileText} href="/dashboard/contracts" collapsed={collapsed}
                   active={isContractsRoot}>
            Гэрээ
          </NavItem>
          {/* Sub-filter — зөвхөн expanded mode-д. Collapsed-д бол хэрэглэгч
              үндсэн "Гэрээ" холбоосоор ороод доторх tab-аас шүүж сонгоно. */}
          {!collapsed && (
            <div className="ml-3 mt-0.5 mb-1 pl-3 border-l border-gray-100 flex flex-col gap-0.5">
              <SubNavItem icon={Send}    href="/dashboard/contracts?filter=sent"
                          active={isFilter('sent')}>Илгээсэн</SubNavItem>
              <SubNavItem icon={Inbox}   href="/dashboard/contracts?filter=inbox"
                          active={isFilter('inbox')}>Ирсэн</SubNavItem>
              <SubNavItem icon={Clock}   href="/dashboard/contracts?filter=waiting"
                          active={isFilter('waiting')}>Хүлээгдэж буй</SubNavItem>
              <SubNavItem icon={Archive} href="/dashboard/contracts?filter=closed"
                          active={isFilter('closed')}>Хаагдсан</SubNavItem>
            </div>
          )}
          <NavItem icon={Bookmark} href="/dashboard/templates" collapsed={collapsed}
                   active={pathname.startsWith('/dashboard/templates')}>
            Загвар
          </NavItem>
        </NavGroup>

        <NavGroup label="Хэрэгсэл" collapsed={collapsed}>
          <NavItem icon={MessageSquare} href="#" collapsed={collapsed}>
            Санал хүсэлт
          </NavItem>
        </NavGroup>
      </nav>

      {/* ── Profile footer ──────────────────────────── */}
      <div className="border-t border-gray-100 p-2 shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-1.5">
            <Link
              href="/dashboard/profile"
              className="flex items-center gap-2.5 flex-1 min-w-0 rounded-md
                         hover:bg-gray-50 transition-colors px-1.5 py-1"
            >
              <div className="w-9 h-9 rounded-full bg-emerald-600 text-white
                              flex items-center justify-center font-semibold text-xs uppercase shrink-0">
                {initials || <User size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 m-0 truncate">
                  {fullName || 'Хэрэглэгч'}
                </p>
                <p className="text-xs text-gray-500 m-0 truncate">
                  {user?.email || user?.phone || ''}
                </p>
              </div>
            </Link>
            <button
              onClick={onLogout}
              aria-label="Гарах"
              title="Гарах"
              className="w-8 h-8 rounded-md inline-flex items-center justify-center
                         text-gray-400 hover:text-red-600 hover:bg-red-50
                         cursor-pointer border-0 bg-transparent transition-colors shrink-0"
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-1">
            <Link
              href="/dashboard/profile"
              aria-label={fullName || 'Профайл'}
              title={fullName || 'Профайл'}
              className="w-9 h-9 rounded-full bg-emerald-600 text-white
                         flex items-center justify-center font-semibold text-xs uppercase
                         hover:ring-2 hover:ring-emerald-200 transition-shadow"
            >
              {initials || <User size={16} />}
            </Link>
            <button
              onClick={onLogout}
              aria-label="Гарах"
              title="Гарах"
              className="w-8 h-8 rounded-md inline-flex items-center justify-center
                         text-gray-400 hover:text-red-600 hover:bg-red-50
                         cursor-pointer border-0 bg-transparent transition-colors"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </aside>
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// Reusable atoms (UserSidebar-д л ашиглагдана)
// ══════════════════════════════════════════════════════════════
function CollapseButton({ onClick, icon, label, wide = false }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`${wide ? 'w-full h-8' : 'w-7 h-7'} rounded-md inline-flex items-center justify-center
                  text-gray-400 hover:text-gray-700 hover:bg-gray-100
                  cursor-pointer border-0 bg-transparent transition-colors`}
    >
      {icon}
    </button>
  )
}

function NavGroup({ label, collapsed, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      {!collapsed && label && (
        <p className="px-3 text-[10px] font-semibold uppercase tracking-widest
                      text-gray-400 mb-1 m-0">
          {label}
        </p>
      )}
      {children}
    </div>
  )
}

function NavItem({ icon: Icon, href, active, collapsed, children }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      title={collapsed && typeof children === 'string' ? children : undefined}
      className={`relative flex items-center gap-2.5 h-9 rounded-md text-sm font-medium
                  transition-colors
                  ${collapsed ? 'justify-center px-0' : 'px-3'}
                  ${active
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
    >
      {/* Active accent — зүүн талын жижиг bar (зөвхөн expanded mode-д) */}
      {active && !collapsed && (
        <span aria-hidden
              className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-sm bg-emerald-600" />
      )}
      <Icon size={18} className="shrink-0" strokeWidth={active ? 2.25 : 1.75} />
      {!collapsed && <span className="truncate">{children}</span>}
    </Link>
  )
}

function SubNavItem({ icon: Icon, href, active, children }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2 h-8 px-2 rounded-md text-[13px]
                  transition-colors
                  ${active
                    ? 'bg-emerald-50 text-emerald-700 font-medium'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
    >
      <Icon size={13} className="shrink-0" />
      <span className="truncate">{children}</span>
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
