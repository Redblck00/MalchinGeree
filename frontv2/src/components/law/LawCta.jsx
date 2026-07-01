import Link from 'next/link'
import { FiArrowRight } from 'react-icons/fi'

// Доод CTA band — загвар руу / бүртгэл рүү (хурц ирмэг).
export default function LawCta() {
  return (
    <section className="relative overflow-hidden bg-linear-to-br from-emerald-500 via-emerald-600 to-emerald-800
                        px-6 py-10 sm:py-12 text-center">
      <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 pointer-events-none" />

      <div className="relative max-w-xl mx-auto">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white m-0">
          Гэрээгээ хуулийн дагуу баталгаажуулаарай
        </h2>
        <p className="mt-3 text-emerald-50/90 leading-relaxed m-0">
          Бэлэн загвар ашиглан, цахим гарын үсгээр хүчин төгөлдөр гэрээ хормын дотор байгуулна.
        </p>
        <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/templates"
            className="inline-flex items-center justify-center gap-2 px-6 py-3
                       bg-white text-emerald-700 font-semibold hover:bg-emerald-50 transition-colors"
          >
            Загварууд харах <FiArrowRight size={16} />
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center px-6 py-3
                       border border-white/60 text-white font-semibold hover:bg-white/10 transition-colors"
          >
            Бүртгүүлэх
          </Link>
        </div>
      </div>
    </section>
  )
}
