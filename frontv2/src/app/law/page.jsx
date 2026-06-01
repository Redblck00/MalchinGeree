'use client'
import Link from 'next/link'
import { FiBookOpen, FiArrowLeft } from 'react-icons/fi'

// ── Хууль — vlog хуудас (дараа хөгжүүлэх) ─────────────
// Энэ хуудас одоогоор placeholder. Малчны хууль эрх зүйн боловсрол
// олгох video/vlog контент дараа нэмэгдэнэ.
export default function LawPage() {
  return (
    <div className="min-h-screen pt-16 bg-linear-to-br from-emerald-50 via-white to-emerald-50/40
                    flex items-center justify-center px-6 py-16">
      <div className="relative max-w-lg w-full">
        {/* Decorative blobs */}
        <div className="absolute -top-12 -left-12 w-40 h-40 rounded-full bg-emerald-200/40 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-12 w-48 h-48 rounded-full bg-emerald-300/30 blur-3xl pointer-events-none" />

        <div className="relative bg-white rounded-3xl shadow-xl border border-emerald-100/60
                        p-10 text-center">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto rounded-2xl bg-linear-to-br from-emerald-400 to-emerald-600
                          flex items-center justify-center mb-6 shadow-lg">
            <FiBookOpen size={28} className="text-white" />
          </div>

          {/* Badge */}
          <span className="inline-block mb-4 px-3 py-1 rounded-full
                           bg-emerald-50 border border-emerald-200
                           text-emerald-700 text-[10px] font-semibold tracking-widest uppercase">
            Тун удахгүй
          </span>

          {/* Title */}
          <h1 className="text-3xl font-extrabold text-gray-900 m-0 mb-3 leading-tight">
            Хуулийн булан
          </h1>

          {/* Description */}
          <p className="text-sm text-gray-600 leading-relaxed m-0 mb-8">
            Малчдын эрх ашиг, гэрээний хууль эрх зүй, харилцагч талуудын
            үүрэг хариуцлагын тухай видео хичээл, нийтлэлүүд эндээс үзэх
            боломжтой болно. Бид одоо контент бэлдэж байна.
          </p>

          {/* Back action */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5
                       bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold
                       rounded-xl transition-colors"
          >
            <FiArrowLeft size={16} />
            Нүүр хуудас
          </Link>
        </div>
      </div>
    </div>
  )
}
