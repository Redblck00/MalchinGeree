'use client'

// ══════════════════════════════════════════════════════
// UserAvatar — хэрэглэгчийн зургийг (Cloudinary) харуулна.
// Зураг байхгүй бол нэрний эхний үсгүүдээр emerald avatar.
//
// Props:
//   src        — profile_image_url (Cloudinary бүтэн URL эсвэл relative)
//   name       — fallback initials-д ашиглах бүтэн нэр
//   className  — хэмжээ/текст (жишээ: "w-9 h-9 text-xs") — img + fallback хоёуланд
//   fallbackClassName — initials дугуйн өнгө (default: emerald)
//   alt        — img alt (default: name)
// ══════════════════════════════════════════════════════

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
