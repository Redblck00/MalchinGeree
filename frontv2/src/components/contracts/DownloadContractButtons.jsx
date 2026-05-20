'use client'
import { useState } from 'react'
import { MdPictureAsPdf, MdDescription, MdDownload } from 'react-icons/md'

// ══════════════════════════════════════════════════════════════
// DownloadContractButtons — Гэрээг PDF / Word хэлбэрээр татах
//
// Хууль зүйн шаардлагаар ТЕКСТ ХУУЛАГДАХГҮЙ байх ёстой тул
// гэрээг html2canvas-аар зураг болгож хувиргаад:
//   • PDF:  jsPDF дотор A4 хуудас бүрээр зураг хэлбэрээр оруулна
//   • DOCX: docx сан ашиглан хуудас бүрийг ImageRun-аар нэмнэ
//
// contentRef доторх `.contract-page` элемент бүрийг тус тусад нь
// capture хийнэ — ContractA4Document-н paginated layout-тай уялдан
// хуудас бүрийн footer, QR код хадгалагдана.
//
// Props:
//   contentRef        ref → ContractA4Document-г агуулсан DOM элемент
//   contractNumber    'CNT-2026-000123'
//   contractTitle     'Малын худалдааны гэрээ'
// ══════════════════════════════════════════════════════════════
export default function DownloadContractButtons({
  contentRef,
  contractNumber,
  contractTitle,
}) {
  const [busy, setBusy] = useState(null)  // 'pdf' | 'docx' | null

  const fileBase = (contractNumber || 'contract').replace(/[^a-zA-Z0-9\-_]/g, '_')

  // ── Контейнер дотроос бүх `.contract-page` элементийг олох ──
  const getPageElements = () => {
    const el = contentRef?.current
    if (!el) return []
    const pages = el.querySelectorAll('.contract-page')
    return Array.from(pages)
  }

  // ── Нэг DOM элементийг canvas болгох ──
  const elementToCanvas = async (el) => {
    const { default: html2canvas } = await import('html2canvas')
    return html2canvas(el, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    })
  }

  // ── PDF татах (jsPDF + хуудас бүр тус тусад нь) ──
  const handlePdf = async () => {
    setBusy('pdf')
    try {
      const pageEls = getPageElements()
      if (pageEls.length === 0) throw new Error('Гэрээний хуудаснууд олдсонгүй')

      const { default: jsPDF } = await import('jspdf')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth  = 210
      const pageHeight = 297

      for (let i = 0; i < pageEls.length; i++) {
        const canvas = await elementToCanvas(pageEls[i])
        const imgData = canvas.toDataURL('image/png', 1.0)

        if (i > 0) pdf.addPage()
        // A4 хуудсыг бүтэн дүүргэх
        pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight)
      }

      pdf.save(`${fileBase}.pdf`)
    } catch (err) {
      console.error('PDF татахад алдаа:', err)
      alert('PDF татахад алдаа гарлаа: ' + err.message)
    } finally {
      setBusy(null)
    }
  }

  // ── DOCX татах (docx + хуудас бүрийн зураг) ──
  const handleDocx = async () => {
    setBusy('docx')
    try {
      const pageEls = getPageElements()
      if (pageEls.length === 0) throw new Error('Гэрээний хуудаснууд олдсонгүй')

      const { Document, Packer, Paragraph, ImageRun, PageBreak } = await import('docx')
      const { saveAs } = await import('file-saver')

      // Хуудас бүрийг зураг болгох — sequential (memory-той эвээ ажиллана)
      const pageBlobs = []
      for (const el of pageEls) {
        const canvas = await elementToCanvas(el)
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
        const arrayBuffer = await blob.arrayBuffer()
        pageBlobs.push({
          bytes: new Uint8Array(arrayBuffer),
          ratio: canvas.height / canvas.width,
        })
      }

      // Word дотор A4 өргөнтэй ойролцоо хэмжих
      const targetWidthPx = 600

      const children = []
      pageBlobs.forEach((pg, i) => {
        children.push(new Paragraph({
          children: [
            new ImageRun({
              data: pg.bytes,
              type: 'png',
              transformation: {
                width:  targetWidthPx,
                height: Math.round(targetWidthPx * pg.ratio),
              },
            }),
            // Сүүлийн хуудаснаас бусдад page break нэмэх
            ...(i < pageBlobs.length - 1 ? [new PageBreak()] : []),
          ],
        }))
      })

      const doc = new Document({
        sections: [{ properties: {}, children }],
        title: contractTitle || 'Contract',
      })

      const blob = await Packer.toBlob(doc)
      saveAs(blob, `${fileBase}.docx`)
    } catch (err) {
      console.error('DOCX татахад алдаа:', err)
      alert('Word татахад алдаа гарлаа: ' + err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="bg-white/10 rounded-xl p-3 flex flex-col gap-2">
      <p className="text-white/70 text-xs font-semibold uppercase tracking-wider m-0
                    inline-flex items-center gap-1">
        <MdDownload size={14} /> Татаж авах
      </p>
      <p className="text-white/50 text-[10px] m-0">
        Гэрээ зураг хэлбэртэй учир текст хуулагдахгүй
      </p>

      <button
        onClick={handlePdf}
        disabled={busy !== null}
        className="bg-white rounded-lg py-2 px-3 text-xs font-semibold text-[#1e1b4b]
                   cursor-pointer border-0 hover:bg-gray-50 transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed
                   inline-flex items-center justify-center gap-1.5"
      >
        <MdPictureAsPdf size={14} className="text-red-600" />
        {busy === 'pdf' ? 'PDF үүсгэж байна...' : 'PDF татах'}
      </button>

      <button
        onClick={handleDocx}
        disabled={busy !== null}
        className="bg-white rounded-lg py-2 px-3 text-xs font-semibold text-[#1e1b4b]
                   cursor-pointer border-0 hover:bg-gray-50 transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed
                   inline-flex items-center justify-center gap-1.5"
      >
        <MdDescription size={14} className="text-blue-600" />
        {busy === 'docx' ? 'Word үүсгэж байна...' : 'Word татах'}
      </button>
    </div>
  )
}
