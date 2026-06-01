// Гэрээний template-д ашиглах бүх field-үүд
// Admin эдгээрийг document дээр drag-drop хийнэ
// key → template_content дотор {{key}} болж орно

const CONTRACT_FIELDS = [
  // ── Гэрээний үндсэн мэдээлэл ─────────────────────────
  {
    group: 'Гэрээний мэдээлэл',
    fields: [
      { key: 'contract_number', label: 'Гэрээний дугаар', type: 'text', auto: true },
      { key: 'year',            label: 'Он',              type: 'text', auto: true },
      { key: 'month',           label: 'Сар',             type: 'text', auto: true },
      { key: 'day',             label: 'Өдөр',            type: 'text', auto: true },
      { key: 'endDate',         label: 'Дуусах огноо',    type: 'date' },
    ],
  },

  // ── Худалдагч ─────────────────────────────────────────
  {
    group: 'Худалдагч',
    fields: [
      { key: 'seller.name',     label: 'Худалдагчийн нэр',     type: 'text', auto: true },
      { key: 'seller.phone',    label: 'Худалдагчийн утас',    type: 'number', auto: true },
      { key: 'seller.email',    label: 'Худалдагчийн имейл',   type: 'text', auto: true },
      { key: 'seller.address',  label: 'Худалдагчийн хаяг',    type: 'text', auto: true },
      { key: 'seller.register', label: 'Худалдагчийн регистр', type: 'register' },
    ],
  },

  // ── Худалдан авагч ────────────────────────────────────
  {
    group: 'Худалдан авагч',
    fields: [
      { key: 'buyer.name',     label: 'Худалдан авагчийн нэр',     type: 'text' },
      { key: 'buyer.phone',    label: 'Худалдан авагчийн утас',    type: 'number' },
      { key: 'buyer.email',    label: 'Худалдан авагчийн имейл',   type: 'text' },
      { key: 'buyer.address',  label: 'Худалдан авагчийн хаяг',    type: 'text' },
      { key: 'buyer.register', label: 'Худалдан авагчийн регистр', type: 'register' },
    ],
  },

  // ── Малын мэдээлэл ────────────────────────────────────
  // #each livestock ... /each блок хэлбэрээр template-д орно
  {
    group: 'Малын мэдээлэл ',
    fields: [
      { key: '#each livestock', label: 'Малын жагсаалт эхлэх',  type: 'each_start', color: 'teal' },
      { key: 'livestock_type',  label: 'Малын төрөл',           type: 'select' },
      { key: 'count',           label: 'Тоо толгой',            type: 'number' },
      { key: 'weight',          label: 'Малын жин (кг)',        type: 'float' },
      { key: 'price_per_unit',  label: 'Нэгж үнэ',              type: 'number' },
      { key: '/each',           label: 'Малын жагсаалт дуусах', type: 'each_end',   color: 'teal' },
    ],
  },

  // ── Хүргэлт ───────────────────────────────────────────
  {
    group: 'Гэрээний нөхцөл',
    fields: [
      { key: 'delivery.location',     label: 'Хүргэлтийн газар',  type: 'text' },
      { key: 'delivery.receive_date', label: 'Авах огноо',         type: 'date' },
      { key: 'delivery.text',         label: 'Нэмэлт шаардлага',  type: 'textarea', optional: true },
    ],
  },

  // ── Төлбөр ────────────────────────────────────────────
  {
    group: 'Төлбөр',
    fields: [
      { key: 'payment.total_amount',   label: 'Нийт үнэ',           type: 'number' },
      { key: 'payment.payment_type',   label: 'Төлбөрийн төрөл',    type: 'select' },
      { key: 'payment.advance_percent',label: 'Урьдчилгааны хувь',  type: 'number', optional: true },
      { key: 'payment.bank_account',   label: 'Дансны дугаар',      type: 'text',   optional: true },
    ],
  },

  // ── Гарын үсэг ────────────────────────────────────────
  {
    group: 'Гарын үсэг',
    fields: [
      { key: 'seller.signature', label: 'Худалдагчийн гарын үсэг', type: 'signature', color: 'green' },
      { key: 'buyer.signature',  label: 'Худалдан авагчийн гарын үсэг', type: 'signature', color: 'green' },
    ],
  },
]

// Малын төрлийн сонголтууд (хэрэглэгч гараар бичихгүй → бичгийн алдаанаас сэргийлнэ)
export const LIVESTOCK_TYPES = [
  'Хонь', 'Үхэр', 'Тэмээ', 'Ямаа', 'Бяруу',
  'Шүдлэн үхэр', 'Хурга', 'Ишиг', 'Төлөг', 'Тугал',
]

// Хувийн талбарт зөвшөөрөгдсөн type-ууд (admin UI button-нд харагдана)
export const CUSTOM_FIELD_TYPES = [
  { value: 'text',     label: 'Текст',     sample: 'Aa',    hint: 'Ердийн мөр' },
  { value: 'number',   label: 'Бүхэл тоо', sample: '123',   hint: 'Бүхэл утга' },
  { value: 'float',    label: 'Бутархай',  sample: '12.5',  hint: 'Бутархай тоо' },
  { value: 'date',     label: 'Огноо',     sample: '📅',    hint: 'YYYY-MM-DD' },
  { value: 'textarea', label: 'Урт текст', sample: '¶',     hint: 'Олон мөрт' },
]

// Custom field key-ийг шалгах (a-z, 0-9, _ — эхэлж үсэг)
export const validateCustomKey = (key) => {
  if (!key) return 'Key шаардлагатай'
  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    return 'Жижиг үсэг, тоо, _ зөвхөн (үсгээр эхэлнэ)'
  }
  return null
}

// Preset CONTRACT_FIELDS-ийн бүх key-г Set болгож буцаана
let _presetKeys
export const getPresetKeys = () => {
  if (_presetKeys) return _presetKeys
  const s = new Set()
  CONTRACT_FIELDS.forEach(g => g.fields.forEach(f => s.add(f.key)))
  _presetKeys = s
  return s
}

// schema_json.fields массив үүсгэх helper
// usedKeys      — template_content-д ашиглагдсан key-нүүд
// customFields  — admin нэмсэн хувийн талбарууд [{ key, label, type }]
//   → schema-д custom: true тэмдэглэгээтэй гарна
export const buildSchemaJson = (usedKeys, customFields = []) => {
  const fieldMap = {}
  CONTRACT_FIELDS.forEach(group => {
    group.fields.forEach(f => { fieldMap[f.key] = f })
  })
  customFields.forEach(f => { fieldMap[f.key] = { ...f, custom: true } })

  const fields = []
  const addedObjects = new Set()

  usedKeys.forEach(key => {
    if (key.startsWith('#each ')) {
      const arrayKey = key.replace('#each ', '')
      fields.push({ type: 'array', key: arrayKey, schema: [] })
    } else if (key === '/each') {
      // skip
    } else if (key.includes('.')) {
      const [parent] = key.split('.')
      if (parent === 'seller' || parent === 'buyer' || parent === 'delivery' || parent === 'payment') {
        if (!addedObjects.has(parent)) {
          addedObjects.add(parent)
          const children = usedKeys
            .filter(k => k.startsWith(parent + '.') && !k.includes('signature'))
            .map(k => ({ type: fieldMap[k]?.type || 'field', key: k.split('.')[1] }))
          if (children.length > 0) {
            fields.push({ type: 'object', key: parent, fields: children })
          }
        }
      } else {
        fields.push({ type: fieldMap[key]?.type || 'field', key })
      }
    } else {
      const f = fieldMap[key]
      if (f) {
        const entry = { type: f.type || 'field', key }
        // Custom field бол label, custom flag хадгална → ContractForm-д ашиглана
        if (f.custom) {
          entry.label  = f.label
          entry.custom = true
        }
        fields.push(entry)
      }
    }
  })

  return { fields }
}

// schema_json-аас custom field-уудыг буцаах (edit горимд load хийхэд хэрэгтэй)
export const extractCustomFields = (schemaJson) => {
  if (!schemaJson?.fields) return []
  return schemaJson.fields
    .filter(f => f.custom && f.key && !f.key.includes('.'))
    .map(f => ({ key: f.key, label: f.label || f.key, type: f.type || 'text' }))
}

export default CONTRACT_FIELDS