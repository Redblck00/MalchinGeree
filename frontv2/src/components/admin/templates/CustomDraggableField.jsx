'use client'
import { MdDragIndicator, MdAdd, MdClose, MdEdit, MdShortText } from 'react-icons/md'
import { FIELD_COLORS, TYPE_ICONS } from './fieldStyles'

// ── Custom draggable field — edit/delete товчуудтай ───
export default function CustomDraggableField({ field, onInsert, onEdit, onDelete }) {
  const c = FIELD_COLORS.custom
  const Icon = TYPE_ICONS[field.type] || MdShortText

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', `{{${field.key}}}`)
    e.dataTransfer.setData('field-key', field.key)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      title={`{{${field.key}}} · ${field.type}`}
      style={{ borderColor: c.border, background: c.bg }}
      className="group flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-grab
                 active:cursor-grabbing hover:shadow-sm hover:-translate-y-px transition-all
                 mb-1.5 select-none"
    >
      <MdDragIndicator size={14} className="text-gray-400 shrink-0 -ml-1" />
      <span style={{ background: c.dot }} className="w-1.5 h-1.5 rounded-full shrink-0" />
      <Icon size={14} color={c.text} />
      <div className="flex-1 min-w-0">
        <p style={{ color: c.text }} className="text-xs font-medium truncate leading-tight">
          {field.label}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] font-mono text-gray-500 truncate">{field.key}</span>
          <span className="text-[9px] text-gray-400 capitalize">· {field.type}</span>
        </div>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onInsert(field.key) }}
          title="Cursor байрлалд оруулах"
          className="w-5 h-5 flex items-center justify-center rounded
                     bg-white border border-gray-200 hover:bg-gray-50 cursor-pointer"
        >
          <MdAdd size={12} className="text-gray-600" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          title="Засах"
          className="w-5 h-5 flex items-center justify-center rounded
                     bg-white border border-gray-200 hover:bg-gray-50 cursor-pointer"
        >
          <MdEdit size={10} className="text-gray-600" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title="Устгах"
          className="w-5 h-5 flex items-center justify-center rounded
                     bg-white border border-red-200 hover:bg-red-50 cursor-pointer"
        >
          <MdClose size={10} className="text-red-500" />
        </button>
      </div>
    </div>
  )
}
