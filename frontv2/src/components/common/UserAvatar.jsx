'use client'


function resolveImg(url) {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '')
  return `${base}/${url.replace(/^\/+/, '')}`
}

export default function UserAvatar({
  src,
  name = '',
  className = '',
  fallbackClassName = 'bg-emerald-600 text-white',
  alt,
}) {
  const url = resolveImg(src)

  if (url) {
    return (
      <img
        src={url}
        alt={alt || name || 'avatar'}
        className={`rounded-full object-cover ${className}`}
      />
    )
  }

  const initials = name
    .split(' ')
    .filter(Boolean)
    .map(s => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <span
      className={`rounded-full inline-flex items-center justify-center
                  font-semibold uppercase ${fallbackClassName} ${className}`}
    >
      {initials || '👤'}
    </span>
  )
}
