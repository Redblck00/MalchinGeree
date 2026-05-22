'use client'
import { useEffect, useRef, useState } from 'react'


// ContractA4Document — Жинхэнэ element-level pagination
//
// АЛГОРИТМ:
//   1. Hidden measure div дотор бүх HTML-г рендер хийгээд
//   2. Top-level child element бүрийн offsetHeight-г уншиж
//   3. Page-ийн агуулгын өндөрт багтахаар elements-ийг бүлэглэх
//      (хэрэв нэмж оруулбал overflow болох гэвэл шинэ page эхлүүлэх)
//   4. Page бүр өөрийн HTML chunk-аа дүрсэлнэ — translateY/overflow:hidden ҮГҮЙ
//
// Энэ нь paragraph-ыг дунд нь таслахгүй, жинхэнэ Word/Google Docs шиг
// pagination хийнэ.

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
// мөр (line) бүрийг тус тусад нь хэмжиж page-д хувиарлана. Element.children
// нь text node-уудыг буцаадаггүй тул өмнөх element-түвшний арга бүтэлгүйтсэн.
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
  attachments = [],          // NEW: [{ file_url, file_type, file_name }, ...]
  onPageCountChange = null,
}) {
  const [pagesHtml, setPagesHtml] = useState([])

  // Pagination — htmlContent өөрчлөгдөх бүрд дахин хувиарлана
  useEffect(() => {
    if (!htmlContent) {
      setPagesHtml([])
      onPageCountChange?.(attachments.length)
      return
    }
    const id = requestAnimationFrame(() => {
      const pages = paginateHtmlIntoPages(htmlContent, contentHeightPx)
      setPagesHtml(pages)
      onPageCountChange?.(pages.length + attachments.length)
    })
    return () => cancelAnimationFrame(id)
  }, [htmlContent, attachments.length, onPageCountChange])

  if (pagesHtml.length === 0 && attachments.length === 0) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-[#3d3a8c]
                        rounded-full animate-spin" />
      </div>
    )
  }

  const contractPageCount = pagesHtml.length
  const totalPageCount    = contractPageCount + attachments.length
  // QR код нь сүүлийн ХАВСРАЛТЫН ЭСВЭЛ гэрээний хуудсанд харагдана:
  // attachments-гүй бол гэрээний сүүл, attachments-тэй бол сүүлийн attachment
  const qrOnContractLastPage = attachments.length === 0

  return (
    <div className="flex flex-col items-center gap-8">
      {/* ── Гэрээний хуудаснууд ── */}
      {pagesHtml.map((pageHtml, i) => (
        <ZoomedPage key={`c-${i}`} zoom={zoom}>
          <PageView
            pageIndex={i}
            pageCount={totalPageCount}
            pageHtml={pageHtml}
            qrCodeUrl={(qrOnContractLastPage && i === contractPageCount - 1) ? qrCodeUrl : null}
            contractNumber={contractNumber}
            brandName={brandName}
          />
        </ZoomedPage>
      ))}

      {/* ── Хавсралт хуудаснууд (гэрээний дараа) ── */}
      {attachments.map((att, i) => {
        const absoluteIdx = contractPageCount + i
        const isLastAttachment = i === attachments.length - 1
        return (
          <ZoomedPage key={`att-${att.attachment_id || i}`} zoom={zoom}>
            <AttachmentPageView
              pageIndex={absoluteIdx}
              pageCount={totalPageCount}
              attachment={att}
              attachmentIndex={i + 1}
              attachmentTotal={attachments.length}
              qrCodeUrl={isLastAttachment ? qrCodeUrl : null}
              contractNumber={contractNumber}
              brandName={brandName}
            />
          </ZoomedPage>
        )
      })}
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
  const isLast = pageIndex === pageCount - 1

  return (
    <div
      className="contract-page bg-white   relative"
      data-page-num={pageIndex + 1}
      style={{
        width:  `${PAGE_WIDTH_MM}mm`,
        height: `${PAGE_HEIGHT_MM}mm`,
        padding: `${PAD_TOP_MM}mm ${PAD_X_MM}mm ${PAD_BOTTOM_MM}mm ${PAD_X_MM}mm`,
        boxSizing: 'border-box',
        // overflow:hidden АШИГЛАХГҮЙ — pagination нь element-түвшинд таарсан
        ...SHARED_CONTENT_STYLES,
      }}
    >
      {/* Энэ page-ийн өөрийн HTML chunk */}
      <div
        style={{ width: '100%' }}
        dangerouslySetInnerHTML={{ __html: pageHtml }}
      />

      {/* Footer (absolute, доод хэсэгт) */}
      <PageFooter
        pageNum={pageIndex + 1}
        totalPages={pageCount}
        qrCodeUrl={qrCodeUrl}
        contractNumber={contractNumber}
        brandName={brandName}
        isLast={isLast}
      />
    </div>
  )
}

// ── Хавсралт хуудас ───────────────────────────────────
// Image → <img object-contain>, PDF → <iframe>, бусад → файл card
function AttachmentPageView({
  pageIndex, pageCount, attachment,
  attachmentIndex, attachmentTotal,
  qrCodeUrl, contractNumber, brandName,
}) {
  const isLast  = pageIndex === pageCount - 1
  const isImage = attachment.file_type?.startsWith('image/')
  const isPdf   = attachment.file_type === 'application/pdf'
                || attachment.file_url?.toLowerCase().endsWith('.pdf')

  return (
    <div
      className="contract-page bg-white shadow-lg rounded-sm relative"
      data-page-num={pageIndex + 1}
      data-attachment="true"
      style={{
        width:  `${PAGE_WIDTH_MM}mm`,
        height: `${PAGE_HEIGHT_MM}mm`,
        padding: `${PAD_TOP_MM}mm ${PAD_X_MM}mm ${PAD_BOTTOM_MM}mm ${PAD_X_MM}mm`,
        boxSizing: 'border-box',
        ...SHARED_CONTENT_STYLES,
      }}
    >
      {/* Header label — хавсралт N/M */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest font-bold text-gray-500">
            ХАВСРАЛТ {attachmentIndex} / {attachmentTotal}
          </span>
        </div>
        <span className="text-[10px] text-gray-400 truncate max-w-[50%]">
          {attachment.file_name}
        </span>
      </div>

      {/* Content — image / pdf / fallback */}
      <div
        style={{
          width: '100%',
          height: `${CONTENT_HEIGHT_MM - 10}mm`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {isImage ? (
          <img
            src={attachment.file_url}
            alt={attachment.file_name}
            style={{
              maxWidth:  '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
          />
        ) : isPdf ? (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <iframe
              src={`${attachment.file_url}#view=FitH&toolbar=1`}
              title={attachment.file_name}
              style={{
                width: '100%',
                height: '100%',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
              }}
            />
            <a
              href={attachment.file_url}
              target="_blank"
              rel="noopener"
              className="no-underline"
              style={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                padding: '4px 10px',
                background: 'rgba(61,58,140,0.95)',
                color: 'white',
                fontSize: 11,
                borderRadius: 6,
              }}
            >
              Шинэ цонхонд нээх
            </a>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center">
              <span className="text-3xl">📎</span>
            </div>
            <p className="text-sm font-semibold text-gray-700 m-0">{attachment.file_name}</p>
            <a
              href={attachment.file_url}
              target="_blank"
              rel="noopener"
              className="px-4 py-2 bg-[#3d3a8c] text-white rounded-lg text-xs
                         hover:bg-[#2d2a7c] no-underline"
            >
              Татах
            </a>
          </div>
        )}
      </div>

      <PageFooter
        pageNum={pageIndex + 1}
        totalPages={pageCount}
        qrCodeUrl={qrCodeUrl}
        contractNumber={contractNumber}
        brandName={brandName}
        isLast={isLast}
      />
    </div>
  )
}

// ── Footer ────────────────────────────────────────────
function PageFooter({ pageNum, totalPages, qrCodeUrl, contractNumber, brandName, isLast }) {
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

        {/* QR (зөвхөн сүүлийн хуудсанд) — Figma size 53×53 */}
        <div style={{ width: '53px', height: '53px' }}
             className="flex items-center justify-end">
          {isLast && qrCodeUrl ? (
            <img
              src={qrCodeUrl}
              alt="Verification QR"
              className="rounded"
              style={{ width: '53px', height: '53px' }}
            />
          ) : isLast && contractNumber ? (
            <span className="text-[8px] text-gray-400 font-mono">
              {contractNumber}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
