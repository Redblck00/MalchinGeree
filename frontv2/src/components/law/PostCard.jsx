'use client'
import Link from 'next/link'
import {
  FiPlay, FiFileText, FiArrowRight, FiChevronRight, FiClock, FiCalendar,
} from 'react-icons/fi'
import useReveal from '@/lib/useReveal'
import { formatDate } from './lawData'

// Санаатайгаар ХУРЦ ирмэг (rounded-none) — "хууль"-ын албан ёсны төрх.
// Дугуй хэлбэрийг зөвхөн thumbnail дахь decorative blur-т л зөвшөөрнө.

const actionLabel = (type) => (type === 'video' ? 'Үзэх' : 'Унших')

// Зураггүй тул emerald gradient дээр төрлийн icon бүхий thumbnail
function Thumb({ type, large = false }) {
  const Icon = type === 'video' ? FiPlay : FiFileText
  return (
    <div className={`relative flex items-center justify-center overflow-hidden shrink-0
                     bg-linear-to-br from-emerald-400 via-emerald-500 to-emerald-700
                     ${large ? 'aspect-video md:aspect-auto md:h-full min-h-48' : 'aspect-video'}`}>
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
      <div className="relative flex items-center justify-center w-14 h-14
                      border border-white/40 bg-white/15 backdrop-blur-sm">
        <Icon size={large ? 26 : 22} className="text-white" />
      </div>
      <span className="absolute bottom-3 left-3 px-2 py-0.5 bg-black/35 backdrop-blur-sm
                       text-white text-[10px] font-semibold uppercase tracking-wider">
        {type === 'video' ? 'Видео' : 'Нийтлэл'}
      </span>
    </div>
  )
}

function Meta({ post }) {
  return (
    <div className="flex items-center gap-4 text-xs text-gray-500">
      <span className="inline-flex items-center gap-1">
        <FiCalendar size={12} /> {formatDate(post.date)}
      </span>
      <span className="inline-flex items-center gap-1">
        <FiClock size={12} /> {post.duration}
      </span>
    </div>
  )
}

// featured=true → онцлох (2 баганат том), эс бөгөөс энгийн жагсаалтын карт.
export default function PostCard({ post, featured = false, delay = 0 }) {
  const ref = useReveal()
  const base =
    'border border-gray-200 bg-white hover:border-emerald-300 hover:shadow-lg ' +
    'transition-all duration-300 opacity-0 translate-y-8'

  if (featured) {
    return (
      <article ref={ref} className={`grid md:grid-cols-2 ${base}`}>
        <Thumb type={post.type} large />
        <div className="p-6 sm:p-7 lg:p-9 flex flex-col">
          <span className="self-start mb-4 px-2.5 py-1 bg-emerald-600 text-white
                           text-[10px] font-bold uppercase tracking-widest">
            Онцлох
          </span>
          <p className="text-emerald-700 text-xs font-semibold uppercase tracking-widest m-0">
            {post.category}
          </p>
          <h2 className="mt-3 text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 leading-tight m-0">
            {post.title}
          </h2>
          <p className="mt-4 text-gray-600 leading-relaxed m-0">{post.excerpt}</p>
          <div className="mt-auto pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-800 m-0">{post.author}</p>
              <div className="mt-1"><Meta post={post} /></div>
            </div>
            <Link
              href="#"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 shrink-0
                         bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
            >
              {actionLabel(post.type)} <FiArrowRight size={16} />
            </Link>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`group flex flex-col hover:-translate-y-1 ${base}`}
    >
      <Thumb type={post.type} />
      <div className="p-5 flex flex-col flex-1">
        <p className="text-emerald-700 text-[11px] font-semibold uppercase tracking-widest m-0">
          {post.category}
        </p>
        <h3 className="mt-2 text-lg font-bold text-gray-900 leading-snug m-0
                       group-hover:text-emerald-700 transition-colors">
          {post.title}
        </h3>
        <p className="mt-2 text-sm text-gray-500 leading-relaxed m-0 line-clamp-3">
          {post.excerpt}
        </p>
        <div className="mt-auto pt-4 flex items-center justify-between gap-3 border-t border-gray-100">
          <Meta post={post} />
          <Link
            href="#"
            aria-label={`${post.title} — ${actionLabel(post.type)}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700
                       hover:text-emerald-800 transition-colors shrink-0"
          >
            {actionLabel(post.type)} <FiChevronRight size={15} />
          </Link>
        </div>
      </div>
    </article>
  )
}
