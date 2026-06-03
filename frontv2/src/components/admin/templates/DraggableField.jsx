'use client'
import { MdDragIndicator, MdAdd, MdAutoAwesome } from 'react-icons/md'
import { getColor, FieldIcon } from './fieldStyles'

// ── Нэг draggable field (sidebar мөр) ─────────────────
export default function DraggableField({ field, onInsert }) {
  const c = getColor(field)

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', `{{${field.key}}}`)
    e.dataTransfer.setData('field-key', field.key)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      title={`{{${field.key}}}`}
      style={{ borderColor: c.border, background: c.bg }}
      className="group flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-grab
                 active:cursor-grabbing hover:shadow-sm hover:-translate-y-px transition-all
                 mb-1.5 select-none"
    >
      <MdDragIndicator size={14} className="text-gray-400 shrink-0 -ml-1" />
      <span
        style={{ background: c.dot }}
        className="w-1.5 h-1.5 rounded-full shrink-0"
      />
      <FieldIcon field={field} color={c.text} />
      <div className="flex-1 min-w-0">
        <p style={{ color: c.text }} className="text-xs font-medium truncate leading-tight">
          {field.label}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {field.auto && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500">
              <MdAutoAwesome size={9} /> авто
            </span>
          )}
          {field.optional && (
            <span className="text-[10px] text-gray-400">заавал биш</span>
          )}
          {field.type && !['text'].includes(field.type) && (
            <span className="text-[10px] text-gray-400 capitalize">{field.type}</span>
          )}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onInsert(field.key) }}
        title="Cursor байрлалд оруулах"
        className="opacity-0 group-hover:opacity-100 transition-opacity
                   w-5 h-5 flex items-center justify-center rounded
                   bg-white border border-gray-200 hover:bg-gray-50 shrink-0 cursor-pointer"
      >
        <MdAdd size={12} className="text-gray-600" />
      </button>
    </div>
  )
}
