'use client'
import { MdDescription, MdVerified } from 'react-icons/md'

// ══════════════════════════════════════════════════════════════
// TemplateCard — нэгдсэн minimal design (public + dashboard хоёрт ижил)
//
// Figma хэмжээ: 210 × 289 px (w-52.5) — A4 ойролцоо ratio.
// • Дээд талд emerald accent зураас + баримтын icon
// • Гарчиг ЖИНХЭНЭ текстээр (skeleton мэт харагдахаас сэргийлнэ)
// • is_standard үед "Стандарт" badge
// • Доор decorative document мөрүүд (faint, content мэт) + description
// • Карт click → onClick (preview modal)
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
      className="group w-52.5 max-w-full aspect-210/289 shrink-0 justify-self-center
                 bg-white border border-gray-200 rounded-xl
                 flex flex-col overflow-hidden cursor-pointer
                 hover:border-emerald-300 hover:shadow-lg hover:-translate-y-0.5
                 focus:outline-none focus:ring-2 focus:ring-emerald-400/40
                 transition-all duration-200"
    >
      {/* Accent strip */}
      <div className="h-1.5 shrink-0 bg-linear-to-r from-emerald-400 to-emerald-600" />

      {/* Document body */}
      <div className="flex-1 px-4 pt-4 pb-3 overflow-hidden relative">
        {/* Standard badge */}
        {template.is_standard && (
          <span className="absolute top-3.5 right-3.5 inline-flex items-center gap-0.5
                           bg-emerald-50 text-emerald-700 text-[9px] font-bold
                           uppercase tracking-wider px-1.5 py-0.5 rounded-full">
            <MdVerified size={10} /> Стандарт
          </span>
        )}

        {/* Document icon */}
        <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600
                        flex items-center justify-center mb-3">
          <MdDescription size={18} />
        </div>

        {/* Title — жинхэнэ текст */}
        <h3 className="text-sm font-bold text-gray-900 m-0 leading-snug line-clamp-2 mb-3">
          {template.name}
        </h3>

        {/* Decorative document lines (content мэт, faint) */}
        <div className="space-y-1.5" aria-hidden="true">
          {[100, 92, 78, 96, 64].map((w, i) => (
            <div
              key={i}
              className="h-1 bg-gray-100 rounded-full"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      </div>

      {/* Footer — description */}
      <footer className="shrink-0 border-t border-gray-100 px-4 py-2.5 bg-gray-50/60
                         group-hover:bg-emerald-50/50 transition-colors">
        <p className="text-[11px] text-gray-500 m-0 line-clamp-2 leading-snug">
          {template.description || 'Гэрээний загвар'}
        </p>
      </footer>
    </article>
  )
}
