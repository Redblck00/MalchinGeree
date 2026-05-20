'use client'

// ══════════════════════════════════════════════════════════════
// StatusBadge — Гэрээний статусын pill (өнгөтэй цэгтэй)
//
// Жишээ: ● Хүлээгдэж байгаа  (yellow)
//         ● Баталгаажсан      (green)
// ══════════════════════════════════════════════════════════════

const STATUS_MAP = {
  DRAFT: {
    label: 'Ноорог',
    bg:    'bg-gray-100',
    text:  'text-gray-700',
    dot:   'bg-gray-400',
  },
  SENT: {
    label: 'Хүлээгдэж байгаа',
    bg:    'bg-amber-50',
    text:  'text-amber-800',
    dot:   'bg-amber-400',
  },
  PARTIALLY_SIGNED: {
    label: 'Хагас зурагдсан',
    bg:    'bg-orange-50',
    text:  'text-orange-800',
    dot:   'bg-orange-400',
  },
  FULLY_SIGNED: {
    label: 'Бүрэн зурагдсан',
    bg:    'bg-blue-50',
    text:  'text-blue-800',
    dot:   'bg-blue-400',
  },
  COMPLETED: {
    label: 'Баталгаажсан',
    bg:    'bg-emerald-50',
    text:  'text-emerald-800',
    dot:   'bg-emerald-500',
  },
  CLOSED: {
    label: 'Хаагдсан',
    bg:    'bg-slate-100',
    text:  'text-slate-700',
    dot:   'bg-slate-500',
  },
  CANCELLED: {
    label: 'Цуцлагдсан',
    bg:    'bg-red-50',
    text:  'text-red-700',
    dot:   'bg-red-400',
  },
  DECLINED: {
    label: 'Татгалзсан',
    bg:    'bg-red-50',
    text:  'text-red-700',
    dot:   'bg-red-400',
  },
  EXPIRED: {
    label: 'Хугацаа дууссан',
    bg:    'bg-gray-100',
    text:  'text-gray-600',
    dot:   'bg-gray-400',
  },
}

export default function StatusBadge({ status, size = 'sm' }) {
  const cfg = STATUS_MAP[status] || STATUS_MAP.DRAFT
  const sizeCls = size === 'lg'
    ? 'px-3 py-1.5 text-sm'
    : 'px-2.5 py-1 text-xs'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold
                      ${cfg.bg} ${cfg.text} ${sizeCls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}
