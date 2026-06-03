// Хэрэглэгчийн зураг (байхгүй бол нэрний эхний үсгүүд)
export default function Avatar({ url, name }) {
  if (url) {
    return (
      <img
        src={url.startsWith('http') ? url : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000'}/${url}`}
        alt={name}
        className="w-9 h-9 rounded-full object-cover shrink-0 border border-gray-200"
      />
    )
  }
  const initials = name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span className="w-9 h-9 rounded-full flex items-center justify-center
                     bg-emerald-100 text-emerald-700 font-semibold text-xs shrink-0">
      {initials}
    </span>
  )
}
