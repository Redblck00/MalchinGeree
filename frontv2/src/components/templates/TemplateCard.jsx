'use client'

// ══════════════════════════════════════════════════════════════
// TemplateCard — нэгдсэн minimal design (public + dashboard хоёрт ижил)
//
// Figma хэмжээ: 210 × 289 px (w-52.5) — A4 ойролцоо ratio.
// w-full биш: flex-wrap-д бүх мөрийн өргөнийг эзэлнэ. max-w-52.5 + grid cell-д зөв масштаблагдана.
// • Background image байхгүй — цэвэр цагаан
// • Document mock дээд хэсэгт (контентын line preview)
// • Footer-т name + description (rose-50 цайвар bg)
// • Карт click → onClick (preview modal)
// • "Ашиглах" товч энд байхгүй — preview modal-д байна
// ══════════════════════════════════════════════════════════════
export default function TemplateCard({ template, onClick }) {
  return (
    <article
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      className="w-52.5 max-w-full aspect-[210/289] shrink-0 justify-self-center
                 bg-white border border-gray-200 rounded-md
                 flex flex-col overflow-hidden cursor-pointer
                 hover:border-[#3d3a8c]/40 hover:shadow-md
                 focus:outline-none focus:ring-2 focus:ring-[#3d3a8c]/30
                 transition-all"
    >
      {/* Document preview mock — text lines */}
      <div className="flex-1 px-4 pt-5 pb-3 overflow-hidden">
        {/* Title bar */}
        <div className="h-2 bg-gray-300 rounded-sm w-1/3 mb-4" />
        {/* Body lines */}
        <div className="space-y-1.5">
          {[100, 100, 60, 100, 100, 75, 100, 100, 100, 50, 100, 90].map((w, i) => (
            <div
              key={i}
              className="h-1.5 bg-gray-100 rounded-sm"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      </div>

      {/* Footer — name + description */}
      <footer className="shrink-0 bg-rose-50/70 border-t border-gray-100 px-4 py-2.5">
        <p className="text-sm font-semibold text-gray-900 m-0 truncate">
          {template.name}
        </p>
        <p className="text-[11px] text-gray-500 m-0 mt-0.5 line-clamp-2 leading-snug">
          {template.description || 'Гэрээний загвар'}
        </p>
      </footer>
    </article>
  )
}
