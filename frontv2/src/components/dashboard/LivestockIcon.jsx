import { createElement } from 'react'
import {
  GiSheep, GiGoat, GiCow, GiHorseHead, GiCamel, GiPawPrint,
} from 'react-icons/gi'

// ── Livestock icon map ─────────────────────────────────
// iconOf нь k.includes(key)-ээр (substring) таарна. Төл/залуу малыг
// төрөл тус бүрийн icon руу буулгана ("Шүдлэн үхэр" нь "үхэр"-ээр аль
// хэдийн таарна).
const LIVESTOCK_ICON = {
  // Үндсэн төрөл
  'хонь':   GiSheep,    'sheep':  GiSheep,
  'ямаа':   GiGoat,     'goat':   GiGoat,
  'үхэр':   GiCow,      'cattle': GiCow,
  'адуу':   GiHorseHead,'horse':  GiHorseHead,
  'тэмээ':  GiCamel,    'camel':  GiCamel,
  // Төл / залуу мал
  'хурга':  GiSheep,    // хонины төл
  'төлөг':  GiSheep,    // 1-2 насны хонь
  'ишиг':   GiGoat,     // ямааны төл
  'тугал':  GiCow,      // үхрийн төл
  'бяруу':  GiCow,      // 1-2 насны үхэр
}

const iconOf = (type) => {
  const k = (type || '').toLowerCase().trim()
  for (const key of Object.keys(LIVESTOCK_ICON)) {
    if (k.includes(key)) return LIVESTOCK_ICON[key]
  }
  return GiPawPrint
}

export default function LivestockIcon({ type, size = 18, className = '' }) {
  // iconOf нь одоо байгаа icon компонентыг буцаана — createElement-ээр
  // дуудна (render дотор шинэ компонент үүсгэх eslint дүрмээс зайлсхийнэ).
  return createElement(iconOf(type), { size, className })
}
