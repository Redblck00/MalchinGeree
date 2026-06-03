'use client'
import { useMemo } from 'react'
import { MdExpandMore, MdExpandLess } from 'react-icons/md'
import DraggableField from './DraggableField'

// ── Sidebar групп — collapsible + хайлт filter ───────
export default function FieldGroup({ group, query, collapsed, onToggle, onInsert }) {
  const filtered = useMemo(() => {
    if (!query) return group.fields
    const q = query.toLowerCase()
    return group.fields.filter(
      f => f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q)
    )
  }, [group.fields, query])

  if (filtered.length === 0) return null

  return (
    <div className="mb-2">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-1.5 py-1 rounded
                   hover:bg-gray-100 transition-colors text-left cursor-pointer bg-transparent border-0"
      >
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
          {group.group}
          <span className="ml-1.5 text-gray-400 normal-case font-normal">
            ({filtered.length})
          </span>
        </span>
        {collapsed
          ? <MdExpandMore size={16} className="text-gray-400" />
          : <MdExpandLess size={16} className="text-gray-400" />}
      </button>
      {!collapsed && (
        <div className="mt-1">
          {filtered.map((field, i) => (
            <DraggableField key={i} field={field} onInsert={onInsert} />
          ))}
        </div>
      )}
    </div>
  )
}
