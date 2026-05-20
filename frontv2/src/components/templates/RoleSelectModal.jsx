'use client'
import { useState } from 'react'

// Template сонгосны дараа гарч ирэх modal
// Хэрэглэгч худалдагч уу, худалдан авагч уу гэдгээ сонгоно
export default function RoleSelectModal({ template, onClose, onSelect }) {
  const [role, setRole] = useState('seller')

  if (!template) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-900 m-0">
              Та энэ гэрээнд ямар талаас орох вэ?
            </h2>
            <p className="text-xs text-gray-500 mt-1 m-0 truncate">
              {template.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none ml-3
                       cursor-pointer bg-transparent border-0"
            aria-label="Хаах"
          >
            ×
          </button>
        </div>

        {/* Role options */}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <RoleOption
            selected={role === 'seller'}
            onClick={() => setRole('seller')}
            icon={
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l1-5h16l1 5"/>
                <path d="M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/>
                <path d="M9 21V13h6v8"/>
              </svg>
            }
            title="Худалдагч"
            subtitle="Малаа зарж байна"
          />
          <RoleOption
            selected={role === 'buyer'}
            onClick={() => setRole('buyer')}
            icon={
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/>
                <circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>
              </svg>
            }
            title="Худалдан авагч"
            subtitle="Мал авч байна"
          />
        </div>

        {/* Footer */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm text-gray-600 border border-gray-200
                       rounded-xl hover:bg-gray-50 cursor-pointer bg-white"
          >
            Цуцлах
          </button>
          <button
            onClick={() => onSelect(role)}
            className="flex-1 px-4 py-2.5 text-sm text-white bg-[#3d3a8c]
                       rounded-xl hover:bg-[#2d2a6e] cursor-pointer border-0"
          >
            Үргэлжлүүлэх
          </button>
        </div>
      </div>
    </div>
  )
}

function RoleOption({ selected, onClick, icon, title, subtitle }) {
  return (
    <button
      onClick={onClick}
      className={`p-5 rounded-xl border-2 flex flex-col items-center gap-2 transition-all
                  cursor-pointer text-left
                  ${selected
                    ? 'border-[#3d3a8c] bg-[#3d3a8c]/5 text-[#3d3a8c]'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
    >
      <div className={selected ? 'text-[#3d3a8c]' : 'text-gray-400'}>
        {icon}
      </div>
      <span className="text-sm font-semibold">{title}</span>
      <span className={`text-xs ${selected ? 'text-[#3d3a8c]/70' : 'text-gray-400'}`}>
        {subtitle}
      </span>
    </button>
  )
}
