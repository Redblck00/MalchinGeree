import { FiFileText, FiExternalLink } from 'react-icons/fi'
import { LEGAL_SOURCES } from './lawData'

// Албан ёсны эрх зүйн эх сурвалж руу гадагш холбоос (хурц ирмэг).
export default function LegalSources() {
  return (
    <section className="mt-16 sm:mt-20">
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 m-0">
          Хуулийн эх сурвалж
        </h2>
        <span className="text-sm text-gray-500 hidden sm:inline">Албан ёсны нэгдсэн сан</span>
      </div>

      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
        {LEGAL_SOURCES.map((src) => (
          <a
            key={src.label}
            href="https://legalinfo.mn"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3 sm:gap-4 p-4 sm:p-5 bg-white border border-gray-200
                       hover:border-emerald-300 hover:shadow-md transition-all"
          >
            <div className="w-11 h-11 shrink-0 flex items-center justify-center bg-emerald-50 text-emerald-700
                            group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <FiFileText size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 m-0 leading-snug">{src.label}</p>
              <p className="text-xs text-gray-500 m-0 mt-1 leading-snug">{src.note}</p>
            </div>
            <FiExternalLink
              size={16}
              className="shrink-0 mt-0.5 text-gray-300 group-hover:text-emerald-600 transition-colors"
            />
          </a>
        ))}
      </div>
    </section>
  )
}
