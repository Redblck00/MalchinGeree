'use client'

// Buyer / Seller role сонголтын таб
export default function RoleTab({ active, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 sm:px-4 py-2  text-xs sm:text-sm font-medium transition-colors cursor-pointer border-0
                  inline-flex items-center gap-1.5 min-w-0
                  ${active
                    ? 'bg-emerald-600 text-white'
                    : 'bg-transparent text-gray-600 hover:bg-gray-50'}
                  ${className}`}
    >
      {children}
    </button>
  )
}
