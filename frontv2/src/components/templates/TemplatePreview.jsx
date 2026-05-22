'use client'
import { useEffect, useRef, useState } from 'react'
import { MdAdd, MdRemove, MdKeyboardArrowUp, MdKeyboardArrowDown } from 'react-icons/md'
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
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white  w-full shadow-2xl overflow-hidden flex flex-col relative"
        style={{ maxWidth: '1000px', height: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Close button ─────────────────────────────── */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-20 w-9 h-9 flex items-center justify-center
                     rounded-full bg-white/90 hover:bg-gray-100 text-gray-500
                     hover:text-gray-900 border-0 cursor-pointer shadow text-xl leading-none"
          aria-label="Хаах"
        >
          ×
        </button>

        {loading || !template ? (
          <div className="flex items-center justify-center flex-1">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-[#1e1b4b]
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
                className="flex-1 overflow-auto bg-gray-200/60 py-6 px-4 relative"
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
                              bg-gray-800 text-white text-sm shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="w-7 h-7 rounded bg-gray-600 hover:bg-gray-500
                               flex items-center justify-center border-0 cursor-pointer text-white
                               disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Өмнөх хуудас"
                  >
                    <MdKeyboardArrowUp size={16} />
                  </button>
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= pageCount}
                    className="w-7 h-7 rounded bg-gray-600 hover:bg-gray-500
                               flex items-center justify-center border-0 cursor-pointer text-white
                               disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Дараах хуудас"
                  >
                    <MdKeyboardArrowDown size={16} />
                  </button>
                  <span className="text-gray-300 text-xs ml-1 select-none">
                    Хуудас {currentPage}/{pageCount}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={zoomOut}
                    disabled={zoom <= ZOOM_LEVELS[0]}
                    className="w-7 h-7 rounded bg-gray-600 hover:bg-gray-500
                               flex items-center justify-center border-0 cursor-pointer text-white
                               disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Бууруулах"
                  >
                    <MdRemove size={14} />
                  </button>
                  <span className="text-gray-300 text-xs min-w-12 text-center select-none">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={zoomIn}
                    disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                    className="w-7 h-7 rounded bg-gray-600 hover:bg-gray-500
                               flex items-center justify-center border-0 cursor-pointer text-white
                               disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Томруулах"
                  >
                    <MdAdd size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* ── RIGHT — Info + action ─────────────────── */}
            <div className="flex flex-col justify-between px-10 py-10 bg-white"
                 style={{ width: '42%' }}>

              <div className="flex flex-col gap-6">
                {template.is_standard && (
                  <span className="w-fit px-3 py-1 bg-blue-50 text-blue-700
                                   text-xs font-medium rounded-full border border-blue-200">
                    Стандарт загвар
                  </span>
                )}

                <h2 className="text-3xl font-bold text-gray-900 leading-tight">
                  {template.name}
                </h2>

                <p className="text-gray-600 text-base leading-relaxed">
                  {template.description ||
                    'Энэ загварыг ашиглан цахим гэрээ үүсгэнэ үү.'}
                </p>

                {template.schema_json?.fields?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {template.schema_json.fields.slice(0, 5).map((f, i) => (
                      <span key={i}
                        className="px-2.5 py-1 bg-gray-100 text-gray-600
                                   text-xs rounded-lg font-mono">
                        {f.key}
                      </span>
                    ))}
                    {template.schema_json.fields.length > 5 && (
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-400
                                       text-xs rounded-lg">
                        +{template.schema_json.fields.length - 5}
                      </span>
                    )}
                  </div>
                )}

                <div className="text-xs text-gray-400">
                  Энэхүү загвар нь <strong className="text-gray-600">{pageCount}</strong> хуудастай.
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-8">
               
                <button
                  onClick={onClose}
                  className="w-full py-3 border border-gray-200 text-gray-600
                             text-sm rounded-xl hover:bg-gray-50
                             transition-colors cursor-pointer bg-white"
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
function A4Page({ pageIdx, pageCount, htmlContent, templateName }) {
  const translateY = -pageIdx * contentHeightPx

  return (
    <div
      className="tp-page bg-white shadow-lg rounded-sm"
      data-page-num={pageIdx + 1}
      style={{
        width:    `${PAGE_WIDTH_MM}mm`,
        height:   `${PAGE_HEIGHT_MM}mm`,
        padding:  `${PAD_TOP_MM}mm ${PAD_X_MM}mm ${PAD_BOTTOM_MM}mm ${PAD_X_MM}mm`,
        boxSizing: 'border-box',
        position: 'relative',
        ...CONTENT_STYLES,
      }}
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
