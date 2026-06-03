import {
  MdShortText,
  MdNumbers,
  MdCalendarToday,
  MdNotes,
  MdArrowDropDownCircle,
  MdDraw,
  MdRepeat,
} from 'react-icons/md'

// ── Field-ийн өнгө ────────────────────────────────────
export const FIELD_COLORS = {
  default:   { bg: '#EEEDFE', border: '#AFA9EC', text: '#3C3489', dot: '#7166D9' },
  teal:      { bg: '#E1F5EE', border: '#5DCAA5', text: '#085041', dot: '#1D9E75' },
  green:     { bg: '#E1F5EE', border: '#1D9E75', text: '#04342C', dot: '#1D9E75' },
  signature: { bg: '#EAF3DE', border: '#97C459', text: '#173404', dot: '#5A8A2A' },
  auto:      { bg: '#FFF8E1', border: '#FFD54F', text: '#7B5E00', dot: '#C39B00' },
  custom:    { bg: '#FEF3F2', border: '#FECDCA', text: '#9F1239', dot: '#E11D48' },
}

export const getColor = (field) => {
  if (!field) return FIELD_COLORS.default
  if (field.custom) return FIELD_COLORS.custom
  if (field.type === 'signature') return FIELD_COLORS.signature
  if (field.color) return FIELD_COLORS[field.color] || FIELD_COLORS.default
  if (field.auto) return FIELD_COLORS.auto
  return FIELD_COLORS.default
}

// ── Field type → icon ─────────────────────────────────
export const TYPE_ICONS = {
  text:       MdShortText,
  number:     MdNumbers,
  float:      MdNumbers,
  date:       MdCalendarToday,
  textarea:   MdNotes,
  select:     MdArrowDropDownCircle,
  signature:  MdDraw,
  each_start: MdRepeat,
  each_end:   MdRepeat,
}

export const FieldIcon = ({ field, size = 14, color }) => {
  const Icon = TYPE_ICONS[field.type] || MdShortText
  return <Icon size={size} color={color} />
}
