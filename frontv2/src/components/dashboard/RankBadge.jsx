import { MdEmojiEvents } from 'react-icons/md'

// Топ хэрэглэгчийн зэрэглэлийн badge (1-3 медаль, бусад нь дугаар)
export default function RankBadge({ rank }) {
  const colors = {
    1: 'bg-linear-to-br from-yellow-300 to-yellow-500 text-yellow-900',
    2: 'bg-linear-to-br from-gray-200 to-gray-400 text-gray-700',
    3: 'bg-linear-to-br from-orange-200 to-orange-400 text-orange-800',
  }
  const isTop = rank <= 3
  return (
    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                       ${colors[rank] || 'bg-gray-100 text-gray-500'}`}>
      {isTop ? <MdEmojiEvents size={14} /> : rank}
    </span>
  )
}
