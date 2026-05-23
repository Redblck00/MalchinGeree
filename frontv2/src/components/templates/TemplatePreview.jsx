'use client'
import { useEffect, useRef, useState } from 'react'
import {
  MdAdd, MdRemove, MdKeyboardArrowUp, MdKeyboardArrowDown,
  MdClose, MdDescription, MdLayers, MdAutoAwesome,
} from 'react-icons/md'
import { renderChips } from '@/lib/templateRender'

// ── A4 хэмжээ ─────────────────────────────────────────
const PAGE_WIDTH_MM     = 210
const PAGE_HEIGHT_MM    = 297
const PAD_TOP_MM        = 20
const PAD_X_MM          = 18
const FOOTER_HEIGHT_MM  = 14
const PAD_BOTTOM_MM     = FOOTER_HEIGHT_MM + 4
const CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - PAD_TOP_MM - PAD_BOTTOM_MM
const CONTENT_WIDTH_MM  = PAGE_WIDTH_MM - PAD_X_MM * 2

const MM_TO_PX = 3.7795275591   // 96dpi
const contentHeightPx = CONTENT_HEIGHT_MM * MM_TO_PX

const ZOOM_LEVELS = [0.4, 0.5, 0.6, 0.75, 0.9, 1.0, 1.25, 1.5]

// Загвар текстэнд хэрэглэх CSS — measure div болон жинхэнэ render-т ижил
const CONTENT_STYLES = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize:   '12px',
  lineHeight: '1.8',
  color:      '#1a1a1a',
  whiteSpace: 'normal', 
  wordBreak:  'break-word',
}

export default function TemplatePreview({ template, onClose, loading, onUse }) {
  const [zoom,        setZoom]        = useState(0.6)
  const [pageCount,   setPageCount]   = useState(1)
  const [currentPage, setCurrentPage] = useState(1)

  const scrollRef  = useRef(null)
  const measureRef = useRef(null)

  const htmlContent = template ? renderChips(template.template_content) : ''

  // ── ESC дарж хаах ───────────────────────────────────
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  // ── Бүх агуулгын өндрийг хэмжээд хуудасны тоог тооцох
  useEffect(() => {
    if (!htmlContent || !measureRef.current) {
      setPageCount(1)
      return
    }
    const id = requestAnimationFrame(() => {
      const totalHeight = measureRef.current?.scrollHeight || 0
      const pages = Math.max(1, Math.ceil(totalHeight / contentHeightPx))
      setPageCount(pages)
    })
    return () => cancelAnimationFrame(id)
  }, [htmlContent])

  // ── Current page tracking (IntersectionObserver) ──
  useEffect(() => {
    if (!scrollRef.current) return
    const pages = scrollRef.current.querySelectorAll('.tp-page')
    if (pages.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        let best = null
        let bestRatio = 0
        entries.forEach(entry => {
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio
            best = entry.target
          }
        })
        if (best) {
          const n = parseInt(best.dataset.pageNum, 10)
          if (n) setCurrentPage(n)
        }
      },
      { root: scrollRef.current, threshold: [0, 0.25, 0.5, 0.75, 1] }
    )
    pages.forEach(p => observer.observe(p))
    return () => observer.disconnect()
  }, [pageCount, zoom])

  if (!template && !loading) return null

  // ── Zoom controls ──
  const zoomIn = () => {
    const i = ZOOM_LEVELS.findIndex(z => z >= zoom)
    if (i < ZOOM_LEVELS.length - 1) setZoom(ZOOM_LEVELS[i + 1])
  }
  const zoomOut = () => {
    const i = ZOOM_LEVELS.findIndex(z => z >= zoom)
    if (i > 0) setZoom(ZOOM_LEVELS[i - 1])
  }

  // ── Page navigation ──
  const goToPage = (n) => {
    const target = Math.min(Math.max(1, n), pageCount)
    scrollRef.current
      ?.querySelector(`[data-page-num="${target}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div
      className="fixed inset-0 bg-emerald-950/60 backdrop-blur-sm z-50
                 flex items-center justify-center p-4
                 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col relative
                   ring-1 ring-emerald-900/10"
        style={{ maxWidth: '1000px', height: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Close button ─────────────────────────────── */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-9 h-9 flex items-center justify-center
                     rounded-xl bg-white/90 hover:bg-emerald-50 text-gray-500
                     hover:text-emerald-700 border border-gray-200 hover:border-emerald-200
                     cursor-pointer shadow-sm transition-colors"
          aria-label="Хаах"
        >
          <MdClose size={20} />
        </button>

        {loading || !template ? (
          <div className="flex items-center justify-center flex-1">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-emerald-600
                            rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">

            {/* ── LEFT — A4 preview (inline pagination) ── */}
            <div className="flex flex-col bg-gray-100 border-r border-gray-200"
                 style={{ width: '58%' }}>

              {/* Scrollable workspace */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-auto bg-linear-to-br from-gray-200/60 to-gray-300/40
                           py-6 px-4 relative"
              >
                {/* Hidden measure div — бүх агуулгыг A4 өргөнтэй ижил хэмжээтэй
                    container-д рендер хийж scrollHeight уншина */}
                <div
                  ref={measureRef}
                  aria-hidden
                  style={{
                    position:     'absolute',
                    visibility:   'hidden',
                    pointerEvents: 'none',
                    left:         '-9999px',
                    top:          0,
                    width:        `${CONTENT_WIDTH_MM}mm`,
                    ...CONTENT_STYLES,
                  }}
                  dangerouslySetInnerHTML={{ __html: htmlContent }}
                />

                {/* A4 хуудаснууд — translateY-аар "ижил агуулгыг slice" хийнэ */}
                <div className="flex flex-col items-center gap-6">
                  {Array.from({ length: pageCount }).map((_, i) => (
                    <ZoomedPage key={i} zoom={zoom}>
                      <A4Page
                        pageIdx={i}
                        pageCount={pageCount}
                        htmlContent={htmlContent}
                        templateName={template.name || 'Загвар'}
                      />
                    </ZoomedPage>
                  ))}
                </div>
              </div>

              {/* Bottom toolbar — page nav + zoom */}
              <div className="flex items-center justify-between px-5 py-3
                              bg-linear-to-r from-emerald-900 to-emerald-950
                              text-white text-sm shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-emerald-400/30
                               flex items-center justify-center border-0 cursor-pointer text-white
                               disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Өмнөх хуудас"
                  >
                    <MdKeyboardArrowUp size={16} />
                  </button>
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= pageCount}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-emerald-400/30
                               flex items-center justify-center border-0 cursor-pointer text-white
                               disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Дараах хуудас"
                  >
                    <MdKeyboardArrowDown size={16} />
                  </button>
                  <span className="text-emerald-200/80 text-xs ml-2 select-none font-medium">
                    Хуудас {currentPage}/{pageCount}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={zoomOut}
                    disabled={zoom <= ZOOM_LEVELS[0]}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-emerald-400/30
                               flex items-center justify-center border-0 cursor-pointer text-white
                               disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Бууруулах"
                  >
                    <MdRemove size={14} />
                  </button>
                  <span className="text-emerald-200/80 text-xs min-w-12 text-center select-none font-medium">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={zoomIn}
                    disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-emerald-400/30
                               flex items-center justify-center border-0 cursor-pointer text-white
                               disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Томруулах"
                  >
                    <MdAdd size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* ── RIGHT — Info + action ─────────────────── */}
            <div className="relative flex flex-col px-8 py-8 bg-white overflow-hidden"
                 style={{ width: '42%' }}>

              {/* Subtle decorative blobs */}
              <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full
                              bg-emerald-50/80 pointer-events-none" />
              <div className="absolute -left-8 -bottom-12 w-32 h-32 rounded-full
                              bg-emerald-100/40 pointer-events-none" />

              <div className="relative flex flex-col gap-5 flex-1 overflow-y-auto pr-2 no-scrollbar">
                {/* Badge */}
                {template.is_standard ? (
                  <span className="w-fit inline-flex items-center gap-1.5
                                   px-3 py-1 bg-emerald-50 text-emerald-700
                                   text-xs font-semibold rounded-full
                                   border border-emerald-200 uppercase tracking-wide">
                    <MdAutoAwesome size={12} />
                    Стандарт загвар
                  </span>
                ) : (
                  <span className="w-fit inline-flex items-center gap-1.5
                                   px-3 py-1 bg-gray-100 text-gray-600
                                   text-xs font-semibold rounded-full
                                   border border-gray-200 uppercase tracking-wide">
                    Хувийн загвар
                  </span>
                )}

                {/* Title */}
                <h2 className="text-2xl lg:text-3xl font-extrabold text-gray-900 leading-tight m-0">
                  {template.name}
                </h2>

                {/* Description */}
                <p className="text-gray-600 text-sm leading-relaxed m-0">
                  {template.description ||
                    'Энэ загварыг ашиглан цахим гэрээ үүсгэнэ үү.'}
                </p>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="flex items-center gap-2 px-3 py-2.5
                                  bg-emerald-50/60 border border-emerald-100 rounded-xl">
                    <MdDescription className="text-emerald-700 shrink-0" size={18} />
                    <div className="min-w-0">
                      <p className="text-[10px] text-emerald-700/70 uppercase tracking-wide m-0 font-semibold">
                        Хуудас
                      </p>
                      <p className="text-sm font-bold text-emerald-900 m-0">{pageCount}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2.5
                                  bg-emerald-50/60 border border-emerald-100 rounded-xl">
                    <MdLayers className="text-emerald-700 shrink-0" size={18} />
                    <div className="min-w-0">
                      <p className="text-[10px] text-emerald-700/70 uppercase tracking-wide m-0 font-semibold">
                        Талбар
                      </p>
                      <p className="text-sm font-bold text-emerald-900 m-0">
                        {template.schema_json?.fields?.length || 0}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Fields chips */}
                {/* {template.schema_json?.fields?.length > 0 && (
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold m-0 mb-2">
                      Бөглөх талбарууд
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {template.schema_json.fields.slice(0, 8).map((f, i) => (
                        <span key={i}
                          className="px-2 py-0.5 bg-white border border-gray-200 text-gray-600
                                     text-[11px] rounded-md font-mono">
                          {f.key}
                        </span>
                      ))}
                      {template.schema_json.fields.length > 8 && (
                        <span className="px-2 py-0.5 bg-gray-50 border border-gray-200 text-gray-400
                                         text-[11px] rounded-md">
                          +{template.schema_json.fields.length - 8}
                        </span>
                      )}
                    </div>
                  </div>
                )} */}
              </div>

              {/* Footer action */}
              <div className="relative pt-4 mt-4 border-t border-gray-100">
                <button
                  onClick={onClose}
                  className="w-full py-3 px-4 text-sm font-semibold
                             text-gray-700 bg-white border border-gray-200
                             rounded-xl hover:bg-gray-50 hover:border-gray-300
                             transition-colors cursor-pointer"
                >
                  Хаах
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Zoom wrapper ─────────────────────────────────────
function ZoomedPage({ zoom, children }) {
  return (
    <div
      style={{
        width:  `${PAGE_WIDTH_MM * zoom}mm`,
        height: `${PAGE_HEIGHT_MM * zoom}mm`,
      }}
    >
      <div
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  )
}

// ── A4 хуудас — translateY-аар page-ийн slice харуулна ──
// Бүх HTML агуулгыг page бүрд render хийнэ, overflow:hidden-аар тухайн
// хэсгийг нь л үзүүлнэ. Энэ нь chip HTML-г таслахгүй (CSS leak гарахгүй).
//
// ── Хуулбарлахаас сэргийлэх ────────────────────────────
// • user-select: none — текст идэвхжүүлэх (highlight) болохгүй
// • onCopy / onCut    — Ctrl+C / Ctrl+X хааж preventDefault
// • onContextMenu     — баруун товчны "Copy" цэс хаагдсан
// • onDragStart       — drag-and-drop хуулбарлалт хаагдсан
// • Зөвхөн UI түвшинд — devtools-оос source-ийг харж болно, гэхдээ
//   ердийн хэрэглэгчийн copy-paste урсгал бүрэн хаагдана.
const noCopyHandlers = {
  onCopy:        (e) => e.preventDefault(),
  onCut:         (e) => e.preventDefault(),
  onContextMenu: (e) => e.preventDefault(),
  onDragStart:   (e) => e.preventDefault(),
}

function A4Page({ pageIdx, pageCount, htmlContent, templateName }) {
  const translateY = -pageIdx * contentHeightPx

  return (
    <div
      className="tp-page bg-white shadow-lg rounded-sm select-none"
      data-page-num={pageIdx + 1}
      style={{
        width:    `${PAGE_WIDTH_MM}mm`,
        height:   `${PAGE_HEIGHT_MM}mm`,
        padding:  `${PAD_TOP_MM}mm ${PAD_X_MM}mm ${PAD_BOTTOM_MM}mm ${PAD_X_MM}mm`,
        boxSizing: 'border-box',
        position: 'relative',
        userSelect:       'none',
        WebkitUserSelect: 'none',
        MozUserSelect:    'none',
        msUserSelect:     'none',
        ...CONTENT_STYLES,
      }}
      {...noCopyHandlers}
    >
      {/* Content slice — бүтэн HTML, зөвхөн тухайн page-ийн хэсгийг харуулна */}
      <div
        style={{
          width:    '100%',
          height:   `${CONTENT_HEIGHT_MM}mm`,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            transform: `translateY(${translateY}px)`,
            width: '100%',
          }}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />

        {/* Watermark — preview гэдгийг сануулсан, хуулбарлахад ч хальт орох */}
        <div
          aria-hidden
          style={{
            position:       'absolute',
            inset:          0,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            pointerEvents:  'none',
            transform:      'rotate(-30deg)',
            fontSize:       '72px',
            fontWeight:     900,
            letterSpacing:  '0.15em',
            color:          'rgba(16, 185, 129, 0.06)',  // emerald, маш сулхан
            textTransform:  'uppercase',
            userSelect:     'none',
          }}
        >
          ЗАГВАР · PREVIEW
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          position: 'absolute',
          left:     0,
          right:    0,
          bottom:   0,
          height:   `${FOOTER_HEIGHT_MM}mm`,
          padding:  `0 ${PAD_X_MM}mm`,
          display:  'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid #e5e7eb',
          fontSize: '9px',
          color:    '#9ca3af',
        }}
      >
        <span style={{ fontWeight: 600 }}>{templateName}</span>
        <span style={{ letterSpacing: '0.15em', fontWeight: 600 }}>
          PAGE {pageIdx + 1} OF {pageCount}
        </span>
      </div>
    </div>
  )
}
