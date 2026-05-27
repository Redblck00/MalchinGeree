'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import useAuthStore from '@/app/store/authStore'
import NotificationDropdown from '@/components/layout/NotificationDropdown'
import { FiUser, FiLogOut, FiEdit3, FiGrid } from 'react-icons/fi'

// Нэвтрээгүй үед харагдах link-үүд
const PUBLIC_LINKS = [
  { href: '/',          label: 'Нүүр' },
  { href: '/templates', label: 'Загварууд' },
]

// Нэвтэрсэн хэрэглэгчид харагдах link-үүд
const USER_LINKS = [
  { href: '/templates',           label: 'Гэрээний загвар' },
  { href: '/dashboard/contracts', label: 'Гэрээ' },
]

export default function Navbar() {
  const router   = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, restoreAuth, logout } = useAuthStore()

  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => { restoreAuth() }, [restoreAuth])

  // Scroll → backdrop blur ON / OFF
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Click outside → close dropdown
  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  const handleLogout = () => {
    logout()
    setMenuOpen(false)
    router.push('/')
  }

  // Hero-той хуудаснуудад navbar анх transparent байна; бусад хуудсанд эсвэл
  // scroll хийсэний дараа цайвар фон + blur (frosted glass) болно.
  const hasHero = pathname === '/' || pathname === '/templates'
  const transparent = hasHero && !scrolled

  const navClass = transparent
    ? 'bg-transparent'
    : 'bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm'

  const textBase = transparent ? 'text-white' : 'text-gray-800'

  const navLinks = isAuthenticated ? USER_LINKS : PUBLIC_LINKS
  const fullName = user
    ? `${user.last_name || ''} ${user.first_name || ''}`.trim()
    : ''
  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`
    : ''

  return (
    <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${navClass}`}>
      <div className="max-w-7xl mx-auto px-6 py-3 grid grid-cols-3 items-center">

        {/* ── ЗҮҮН: Лого ────────────────────────────── */}
        <Link href="/" className="flex items-center gap-2.5 w-fit">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center p-1
                           transition-colors ${
                             transparent
                               ? 'bg-white/20 border border-white/40 backdrop-blur-sm'
                               : 'bg-linear-to-br from-emerald-400 to-emerald-700'
                           }`}>
            <Image
              src="/systemIcon.png"
              alt="МалчныГэрээ"
              width={28}
              height={28}
              className="object-contain"
            />
          </div>
          <span className={`text-lg font-bold tracking-wide ${textBase}`}>
            МалчныГэрээ
          </span>
        </Link>

        {/* ── ДУНД: Navigation ──────────────────────── */}
        <nav className="flex items-center justify-center gap-1">
          {navLinks.map((link) => {
            const active = link.href === '/'
              ? pathname === '/'
              : pathname === link.href || pathname.startsWith(link.href + '/')
            const linkClass = active
              ? transparent
                ? 'bg-white/20 text-white border border-white/30'
                : 'bg-emerald-50 text-emerald-700'
              : transparent
                ? 'text-white/90 hover:bg-white/10'
                : 'text-gray-700 hover:bg-gray-100'
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${linkClass}`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* ── БАРУУН: Auth / Profile ───────────────── */}
        <div className="flex items-center justify-end gap-3">
          {isAuthenticated ? (
            <>
              {/* Notification dropdown — overlay */}
              <NotificationDropdown transparent={transparent} />

              {/* User profile dropdown */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  className={`flex items-center gap-2 pl-1 pr-2 py-1 rounded-full
                              cursor-pointer border-0 transition-colors ${
                                transparent ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-50 hover:bg-gray-100'
                              }`}
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white
                                  flex items-center justify-center font-semibold text-xs uppercase">
                    {initials || '👤'}
                  </div>
                  <span className={`text-sm font-medium hidden md:block ${textBase}`}>
                    {user?.first_name || 'User'}
                  </span>
                </button>

                {/* Dropdown */}
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-lg
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
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                transparent
                  ? 'bg-white/20 text-white border border-white/40 backdrop-blur-sm hover:bg-white/30'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              Нэвтрэх
            </Link>
          )}
        </div>
      </div>
    </header>
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
