'use client'

// ── AnalyticsPanel ─────────────────────────────────────
// Admin reports/visits-ийн Panel-ийг light theme-д адаптласан хувилбар.
// 4 буланд жижиг angle bracket-уудтай (analytics dashboard "control center" feel).
// font-mono header tracking-wider — admin-той ижил typography хэв маяг.
export default function AnalyticsPanel({ title, subtitle, action, children, className = '' }) {
  return (
    // min-w-0 — Recharts ResponsiveContainer grid item-д width(-1) bug-ыг засах
    <div className={`relative bg-white border border-emerald-200 p-4 sm:p-5 shadow-sm min-w-0 ${className}`}>
      {/* Corner marks — 4 буланд */}
      <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-emerald-500" />
      <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-emerald-500" />
      <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-emerald-500" />
      <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-emerald-500" />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 sm:mb-4 gap-3 sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-xs sm:text-sm font-bold text-emerald-900 m-0 font-mono uppercase tracking-wider">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[10px] sm:text-[11px] text-emerald-700/60 mt-0.5 m-0 leading-snug">{subtitle}</p>
          )}
        </div>
        {action && <div className="w-full sm:w-auto sm:max-w-[100%] shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  )
}
