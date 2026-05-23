'use client'
import Image from 'next/image'
import { FiEye } from 'react-icons/fi'

// ── Template card (Figma-аас зохиосон) ───────────────────────
// • A4 (210:297) хэлбэртэй
// • cardBakcground.png — цаасан мэт фон
// • standart ribbon — зөвхөн is_standard загварт
// • Бодит файлын нэр: cardBakcground.png (public/ дотор typo-той)
// • Rounded хэрэглэхгүй — sharp corners (Figma-н дагуу)
export default function TemplateCard({ template, onPreview, onUse }) {
  return (
    <article
      className="group relative flex flex-col overflow-hidden
                 aspect-210/297 shadow-md hover:shadow-2xl
                 transition-all duration-300 hover:-translate-y-1
                 ring-1 ring-emerald-900/10 hover:ring-emerald-500/40"
    >
      {/* ── Paper background (image) ─────────────────────── */}
      <Image
        src="/cardBakcground.png"
        alt=""
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        className="object-cover -z-10 select-none pointer-events-none"
        aria-hidden
      />
      {/* Soft white overlay уншигдахуйцаар */}
      <div className="absolute inset-0 -z-10 bg-white/70" />

      {/* ── Standard ribbon ──────────────────────────────── */}
      {template.is_standard && (
        <div className="absolute top-0 right-0 z-10
                        bg-emerald-700 text-white
                        px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest
                        shadow-md">
          standart
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          BODY — "paper" content area
          ══════════════════════════════════════════════════ */}
      <div className="relative flex-1 flex flex-col px-5 pt-6 pb-3 min-h-0">

        {/* Document-like title block */}
        <header className="text-center mb-3 shrink-0">
          <h3 className="text-[13px] sm:text-sm font-extrabold text-gray-900
                         uppercase tracking-tight m-0 line-clamp-2 leading-snug">
            {template.name}
          </h3>
          {/* Дугаар + сар өдөр (Figma шиг) */}
          <div className="mt-2 flex items-center justify-between
                          text-[9px] text-gray-500 font-mono uppercase">
            <span>Дугаар</span>
            <span>сар / өдөр</span>
          </div>
          <div className="mt-1 h-px bg-gray-300" />
        </header>

        {/* Description preview — fades out при overflow */}
        <div className="relative flex-1 min-h-0">
          <p className="text-[10.5px] leading-[1.5] text-gray-700 m-0
                        line-clamp-[10] sm:line-clamp-[12]">
            {template.description || 'Гэрээний загвар. Энэхүү маягтыг ашиглан хэрэгцээт талуудын мэдээллийг бөглөн, цахим гэрээ үүсгэх боломжтой.'}
          </p>
          {/* Bottom fade — текстийн төгсгөл цаасан хэлбэрт уусна */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8
                          bg-linear-to-t from-white/85 to-transparent" />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          FOOTER — name/use | description/харах (Figma layout)
          ══════════════════════════════════════════════════ */}
      <footer className="relative shrink-0 border-t border-emerald-200/60
                         bg-emerald-50/80 backdrop-blur-sm">
        <div className="grid grid-cols-2 divide-x divide-emerald-200/60">

          {/* ── Left: "use" button ───────────────────────── */}
          <button
            onClick={onUse}
            className="flex flex-col items-center justify-center py-3
                       cursor-pointer bg-transparent border-0
                       transition-colors hover:bg-emerald-100/70 group/use"
          >
            <span className="text-[9px] uppercase tracking-widest
                             text-emerald-700/70 font-semibold">
              нэр
            </span>
            <span className="mt-0.5 text-sm font-bold text-emerald-700
                             group-hover/use:text-emerald-900 transition-colors">
              Ашиглах
            </span>
          </button>

          {/* ── Right: "харах" button ─────────────────────── */}
          <button
            onClick={onPreview}
            className="flex flex-col items-center justify-center py-3
                       cursor-pointer bg-transparent border-0
                       transition-colors hover:bg-emerald-100/70 group/view"
          >
            <span className="text-[9px] uppercase tracking-widest
                             text-emerald-700/70 font-semibold">
              description
            </span>
            <span className="mt-0.5 text-sm font-bold text-emerald-700
                             group-hover/view:text-emerald-900 transition-colors
                             inline-flex items-center gap-1">
              <FiEye size={14} />
              Харах
            </span>
          </button>
        </div>
      </footer>
    </article>
  )
}
