'use client'
import { useState } from 'react'
import { isPdfAttachment } from '@/lib/pdfjs'

// ══════════════════════════════════════════════════════════════
// useContractDownload — Гэрээ татах hook
//
// PDF  — Үндсэн гэрээ + зургийн хуудсыг html2canvas-аар зураг болгон
//        pdf-lib дотор A4 хуудас болгож байрлуулна. PDF хавсралтын
//        хуудсыг АНХНЫ форматаар нь (pdf-lib copyPages) дарааллаараа
//        нэгтгэнэ — формат/хэмжээ/бүтэц өөрчлөгдөхгүй.
// Word — page бүрийг зураг болгож docx-д байрлуулна (PDF хуудаснууд нь
//        одоо canvas учир зөв буудаг).
// Print — window.print()
//
// Хэрэглээ:
//   const { downloadPdf, downloadDocx, print, busy } =
//     useContractDownload({ contentRef, contractNumber, contractTitle })
// ══════════════════════════════════════════════════════════════
export default function useContractDownload({
  contentRef,
  contractNumber,
  contractTitle,
  attachments = [],
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

  const canvasToPngBytes = (canvas) =>
    new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) return reject(new Error('canvas.toBlob амжилтгүй'))
        resolve(new Uint8Array(await blob.arrayBuffer()))
      }, 'image/png')
    })

  // ── PDF: pdf-lib ──
  //   1. Үндсэн агуулга + зургийн хуудсыг html2canvas-аар A4 болгож гаргана.
  //   2. PDF хавсралтын бүх хуудсыг АНХНЫ форматаар нь (copyPages) гэрээний
  //      араас дарааллаар нь залгана — формат/хэмжээ/бүтэц өөрчлөгдөхгүй.
  const downloadPdf = async () => {
    setBusy('pdf')
    try {
      const pageEls = getPageElements()
      if (pageEls.length === 0) throw new Error('Гэрээний хуудаснууд олдсонгүй')

      const { PDFDocument } = await import('pdf-lib')
      const { saveAs }      = await import('file-saver')

      const out = await PDFDocument.create()
      const A4_W = 595.28   // 210mm @ 72pt
      const A4_H = 841.89   // 297mm @ 72pt

      // 1) Үндсэн агуулга + зураг хуудаснууд
      for (const el of pageEls) {
        const canvas = await elementToCanvas(el)
        const png    = await out.embedPng(await canvasToPngBytes(canvas))
        const page   = out.addPage([A4_W, A4_H])
        page.drawImage(png, { x: 0, y: 0, width: A4_W, height: A4_H })
      }

      // 2) PDF хавсралтуудыг гэрээний араас залгах
      for (const att of attachments) {
        if (!isPdfAttachment(att)) continue
        try {
          const bytes  = await fetch(att.file_url).then(r => r.arrayBuffer())
          const src    = await PDFDocument.load(bytes, { ignoreEncryption: true })
          const copied = await out.copyPages(src, src.getPageIndices())
          copied.forEach(p => out.addPage(p))
        } catch (e) {
          console.error('PDF хавсралт нэгтгэхэд алдаа:', att.file_name, e)
        }
      }

      const outBytes = await out.save()
      saveAs(new Blob([outBytes], { type: 'application/pdf' }), `${fileBase}.pdf`)
    } catch (err) {
      console.error('PDF татахад алдаа:', err)
      alert('PDF татахад алдаа гарлаа: ' + err.message)
    } finally {
      setBusy(null)
    }
  }

  // ── Word: docx + page бүрийн зураг ──
  // PDF хавсралт нь одоо canvas болсон тул html2canvas зөв буулгана.
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
