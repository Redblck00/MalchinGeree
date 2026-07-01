import { FiBookOpen } from 'react-icons/fi'

// Хуудасны emerald hero band (хурц ирмэг). pt нь navbar-ыг гаргана.
export default function LawHero() {
  return (
    <section className="relative overflow-hidden pt-24 sm:pt-28 pb-12 sm:pb-16 px-5 sm:px-6
                        bg-linear-to-br from-emerald-500 via-emerald-600 to-emerald-800">
      <div className="absolute -right-20 -top-20 w-96 h-96 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute -left-24 bottom-0 w-80 h-80 rounded-full bg-white/5 pointer-events-none" />

      <div className="relative max-w-6xl mx-auto">
        <span className="inline-flex items-center gap-2 mb-5 px-3 py-1 bg-white/15 backdrop-blur-sm
                         border border-white/30 text-white text-[11px] font-semibold tracking-widest uppercase">
          <FiBookOpen size={13} /> Хуулийн булан
        </span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight m-0 max-w-3xl">
          Малчдад зориулсан <span className="text-emerald-100">эрх зүйн мэдлэг</span>
        </h1>
        <p className="mt-4 sm:mt-5 text-emerald-50/90 text-base sm:text-lg leading-relaxed max-w-2xl m-0">
          Гэрээ байгуулах, цахим гарын үсэг, бэлчээр ашиглалт болон маргаан шийдвэрлэлийн
          талаарх видео хичээл, нийтлэлүүд — хуульчдын бэлтгэсэн найдвартай мэдээлэл.
        </p>
      </div>
    </section>
  )
}
