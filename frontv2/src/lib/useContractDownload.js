'use client'
import { useState } from 'react'

// ══════════════════════════════════════════════════════════════
// useContractDownload — Гэрээ татах hook
//
// PDF + Word — html2canvas-pro-аар page бүрийг зураг болгож татна
//            (текст хуулагдахгүй, бэлэн файл шууд татагдана)
// Print     — window.print() — browser-ийн принтерийн dialog нээгдэнэ
//
// Хэрэглээ:
//   const { downloadPdf, downloadDocx, print, busy } =
//     useContractDownload({ contentRef, contractNumber, contractTitle })
// ══════════════════════════════════════════════════════════════
export default function useContractDownload({
  contentRef,
  contractNumber,
  contractTitle,
}) {
  const [busy, setBusy] = useState(null)  // 'pdf' | 'docx' | 'print' | null

  const fileBase = (contractNumber || 'contract').replace(/[^a-zA-Z0-9\-_]/g, '_')

  const getPageElements = () => {
    const el = contentRef?.current
    if (!el) return []
    return Array.from(el.querySelectorAll('.contract-page'))
  }

  const elementToCanvas = async (el) => {
    // html2canvas-pro — Tailwind v4-ийн oklch()/lab() өнгөнүүдийг дэмжинэ
    const { default: html2canvas } = await import('html2canvas-pro')
    return html2canvas(el, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    })
  }

  // ── PDF: jsPDF + page бүр тус тусын зураг ──
  const downloadPdf = async () => {
    setBusy('pdf')
    try {
      const pageEls = getPageElements()
      if (pageEls.length === 0) throw new Error('Гэрээний хуудаснууд олдсонгүй')

      const { default: jsPDF } = await import('jspdf')
      const pdf = new jsPDF('p', 'mm', 'a4')

      for (let i = 0; i < pageEls.length; i++) {
        const canvas = await elementToCanvas(pageEls[i])
        const imgData = canvas.toDataURL('image/png', 1.0)
        if (i > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, 0, 210, 297)
      }

      pdf.save(`${fileBase}.pdf`)
    } catch (err) {
      console.error('PDF татахад алдаа:', err)
      alert('PDF татахад алдаа гарлаа: ' + err.message)
    } finally {
      setBusy(null)
    }
  }

  // ── Word: docx + page бүрийн зураг ──
  const downloadDocx = async () => {
    setBusy('docx')
    try {
      const pageEls = getPageElements()
      if (pageEls.length === 0) throw new Error('Гэрээний хуудаснууд олдсонгүй')

      const { Document, Packer, Paragraph, ImageRun, PageBreak } = await import('docx')
      const { saveAs } = await import('file-saver')

      const pageBlobs = []
      for (const pageEl of pageEls) {
        const canvas = await elementToCanvas(pageEl)
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
        const arrayBuffer = await blob.arrayBuffer()
        pageBlobs.push({
          bytes: new Uint8Array(arrayBuffer),
          ratio: canvas.height / canvas.width,
        })
      }

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

  // ── Print: browser-ийн принтер dialog ──
  const print = () => {
    setBusy('print')
    setTimeout(() => {
      window.print()
      setBusy(null)
    }, 100)
  }

  return { downloadPdf, downloadDocx, print, busy }
}
