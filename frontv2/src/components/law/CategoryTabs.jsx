'use client'

// Ангиллын шүүлтүүр — хурц таб (доод border-аар active заана).
// Mobile дээр хэвтээ гүйдэг (overflow-x-auto). sticky top-16 → navbar доор наална.
export default function CategoryTabs({ categories, active, onChange }) {
  return (
    <div className="border-b border-gray-200 bg-white sticky top-16 z-20">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 flex gap-1 overflow-x-auto no-scrollbar">
        {categories.map((cat) => {
          const on = active === cat
          return (
            <button
              key={cat}
              onClick={() => onChange(cat)}
              className={`shrink-0 px-3 sm:px-4 py-4 text-sm font-medium border-b-2 -mb-px
                          cursor-pointer bg-transparent transition-colors
                          ${on
                            ? 'border-emerald-600 text-emerald-700 font-semibold'
                            : 'border-transparent text-gray-500 hover:text-gray-900'}`}
            >
              {cat}
            </button>
          )
        })}
      </div>
    </div>
  )
}
