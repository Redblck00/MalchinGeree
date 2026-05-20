// Template-ийн {{key}}-г contractFields.js-ийн label-аар сольж chip болгож харуулна
// Admin (preview), Хэрэглэгч (template дэлгэрэнгүй) хоёрт хамтад нь ашиглагдана
// import CONTRACT_FIELDS from './contractFields'

// const escapeHtml = (s) =>
//   String(s)
//     .replace(/&/g, '&amp;')
//     .replace(/</g, '&lt;')
//     .replace(/>/g, '&gt;')

// export const renderChips = (text) => {
//   if (!text) return ''

//   const allFields = CONTRACT_FIELDS.flatMap(g => g.fields)

//   // Текст дотор HTML inject хийхгүй: эхлээд escape, дараа нь {{key}}-г сольно
//   const safe = escapeHtml(text)

//   return safe.replace(/\{\{([^}]+)\}\}/g, (match, rawKey) => {
//     const key = rawKey.trim()
//     const field = allFields.find(f => f.key === key)
//     const label = field?.label || key
//     const isSignature = field?.type === 'signature'
//     const isTeal = field?.color === 'teal' || key.startsWith('#each') || key === '/each'

//     const style = isSignature
//       ? 'background:#EAF3DE;color:#085041;border:1px solid #97C459'
//       : isTeal
//         ? 'background:#E1F5EE;color:#085041;border:1px solid #5DCAA5'
//         : 'background:#EEEDFE;color:#3C3489;border:1px solid #AFA9EC'

//     return `<span style="${style};padding:1px 7px;border-radius:4px;font-size:11px;font-family:monospace;display:inline-block">${escapeHtml(label)}</span>`
//   })
// }
import CONTRACT_FIELDS from './contractFields'

// {{placeholder}} → chip хэлбэрт HTML болгоно
// Preview-д харуулахад ашиглана — засварлах боломжгүй
export const renderChips = (text) => {
  if (!text) return ''

  const allFields = CONTRACT_FIELDS.flatMap(g => g.fields)

  return text
    // Мөрийн эхлэл хадгалах
    .split('\n').join('<br/>')
    // Placeholder → chip
    .replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmed = key.trim()
      const field   = allFields.find(f => f.key === trimmed)
      const label   = field?.label || trimmed

      // CSS-г single-line болгох — pagination split хийхэд хувирахгүй
      const baseStyle = 'display:inline-block;border-radius:4px;padding:1px 8px;font-size:11px;font-family:monospace;white-space:nowrap;'

      // Гарын үсэг
      if (field?.type === 'signature') {
        return `<span style="${baseStyle}background:#EAF3DE;color:#085041;border:1px solid #97C459">${label}</span>`
      }

      // Array (each) tag
      if (trimmed.startsWith('#each') || trimmed === '/each') {
        return `<span style="${baseStyle}background:#E1F5EE;color:#085041;border:1px solid #5DCAA5">${trimmed}</span>`
      }

      // Автомат талбар (contract_number, year, month, day)
      if (field?.auto) {
        return `<span style="${baseStyle}background:#FFF8E1;color:#7B5E00;border:1px solid #FFD54F">${label}</span>`
      }

      // Энгийн талбар
      return `<span style="${baseStyle}background:#EEEDFE;color:#3C3489;border:1px solid #AFA9EC">${label}</span>`
    })
}
