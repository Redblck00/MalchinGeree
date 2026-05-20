'use client'

// ── Input ─────────────────────────────────────────────
export function Input({ label, required, note, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}
      <input
        className={`w-full px-3.5 py-2.5 border rounded-xl text-sm outline-none transition-colors
          ${error ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white focus:border-[#1e1b4b]'}
          disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed ${className}`}
        {...props}
      />
      {note  && <p className="text-xs text-gray-400">{note}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ── Textarea ──────────────────────────────────────────
export function Textarea({ label, required, note, error, rows = 3, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}
      <textarea
        rows={rows}
        className={`w-full px-3.5 py-2.5 border rounded-xl text-sm outline-none
          transition-colors resize-none
          ${error ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white focus:border-[#1e1b4b]'}
          ${className}`}
        {...props}
      />
      {note  && <p className="text-xs text-gray-400">{note}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ── Select ────────────────────────────────────────────
export function Select({ label, required, options = [], error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}
      <select
        className={`w-full px-3.5 py-2.5 border rounded-xl text-sm outline-none bg-white
          ${error ? 'border-red-300' : 'border-gray-200 focus:border-[#1e1b4b]'} ${className}`}
        {...props}
      >
        <option value="">Сонгох...</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ── Button ────────────────────────────────────────────
export function Button({ children, variant = 'primary', loading, className = '', ...props }) {
  const base = 'px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed'
  const variants = {
    primary:   'bg-[#1e1b4b] text-white hover:bg-[#2d2a6e]',
    secondary: 'border border-gray-200 text-gray-700 hover:bg-gray-50',
    danger:    'bg-red-500 text-white hover:bg-red-600',
    ghost:     'text-[#1e1b4b] hover:bg-[#1e1b4b]/5',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={loading} {...props}>
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          {children}
        </span>
      ) : children}
    </button>
  )
}

// ── Badge ─────────────────────────────────────────────
export function Badge({ children, color = 'gray' }) {
  const colors = {
    gray:   'bg-gray-100 text-gray-600',
    blue:   'bg-blue-100 text-blue-700',
    green:  'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    red:    'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-700',
  }
  return (
    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  )
}

// ── Card ──────────────────────────────────────────────
export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 ${className}`}>
      {children}
    </div>
  )
}

// ── Alert ─────────────────────────────────────────────
export function Alert({ type = 'info', children }) {
  const styles = {
    info:    'bg-blue-50 border-blue-200 text-blue-700',
    success: 'bg-green-50 border-green-200 text-green-700',
    error:   'bg-red-50 border-red-200 text-red-600',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  }
  return (
    <div className={`px-4 py-3 rounded-xl border text-sm ${styles[type]}`}>
      {children}
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────
export function Spinner({ size = 'md' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return (
    <div className={`${sizes[size]} border-2 border-gray-200 border-t-[#1e1b4b] rounded-full animate-spin`} />
  )
}