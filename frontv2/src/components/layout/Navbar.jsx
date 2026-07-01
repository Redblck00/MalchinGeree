'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import useAuthStore from '@/app/store/authStore'
import NotificationDropdown from '@/components/layout/NotificationDropdown'
import UserAvatar from '@/components/common/UserAvatar'
import {
  FiUser, FiLogOut, FiEdit3, FiGrid, FiMenu, FiX,
} from 'react-icons/fi'

// ══════════════════════════════════════════════════════════════
// Navbar — floating pill design (Figma)
//
// • Hero pages (/, /templates) дээр анх transparent: pills хөвж
//   эмеральд hero дээр давхарлана. Bg = bg-white/20 + backdrop-blur
// • Scroll эсвэл бусад хуудаст: outer header нь soft "бүдэг цагаан"
//   bg-white/75 + backdrop-blur-lg болж, дотоод pill-үүд outer
//   bg-тэй уусаж нэгдэнэ
// • Mobile (<md): logo + hamburger pill, center nav slide-out menu-д
// • Dashboard/Admin/Login/Register-д бүхэлдээ нуугдана
// ══════════════════════════════════════════════════════════════

const PUBLIC_LINKS = [
  { href: '/',          label: 'Нүүр' },
  { href: '/templates', label: 'Загварууд' },
  { href: '/law',       label: 'Хууль' },
]

const USER_LINKS = [
  { href: '/templates',           label: 'Гэрээний загвар' },
  { href: '/dashboard/contracts', label: 'Гэрээ' },
  { href: '/law',                 label: 'Хууль' },
]

// Hero pages-д navbar анх transparent (эмеральд градиент дээр давхарлана)
const HERO_PAGES = ['/', '/templates']

// Navbar бүрэн нуух route-ууд
const HIDDEN_PREFIXES = ['/dashboard', '/admin', '/login', '/register']

export default function Navbar() {
  const router   = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, restoreAuth, logout } = useAuthStore()

  const [scrolled,    setScrolled]    = useState(false)
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const profileRef = useRef(null)

  useEffect(() => { restoreAuth() }, [restoreAuth])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

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

  if (HIDDEN_PREFIXES.some(p => pathname?.startsWith(p))) return null

  const handleLogout = () => {
    logout()
    setMenuOpen(false)
    setMobileOpen(false)
    router.push('/')
  }

  const hasHero     = HERO_PAGES.includes(pathname)
  const transparent = hasHero && !scrolled

  // ── Outer header background ──────────────────────────
  // Transparent: бүүдгэрхэн ил, pills бүгд хөвдөг
  // Scrolled / non-hero: soft frosted white — "бүдэг цагаан"
  const headerBg = transparent
    ? 'bg-transparent'
    : 'bg-white/75 backdrop-blur-lg border-b border-gray-200/60 shadow-sm'

  // ── Pill background ─────────────────────────────────
  // Transparent үед floating pill bg харагдана.
  // Scrolled үед pill bg алга — outer white-тай уусана.


  const textBase = transparent ? 'text-white' : 'text-gray-800'

  const navLinks = isAuthenticated ? USER_LINKS : PUBLIC_LINKS
  const fullName = user
    ? `${user.last_name || ''} ${user.first_name || ''}`.trim()
    : ''

  const isActive = (href) =>
    href === '/' ? pathname === '/' : pathname === href || pathname?.startsWith(href + '/')

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${headerBg}`}
      >
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between gap-3 px-4 sm:px-6">

          {/* ── ЗҮҮН: Лого pill ──────────────────────────── */}
          <Link
            href="/"
            className={`inline-flex items-center gap-2 pl-1.5 pr-3 py-1 
                        transition-all shrink-0 `}
          >
            <div className="w-7 h-7 rounded-full bg-linear-to-br from-emerald-400 to-emerald-600
                            flex items-center justify-center shrink-0">
              <Image
                src="/systemIcon.png"
                alt="МалчныГэрээ"
                width={18}
                height={18}
                className="object-contain"
              />
            </div>
            <span className={`text-sm font-semibold tracking-tight ${textBase} hidden sm:inline`}>
              МалчныГэрээ
            </span>
          </Link>

          {/* ── ДУНД: Nav линкүүд (md+) — pill background-гүй ── */}
          <nav className="hidden md:flex items-center gap-0.5 px-1.5 py-1 rounded-full transition-all">
            {navLinks.map((link) => {
              const active = isActive(link.href)
              const linkClass = active
                ? transparent
                  ? 'bg-white/30 text-white'
                  : 'bg-emerald-50 text-emerald-700'
                : transparent
                  ? 'text-white/90 '
                  : 'text-gray-700 '
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${linkClass}`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

          {/* ── БАРУУН: Profile / Login pill + Mobile burger ── */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Desktop: profile / login */}
            <div className="hidden md:flex items-center gap-2">
              {isAuthenticated ? (
                <>
                  <NotificationDropdown transparent={transparent} />

                  <div className="relative" ref={profileRef}>
                    <button
                      onClick={() => setMenuOpen(o => !o)}
                      aria-expanded={menuOpen}
                      aria-haspopup="menu"
                      className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full
                                  cursor-pointer border-0 transition-all
                                  ${transparent
                                    ? ' backdrop-blur-md border border-white/30'
                                    : ''}`}
                    >
                      <UserAvatar
                        src={user?.profile_image_url}
                        name={fullName}
                        className="w-7 h-7 text-xs"
                      />
                      <span className={`text-sm font-medium hidden lg:inline ${textBase}`}>
                        {user?.first_name || 'User'}
                      </span>
                    </button>

                    {menuOpen && (
                      <div className="absolute right-0 mt-2 w-60 bg-white  shadow-lg
                                      border border-gray-100 py-2 z-50">
                        <div className="px-4 py-2.5 border-b border-gray-100">
                          <p className="text-sm font-semibold text-gray-900 m-0 truncate">{fullName}</p>
                          <p className="text-xs text-gray-500 truncate m-0">{user?.email || user?.phone}</p>
                        </div>
                        <DropdownItem href="/dashboard" icon={<FiGrid size={16} />} onClick={() => setMenuOpen(false)}>
                          Dashboard
                        </DropdownItem>
                        <DropdownItem href="/dashboard/profile" icon={<FiUser size={16} />} onClick={() => setMenuOpen(false)}>
                          Профайл
                        </DropdownItem>
                        <DropdownItem href="/dashboard/signature" icon={<FiEdit3 size={16} />} onClick={() => setMenuOpen(false)}>
                          Гарын үсэг
                        </DropdownItem>

                        {user?.user_type === 'ADMIN' && (
                          <>
                            <hr className="my-1 border-gray-100" />
                            <DropdownItem
                              href="/admin"
                              icon="⚙️"
                              className="text-purple-700 hover:bg-purple-50"
                              onClick={() => setMenuOpen(false)}>
                              Admin panel
                            </DropdownItem>
                          </>
                        )}

                        <hr className="my-1 border-gray-100" />
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600
                                     hover:bg-red-50 cursor-pointer border-0 bg-transparent text-left"
                        >
                          <FiLogOut size={16} />
                          Гарах
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <Link
                  href="/login"
                  className={`inline-flex items-center px-5 py-2 rounded-full text-sm font-semibold
                              transition-all
                              ${transparent
                                ? 'bg-white/20 backdrop-blur-md border border-white/30 text-white hover:bg-white/30'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'}`}
                >
                  Нэвтрэх
                </Link>
              )}
            </div>

            {/* Mobile burger (<md) */}
            <button
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Цэс"
              aria-expanded={mobileOpen}
              className={`md:hidden w-10 h-10 inline-flex items-center justify-center rounded-full
                          cursor-pointer border-0 transition-all
                          ${transparent
                            ? 'bg-white/20 backdrop-blur-md border border-white/30 text-white hover:bg-white/30'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {mobileOpen ? <FiX size={20} /> : <FiMenu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════
          MOBILE SLIDE-OUT MENU (өөрчлөгдөөгүй)
          ══════════════════════════════════════════════════ */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/40"
          onClick={() => setMobileOpen(false)}
          role="presentation"
        >
          <aside
            className="absolute right-0 top-0 bottom-0 w-72 max-w-[85vw]
                       bg-white shadow-2xl flex flex-col
                       animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100 shrink-0">
              <span className="text-base font-bold text-gray-900">Цэс</span>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Хаах"
                className="w-9 h-9 inline-flex items-center justify-center rounded-lg
                           bg-gray-100 hover:bg-gray-200 cursor-pointer border-0 text-gray-700"
              >
                <FiX size={18} />
              </button>
            </div>

            {isAuthenticated && (
              <div className="px-5 py-4 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    src={user?.profile_image_url}
                    name={fullName}
                    className="w-10 h-10 text-sm shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 m-0 truncate">{fullName}</p>
                    <p className="text-xs text-gray-500 m-0 truncate">{user?.email || user?.phone}</p>
                  </div>
                </div>
              </div>
            )}

            <nav className="flex-1 px-3 py-3 overflow-y-auto">
              {navLinks.map((link) => {
                const active = isActive(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center px-4 py-3 rounded-xl text-sm font-medium mb-1
                                transition-colors ${
                                  active
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'text-gray-700 hover:bg-gray-50'
                                }`}
                  >
                    {link.label}
                  </Link>
                )
              })}

              {isAuthenticated && (
                <>
                  <hr className="my-3 border-gray-100" />
                  <MobileLink href="/dashboard" icon={<FiGrid size={16} />} active={isActive('/dashboard')}>
                    Dashboard
                  </MobileLink>
                  <MobileLink href="/dashboard/profile" icon={<FiUser size={16} />} active={isActive('/dashboard/profile')}>
                    Профайл
                  </MobileLink>
                  <MobileLink href="/dashboard/signature" icon={<FiEdit3 size={16} />} active={isActive('/dashboard/signature')}>
                    Гарын үсэг
                  </MobileLink>
                  {user?.user_type === 'ADMIN' && (
                    <MobileLink href="/admin" icon="⚙️" active={isActive('/admin')}>
                      Admin panel
                    </MobileLink>
                  )}
                </>
              )}
            </nav>

            <div className="px-3 py-3 border-t border-gray-100 shrink-0">
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold
                             text-red-600 bg-red-50 hover:bg-red-100 rounded-xl
                             cursor-pointer border-0"
                >
                  <FiLogOut size={16} />
                  Гарах
                </button>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center justify-center px-4 py-3 text-sm font-semibold
                             text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                >
                  Нэвтрэх
                </Link>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}

function DropdownItem({ href, icon, children, className = '', onClick }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-2.5 px-4 py-2 text-sm transition-colors
                  ${className || 'text-gray-700 hover:bg-gray-50'}`}
    >
      <span className="w-4 inline-flex items-center justify-center">{icon}</span>
      {children}
    </Link>
  )
}

function MobileLink({ href, icon, children, active }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium mb-1
                  transition-colors ${
                    active
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
    >
      <span className="w-4 inline-flex items-center justify-center">{icon}</span>
      {children}
    </Link>
  )
}
