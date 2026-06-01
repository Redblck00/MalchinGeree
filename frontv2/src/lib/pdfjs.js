'use client'
// ══════════════════════════════════════════════════════════════
// Хавсралтын төрөл тогтоох туслахууд.
// (PDF-ийг документэд inline render хийхээ больсон тул pdf.js хэрэглэхгүй —
//  PDF-ийг хэрэглэгч sidebar-аас тусдаа нээж үзнэ.)
// ══════════════════════════════════════════════════════════════

export function isPdfAttachment(att) {
  if (!att) return false
  return (
    att.file_type === 'application/pdf' ||
    att.file_url?.toLowerCase().endsWith('.pdf')
  )
}

export function isImageAttachment(att) {
  return !!att?.file_type?.startsWith('image/')
}
