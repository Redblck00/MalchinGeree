import { NextResponse } from 'next/server'

// Нэвтэрсэн хэрэглэгч орж болохгүй
const AUTH_ROUTES = ['/login', '/register']

// Зөвхөн нэвтэрсэн хэрэглэгч
const PROTECTED_ROUTES = ['/dashboard', '/contracts']

// Зөвхөн ADMIN
const ADMIN_ROUTES = ['/admin']

// Бүгд харж болно — нэвтрэхгүй ч болно
// /templates, /, /invite/*  → public

export function proxy(request) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('token')?.value

  // /invite — урилгын линк PUBLIC (нэвтэрсэн ч, эс нэвтэрсэн ч орох).
  // Token нь URL fragment-д (#token=...) ирдэг — fragment server-д явдаггүй
  // тул pathname зөвхөн "/invite" гэж ирнэ.
  if (pathname === '/invite' || pathname.startsWith('/invite/')) {
    return NextResponse.next()
  }

  // /verify/* — гэрээ баталгаажуулах PUBLIC (QR scan-аас орох)
  if (pathname.startsWith('/verify/')) {
    return NextResponse.next()
  }

  // 1. Нэвтэрсэн хэрэглэгч login/register дээр орвол:
  //    - redirect параметртэй бол тэр хуудсанд (урилгын flow)
  //    - эс бол /dashboard руу
  if (AUTH_ROUTES.some(r => pathname.startsWith(r)) && token) {
    const redirect = request.nextUrl.searchParams.get('redirect')
    return NextResponse.redirect(new URL(redirect || '/dashboard', request.url))
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
