const Handlebars = require('handlebars')
const crypto     = require('crypto')

// ══════════════════════════════════════════════════════
// HANDLEBARS HELPER БҮРТГЭЛ
// ══════════════════════════════════════════════════════

Handlebars.registerHelper('blank',       (v) => v || '________')
Handlebars.registerHelper('formatDate',  (v) => {
  if (!v) return '________'
  const d = new Date(v)
  return `${d.getFullYear()} он ${d.getMonth()+1} сар ${d.getDate()} өдөр`
})
Handlebars.registerHelper('formatMoney', (v) => {
  if (!v) return '________'
  return `₮${Number(v).toLocaleString('mn-MN')}`
})
// Бөглөгдөөгүй placeholder → хоосон
Handlebars.registerHelper('helperMissing', () => '')

// ══════════════════════════════════════════════════════
// АЛХАМ 1: schema_json-с зөвшөөрөгдсөн field-үүдийг цуглуулах
// schema_json.fields-ийн key бүрийг recursive-аар явна
// ══════════════════════════════════════════════════════

const collectSchemaKeys = (fields, prefix = '') => {
  const keys = new Set()

  for (const field of fields || []) {
    const fullKey = prefix ? `${prefix}.${field.key}` : field.key

    switch (field.type) {
      case 'field':
      case 'number':
      case 'date':
      case 'textarea':
      case 'select':
      case 'signature':
        keys.add(fullKey)
        break

      case 'object':
      case 'group':
        keys.add(fullKey)
        // Nested fields recursive
        const childFields = field.fields || field.children || []
        collectSchemaKeys(childFields, fullKey).forEach(k => keys.add(k))
        break

      case 'array':
        keys.add(fullKey)
        // Array schema-ийн field-үүд
        for (const subField of field.schema || []) {
          keys.add(`${fullKey}.${subField.key}`)
        }
        break
    }
  }

  return keys
}

// ══════════════════════════════════════════════════════
// АЛХАМ 2: filled_data_json-г schema key-үүдтэй нийцүүлж
//          Handlebars context бэлдэх
//
// Дүрэм:
//  - schema-д байгаа field-үүдийг л ашиглана
//  - schema-д байгаа ч filled_data-д байхгүй бол → ""
//  - nested: { seller: { name: "Бат" } } → context.seller.name = "Бат"
//  - array: livestock → #each livestock ажиллана
// ══════════════════════════════════════════════════════

const buildContext = (schemaFields, filledData, contractMeta = {}) => {
  const schemaKeys = collectSchemaKeys(schemaFields)
  const context    = {}

  // Гэрээний автомат мета
  const now = new Date()
  Object.assign(context, {
    contract_number: contractMeta.contract_number || '',
    year:            contractMeta.year  || String(now.getFullYear()),
    month:           contractMeta.month || String(now.getMonth() + 1),
    day:             contractMeta.day   || String(now.getDate()),
  })

  // filled_data_json-г schema key-ийн дагуу context-д нэмэх
  const assignValue = (obj, keyPath, target) => {
    const parts = keyPath.split('.')
    let src = obj
    let dst = target

    for (let i = 0; i < parts.length - 1; i++) {
      if (src == null) break
      src = src[parts[i]]
      dst[parts[i]] = dst[parts[i]] || {}
      dst = dst[parts[i]]
    }

    const lastKey  = parts[parts.length - 1]
    const srcValue = src?.[lastKey]

    if (srcValue === undefined || srcValue === null) {
      // schema-д байгаа ч filled-д байхгүй → хоосон
      if (!(lastKey in dst)) dst[lastKey] = ''
    } else {
      dst[lastKey] = srcValue
    }
  }

  for (const keyPath of schemaKeys) {
    assignValue(filledData, keyPath, context)
  }

  return context
}

// ══════════════════════════════════════════════════════
// ҮНДСЭН RENDER ФУНКЦ
//
// Input:
//   templateContent — {{placeholder}}-тэй гэрээний эх текст
//   schemaJson      — { fields: [...] } — зөвшөөрөгдсөн field тодорхойлолт
//   filledData      — хэрэглэгчийн оруулсан утгууд
//   contractMeta    — { contract_number, year, month, day }
//
// Output:
//   rendered — template текст + filled утгууд нийлсэн бүрэн гэрээний текст
//   hash     — SHA-256 (өөрчлөлт илрүүлэхэд)
// ══════════════════════════════════════════════════════

const renderContract = (templateContent, schemaJson, filledData, contractMeta = {}) => {
  if (!templateContent) throw new Error('Template текст хоосон байна')
  if (!schemaJson?.fields) throw new Error('Schema JSON буруу формат')

  // Context бэлдэх
  const context = buildContext(schemaJson.fields, filledData || {}, contractMeta)

  // Handlebars compile + render
  // noEscape: false — XSS-аас сэргийлэх. Хэрэглэгчийн оруулсан утгууд HTML-д
  // escape хийгдэнэ. Гарын үсэг гэх мэт HTML агуулсан утгыг хэрэглэхдээ
  // Handlebars.SafeString-ээр боож context-д тавина.
  const compiled = Handlebars.compile(templateContent, { noEscape: false, strict: false })
  const rendered = compiled(context)

  // Hash
  const hash = crypto.createHash('sha256').update(rendered).digest('hex')

  return { rendered, hash, context }
}

// ══════════════════════════════════════════════════════
// PREVIEW RENDER — DRAFT үед хэрэглэгчид харуулах
//
// Бөглөгдөөгүй field-үүдийг "________" болгоно
// (filled_data дутуу байсан ч гэрээний бүтэн текст харагдана)
// ══════════════════════════════════════════════════════

const renderPreview = (templateContent, schemaJson, filledData, contractMeta = {}) => {
  if (!templateContent) return { rendered: '', hash: '' }

  const schemaFields = schemaJson?.fields || []
  const context      = buildContext(schemaFields, filledData || {}, contractMeta)

  // Бөглөгдөөгүй утгуудыг ________ болгох
  const fillBlanks = (obj) => {
    for (const k of Object.keys(obj)) {
      if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
        fillBlanks(obj[k])
      } else if (obj[k] === '' || obj[k] == null) {
        obj[k] = '________'
      }
    }
  }
  fillBlanks(context)

  // noEscape: false — XSS-аас сэргийлэх (renderContract-той ижил)
  const compiled = Handlebars.compile(templateContent, { noEscape: false, strict: false })
  const rendered = compiled(context)
  const hash     = crypto.createHash('sha256').update(rendered).digest('hex')

  return { rendered, hash }
}

// ══════════════════════════════════════════════════════
// TEMPLATE ДЭХЬ PLACEHOLDER-УУДЫГ ГАРГАХ
// Admin template оруулахад ашиглана
// ══════════════════════════════════════════════════════

const extractPlaceholders = (templateContent) => {
  const matches = templateContent.match(/\{\{([^#/>!][^}]*)\}\}/g) || []
  return [...new Set(
    matches
      .map(m => m.replace(/^\{\{|\}\}$/g, '').trim())
      .filter(k => !k.includes(' ') && !k.startsWith('!'))
  )]
}

module.exports = { renderContract, renderPreview, buildContext, extractPlaceholders }