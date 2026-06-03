'use client'

// Бар/Line chart-ын period filter — pill товчнууд
export default function PeriodPills({ options, value, onChange }) {
  return (
    <div className="flex gap-1 p-1 bg-emerald-50 border border-emerald-200
                    overflow-x-auto max-w-full [-ms-overflow-style:none] [scrollbar-width:none]
                    [&::-webkit-scrollbar]:hidden">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`shrink-0 px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-[11px] font-mono uppercase tracking-wider
                      transition-all cursor-pointer border-0 whitespace-nowrap
                      ${value === opt.value
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-transparent text-emerald-700 hover:bg-emerald-100'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
