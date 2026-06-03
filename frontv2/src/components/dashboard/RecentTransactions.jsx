'use client'
import LivestockIcon from '@/components/dashboard/LivestockIcon'
import { formatMoney } from '@/lib/dashboardFormat'

// Сүүлийн гүйлгээнүүд — mobile: card list, desktop: table
export default function RecentTransactions({ rows, role, onOpen }) {
  const otherLabel = role === 'buyer' ? 'Худалдагч' : 'Худалдан авагч'

  return (
    <>
      {/* Mobile: card list */}
      <ul className="md:hidden flex flex-col gap-2 -mx-1">
        {rows.map(r => {
          const otherName = [r.other_last_name, r.other_first_name].filter(Boolean).join(' ') || '—'
          return (
            <li key={r.transaction_id}>
              <button
                type="button"
                onClick={() => onOpen(r.contract_id)}
                className="w-full text-left p-3 rounded-lg border border-gray-100
                           hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <LivestockIcon type={r.livestock_type} size={18} className="text-emerald-700 shrink-0" />
                    <span className="capitalize font-semibold text-gray-900 truncate">{r.livestock_type}</span>
                  </span>
                  <span className="text-sm font-bold text-gray-900 shrink-0">{r.count} толгой</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                  <span>{new Date(r.transaction_date).toLocaleDateString('mn-MN')}</span>
                  <span className="font-semibold text-gray-700">{formatMoney(r.total_amount)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="text-gray-600">
                    <span className="text-gray-400">{otherLabel}: </span>{otherName}
                  </span>
                  <span className="text-emerald-700 font-mono">{r.contract_number}</span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto -mx-4 sm:-mx-5">
        <table className="w-full text-sm min-w-[36rem]">
          <thead>
            <tr className="text-xs text-gray-400 uppercase">
              <th className="text-left px-4 sm:px-5 py-2 font-medium">Огноо</th>
              <th className="text-left px-2 py-2 font-medium">Мал</th>
              <th className="text-right px-2 py-2 font-medium">Тоо</th>
              <th className="text-right px-2 py-2 font-medium">Үнэ</th>
              <th className="text-left px-2 py-2 font-medium">{otherLabel}</th>
              <th className="text-left px-4 sm:px-5 py-2 font-medium">Гэрээ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const otherName = [r.other_last_name, r.other_first_name].filter(Boolean).join(' ') || '—'
              return (
                <tr
                  key={r.transaction_id}
                  onClick={() => onOpen(r.contract_id)}
                  className="border-t border-gray-100 cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-4 sm:px-5 py-3 text-gray-500 text-xs">
                    {new Date(r.transaction_date).toLocaleDateString('mn-MN')}
                  </td>
                  <td className="px-2 py-3 text-gray-900">
                    <span className="inline-flex items-center gap-1.5">
                      <LivestockIcon type={r.livestock_type} size={16} className="text-emerald-700" />
                      <span className="capitalize">{r.livestock_type}</span>
                    </span>
                  </td>
                  <td className="px-2 py-3 text-right font-semibold text-gray-900">{r.count}</td>
                  <td className="px-2 py-3 text-right text-gray-700">{formatMoney(r.total_amount)}</td>
                  <td className="px-2 py-3 text-gray-700">{otherName}</td>
                  <td className="px-4 sm:px-5 py-3 text-xs text-emerald-700 font-mono">{r.contract_number}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
