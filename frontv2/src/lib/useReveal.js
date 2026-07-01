'use client'
import { useEffect, useRef } from 'react'

// ── Scroll reveal hook ────────────────────────────────
// Элемент дэлгэцэнд орж ирэхэд fade + дээш гарах анимэйшн хийнэ.
// Ашиглах:
//   const ref = useReveal()
//   <div ref={ref} className="opacity-0 translate-y-8 transition-all duration-700" />
export default function useReveal() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('opacity-100', 'translate-y-0')
          el.classList.remove('opacity-0', 'translate-y-8')
          observer.disconnect()
        }
      },
      { threshold: 0.12 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return ref
}
