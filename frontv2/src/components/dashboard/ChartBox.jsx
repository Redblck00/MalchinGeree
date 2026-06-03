'use client'
import { useRef, useState, useLayoutEffect } from 'react'
import { ResponsiveContainer } from 'recharts'

// ResizeObserver-оор parent-ийн хэмжээг хэмжсэний дараа л Recharts-ыг
// mount хийнэ. Ингэснээр "width(-1) and height(-1)" warning гарахгүй.
export default function ChartBox({ children, className = 'h-52 sm:h-64 w-full' }) {
  const ref = useRef(null)
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setReady(true)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className={className}>
      {ready && (
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      )}
    </div>
  )
}
