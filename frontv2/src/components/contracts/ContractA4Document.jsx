'use client'
import { useEffect, useMemo, useState } from 'react'
import { isImageAttachment } from '@/lib/pdfjs'


// ContractA4Document — Жинхэнэ element-level pagination + зургийн хавсралт
//
// АЛГОРИТМ:
//   1. Hidden measure div дотор бүх HTML-г рендер хийгээд
//   2. Мөр (line) бүрийн offsetHeight-г уншиж page-д багтаахаар бүлэглэх
//      (нэмж оруулбал overflow болох гэвэл шинэ page эхлүүлэх)
//   3. ЗУРГИЙН хавсралт — гэрээний ҮНДСЭН хэсэг бүрэн дууссаны ДАРАА шинэ
//      хуудаснаас, зураг бүр 1 хуудас, object-contain (харьцаа хадгална).
//
//   PDF / бусад файл хавсралт нь документэд НЭМЭГДЭХГҮЙ — хэрэглэгч sidebar
//   дахь "хавсралт харах" товчоор тусдаа нээж үзнэ (pdf.js-ийн удаашрал ба
//   Cloudinary-ийн PDF хүргэлтийн хязгаарлалтаас зайлсхийнэ).
//
// QR + гэрээний дугаар:
//   • ЗӨВХӨН гэрээний үндсэн агуулгын хамгийн сүүлийн хуудсанд.
//   • Хавсралт (зураг) хуудаснууд дээр QR / дугаар ХАРАГДАХГҮЙ.

const PAGE_WIDTH_MM     = 210
const PAGE_HEIGHT_MM    = 297
const PAD_TOP_MM        = 20
const PAD_X_MM          = 18
const FOOTER_HEIGHT_MM  = 22
const PAD_BOTTOM_MM     = FOOTER_HEIGHT_MM + 8
const CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - PAD_TOP_MM - PAD_BOTTOM_MM
const CONTENT_WIDTH_MM  = PAGE_WIDTH_MM - PAD_X_MM * 2

const MM_TO_PX = 3.7795275591  // 96dpi
const contentHeightPx = CONTENT_HEIGHT_MM * MM_TO_PX

// Хавсралтын content муж — header label-ийн дараах өндөр
const ATTACH_CONTENT_HEIGHT_MM = CONTENT_HEIGHT_MM - 10

// Page content-той ижил CSS style — measure div-д ашиглах
const SHARED_CONTENT_STYLES = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize:   '13px',
  lineHeight: '1.8',
  color:      '#111827',
  whiteSpace: 'pre-wrap',
}

// ── HTML-г line-түвшинд хуудаслах ─────────────────────
// rendered_content нь энгийн текст + \n + inline <img> хэлбэртэй учир
// мөр (line) бүрийг тус тусад нь хэмжиж page-д хувиарлана. Нэг мөр
// бүхэлдээ нэг хуудсанд орох тул текст/зураг дунд нь тасрахгүй.
function paginateHtmlIntoPages(htmlContent, maxPageHeightPx) {
  if (!htmlContent || typeof window === 'undefined') return [htmlContent || '']

  const lines = htmlContent.split(/\r?\n/)

  const measure = document.createElement('div')
  Object.assign(measure.style, {
    position: 'absolute',
    visibility: 'hidden',
    pointerEvents: 'none',
    left: '-9999px',
    top: '0',
    width: `${CONTENT_WIDTH_MM}mm`,
    ...SHARED_CONTENT_STYLES,
  })

  // Мөр бүрийг өөрийн div-ээр хүрээлж хэмжих
  // Хоосон мөрөнд line-height барих үүднээс &nbsp; оруулна
  measure.innerHTML = lines.map((line, i) => {
    const safeContent = line === '' ? '&nbsp;' : line
    return `<div data-line="${i}" style="margin:0;padding:0;white-space:pre-wrap;">${safeContent}</div>`
  }).join('')

  document.body.appendChild(measure)

  const divs = measure.querySelectorAll('[data-line]')
  const pages = [[]]
  let currentHeight = 0

  divs.forEach((div, i) => {
    const elH = div.offsetHeight
    if (elH <= 0) return

    // Pageийг хэтрэх гэж байвал шинэ page эхлүүлэх
    if (currentHeight + elH > maxPageHeightPx && currentHeight > 0) {
      pages.push([])
      currentHeight = 0
    }

    pages[pages.length - 1].push(lines[i])  // эх мөрийг хадгална
    currentHeight += elH
  })

  document.body.removeChild(measure)

  // Мөрүүдийг \n-ээр буцаан нэгтгэнэ — whiteSpace:pre-wrap-р зөв render хийгдэнэ
  return pages.map(p => p.join('\n'))
}

// ══════════════════════════════════════════════════════════════
export default function ContractA4Document({
  htmlContent,
  qrCodeUrl = null,
  contractNumber = '',
  brandName = 'Цахим Гэрээ',
  zoom = 1,
  attachments = [],          // [{ attachment_id, file_url, file_type, file_name }, ...]
  onPageCountChange = null,
}) {
  const [pagesHtml, setPagesHtml] = useState([])

  // ── Үндсэн агуулгыг хуудаслах ──
  // setState-ийг rAF callback дотор дуудна (effect body дотор синхроноор биш)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setPagesHtml(htmlContent ? paginateHtmlIntoPages(htmlContent, contentHeightPx) : [])
    })
    return () => cancelAnimationFrame(id)
  }, [htmlContent])

  // ── Хуудасны жагсаалт (descriptors) — үндсэн + ЗУРГИЙН хавсралт ──
  // PDF / бусад файл документэд орохгүй (sidebar-аас тусдаа харна).
  const descriptors = useMemo(() => {
    const out = []
    const mainCount = pagesHtml.length

    pagesHtml.forEach((html, i) => {
      out.push({
        key: `c-${i}`,
        kind: 'main',
        html,
        isLastMain: i === mainCount - 1,
      })
    })

    const images = attachments.filter(isImageAttachment)
    images.forEach((att, i) => {
      out.push({
        key: `img-${att.attachment_id ?? i}`,
        kind: 'image',
        att,
        attOrdinal: i + 1,
        attTotal: images.length,
      })
    })

    return out
  }, [pagesHtml, attachments])

  const totalPageCount = descriptors.length

  // ── Эцэг компонент руу нийт хуудасны тоог дамжуулах ──
  useEffect(() => {
    onPageCountChange?.(totalPageCount)
  }, [totalPageCount, onPageCountChange])

  if (totalPageCount === 0) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-[#3d3a8c]
                        rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-8">
      {descriptors.map((d, absoluteIdx) => (
        <ZoomedPage key={d.key} zoom={zoom}>
          {d.kind === 'main' ? (
            <PageView
              pageIndex={absoluteIdx}
              pageCount={totalPageCount}
              pageHtml={d.html}
              // QR + дугаар ЗӨВХӨН үндсэн агуулгын сүүлийн хуудсанд
              qrCodeUrl={d.isLastMain ? qrCodeUrl : null}
              contractNumber={d.isLastMain ? contractNumber : null}
              brandName={brandName}
            />
          ) : (
            <AttachmentPageView
              pageIndex={absoluteIdx}
              pageCount={totalPageCount}
              attachment={d.att}
              attachmentIndex={d.attOrdinal}
              attachmentTotal={d.attTotal}
              brandName={brandName}
            />
          )}
        </ZoomedPage>
      ))}
    </div>
  )
}

// ── Zoom wrapper ──────────────────────────────────────
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

function PageView({
  pageIndex,
  pageCount,
  pageHtml,
  qrCodeUrl,
  contractNumber,
  brandName,
}) {
  return (
    <div
      className="contract-page bg-white relative"
      data-page-num={pageIndex + 1}
      data-doc-kind="main"
      style={{
        width:  `${PAGE_WIDTH_MM}mm`,
        height: `${PAGE_HEIGHT_MM}mm`,
        padding: `${PAD_TOP_MM}mm ${PAD_X_MM}mm ${PAD_BOTTOM_MM}mm ${PAD_X_MM}mm`,
        boxSizing: 'border-box',
        // overflow:hidden АШИГЛАХГҮЙ — pagination нь мөр-түвшинд таарсан
        ...SHARED_CONTENT_STYLES,
      }}
    >
      {/* Энэ page-ийн өөрийн HTML chunk */}
      <div
        style={{ width: '100%' }}
        dangerouslySetInnerHTML={{ __html: pageHtml }}
      />

      {/* Footer — QR/дугаар зөвхөн дамжуулагдсан үед (= үндсэн сүүлийн хуудас) */}
      <PageFooter
        pageNum={pageIndex + 1}
        totalPages={pageCount}
        qrCodeUrl={qrCodeUrl}
        contractNumber={contractNumber}
        brandName={brandName}
      />
    </div>
  )
}

// ── Зургийн хавсралт ──────────────────────────────────
// Зураг бүр өөрийн A4 хуудсанд object-contain — харьцаа хадгална,
// нэг хуудсанд бүтнээрээ багтах тул дунд нь тасрахгүй. QR/дугааргүй.
function AttachmentPageView({
  pageIndex, pageCount, attachment,
  attachmentIndex, attachmentTotal, brandName,
}) {
  return (
    <div
      className="contract-page bg-white shadow-lg rounded-sm relative"
      data-page-num={pageIndex + 1}
      data-doc-kind="image"
      style={{
        width:  `${PAGE_WIDTH_MM}mm`,
        height: `${PAGE_HEIGHT_MM}mm`,
        padding: `${PAD_TOP_MM}mm ${PAD_X_MM}mm ${PAD_BOTTOM_MM}mm ${PAD_X_MM}mm`,
        boxSizing: 'border-box',
        ...SHARED_CONTENT_STYLES,
      }}
    >
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
        <span className="text-[10px] uppercase tracking-widest font-bold text-gray-500">
          ХАВСРАЛТ {attachmentIndex} / {attachmentTotal}
        </span>
        <span className="text-[10px] text-gray-400 truncate max-w-[50%]">
          {attachment.file_name}
        </span>
      </div>

      <div
        style={{
          width: '100%',
          height: `${ATTACH_CONTENT_HEIGHT_MM}mm`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <img
          src={attachment.file_url}
          alt={attachment.file_name}
          crossOrigin="anonymous"
          style={{
            maxWidth:  '100%',
            maxHeight: '100%',
            objectFit: 'contain',  // харьцаа хадгална, тасрахгүй
          }}
        />
      </div>

      <PageFooter
        pageNum={pageIndex + 1}
        totalPages={pageCount}
        qrCodeUrl={null}
        contractNumber={null}
        brandName={brandName}
      />
    </div>
  )
}

// ── Footer ────────────────────────────────────────────
// QR / дугаар нь qrCodeUrl эсвэл contractNumber дамжуулагдсан үед л гарна
// (= зөвхөн үндсэн агуулгын сүүлийн хуудас). Зураг хуудаснууд null дамжуулна.
function PageFooter({ pageNum, totalPages, qrCodeUrl, contractNumber }) {
  return (
    <div
      className="absolute left-0 right-0 bottom-0"
      style={{ height: `${FOOTER_HEIGHT_MM}mm` }}
    >
      <div
        className="absolute left-0 right-0 bottom-0 flex items-center justify-between"
        style={{
          padding: `0 ${PAD_X_MM}mm`,
          height:  `${FOOTER_HEIGHT_MM - 6}mm`,
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#1e1b4b] flex items-center justify-center
                          text-white text-[10px] font-bold">
            E
          </div>
        </div>

        {/* Page x of N */}
        <div className="text-[10px] tracking-widest text-gray-500 font-semibold">
          PAGE {pageNum} OF {totalPages}
        </div>

        {/* QR / дугаар — зөвхөн дамжуулагдсан үед (үндсэн сүүлийн хуудас) */}
        <div style={{ width: '53px', height: '53px' }}
             className="flex items-center justify-end">
          {qrCodeUrl ? (
            <img
              src={qrCodeUrl}
              alt="Verification QR"
              className="rounded"
              style={{ width: '53px', height: '53px' }}
            />
          ) : contractNumber ? (
            <span className="text-[8px] text-gray-400 font-mono">
              {contractNumber}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
