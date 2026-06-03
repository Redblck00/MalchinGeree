'use client'

// ══════════════════════════════════════════════════════
// KpiCard — dashboard-ийн нэгж KPI метрик карт
//
// Дэвсгэр: ногоон → уусмал цагаан (teal-tinted white) зөөлөн градиент.
// icon нь JSX element-ээр дамжина (currentColor өвлөж emerald болно).
//
// Props:
//   label  — доод тайлбар (жишээ: "Худалдсан мал")
//   value  — гол утга (тоо эсвэл format хийсэн мөнгө)
//   unit   — value-н ард жижиг нэгж (сонголттой, жишээ: "толгой")
//   icon   — <Icon size={26} /> JSX element
// ══════════════════════════════════════════════════════
export default function KpiCard({ label, value, unit, icon }) {
  return (
    <div className="relative overflow-hidden p-4 sm:p-5 shadow-sm border border-emerald-100
                    bg-linear-to-br from-emerald-50 via-white to-teal-50
                    text-emerald-900">
      {/* Decorative circles — зөөлөн teal tint */}
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-emerald-100/50" />
      <div className="absolute -right-2 -bottom-8 w-20 h-20 rounded-full bg-teal-100/40" />

      <div className="relative flex items-start justify-between mb-2">
        <span className="w-11 h-11 rounded-xl flex items-center justify-center
                         bg-emerald-100 text-emerald-600">
          {icon}
        </span>
      </div>
      <p className="relative text-xl sm:text-2xl font-bold m-0 text-emerald-900">
        {value}
        {unit && <span className="text-sm font-normal text-emerald-600/80 ml-1">{unit}</span>}
      </p>
      <p className="relative text-xs text-emerald-700/80 mt-1 m-0">{label}</p>
    </div>
  )
}
