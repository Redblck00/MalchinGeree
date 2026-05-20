import { NextResponse } from 'next/server'

// Нэвтэрсэн хэрэглэгч орж болохгүй
const AUTH_ROUTES = ['/login', '/register']

// Зөвхөн нэвтэрсэн хэрэглэгч
const PROTECTED_ROUTES = ['/dashboard', '/contracts']

// Зөвхөн ADMIN
const ADMIN_ROUTES = ['/admin']

// Бүгд харж болно — нэвтрэхгүй ч болно
// /templates, /          → public

export function middleware(request) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('token')?.value

  // 1. Нэвтэрсэн хэрэглэгч login/register → dashboard
  if (AUTH_ROUTES.some(r => pathname.startsWith(r)) && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // 2. Protected routes → token байхгүй бол login
  if (PROTECTED_ROUTES.some(r => pathname.startsWith(r)) && !token) {
    const url = new URL('/login', request.url)
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // 3. Admin routes → token байхгүй бол login
  if (ADMIN_ROUTES.some(r => pathname.startsWith(r)) && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 4. /templates → PUBLIC — шалгахгүй
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icons|images|uploads).*)'],
}