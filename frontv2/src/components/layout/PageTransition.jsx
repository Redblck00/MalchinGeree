'use client'
import { usePathname } from 'next/navigation'

// ══════════════════════════════════════════════════════════════
// PageTransition — Dashboard nav-аар хуудас солих үед slide-in-right
//
// Next.js App Router-д layout нь persistent (sidebar re-mount хийгдэхгүй),
// харин children хэсэг солигдоно. Энд `key={pathname}` тавьсанаар React
// inner DOM-ыг шинээр mount хийж slide-in-right animation дахин run хийнэ.
//
// CSS keyframes globals.css-д "slide-in-right" (260ms cubic-bezier).
// ══════════════════════════════════════════════════════════════
export default function PageTransition({ children }) {
  const pathname = usePathname()

  return (
    <div key={pathname} className="animate-slide-in-right">
      {children}
    </div>
  )
}
