'use client'
import { MdInsertChart } from 'react-icons/md'

// Малын өгөгдөлгүй үеийн хоосон төлөв + гэрээ үүсгэх CTA
export default function EmptyState({ role, onCreate }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-12 lg:p-16 text-center">
      <MdInsertChart size={56} className="text-gray-300 mx-auto mb-3" />
      <h3 className="text-lg font-semibold text-gray-900 m-0">
        {role === 'buyer' ? 'Худалдан авсан мал байхгүй' : 'Худалдсан мал байхгүй'}
      </h3>
      <p className="text-sm text-gray-500 mt-2 mb-5 m-0">
        Гэрээ амжилттай баталгаажсаны дараа малын мэдээлэл энд харагдах болно
      </p>
      <button
        onClick={onCreate}
        className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl
                   hover:bg-emerald-700 cursor-pointer border-0"
      >
        Гэрээ үүсгэх
      </button>
    </div>
  )
}
