"use client"
import { useState, useRef, useEffect } from 'react'

const STEP = { SELECT: 'select', DRAW: 'draw', AUTO: 'auto' }

function DrawOptionIllustration() {
  return (
    <svg viewBox="0 0 200 110" fill="none" className="w-full h-full">
      <path d="M20 75 C35 30, 60 80, 78 50 C88 33, 100 60, 118 42"
        stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(128, 18) rotate(25)">
        <rect x="-6" y="0" width="12" height="34" rx="3" fill="#1d4ed8" />
        <rect x="-6" y="0" width="12" height="9" rx="3" fill="#1e3a8a" />
        <polygon points="-6,34 6,34 0,48" fill="#2563eb" />
        <circle cx="0" cy="50" r="2.5" fill="#3b82f6" />
      </g>
    </svg>
  )
}

function AutoOptionIllustration() {
  return (
    <svg viewBox="0 0 200 110" fill="none" className="w-full h-full">
      <path d="M18 72 C33 30, 57 78, 74 50 C84 34, 95 58, 112 42"
        stroke="#d1d5db" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="122" y="18" width="58" height="68" rx="6" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="2" />
      <path d="M132 45 C136 35, 143 50, 148 40 C152 33, 156 44, 162 38"
        stroke="#d1d5db" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="132" y="62" width="28" height="3" rx="1.5" fill="#e5e7eb" />
      <rect x="136" y="70" width="20" height="3" rx="1.5" fill="#e5e7eb" />
    </svg>
  )
}

function SelectStep({ onSelect, onClose }) {
  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-xl font-semibold text-gray-900">Гарын үсэг үүсгэх</h3>
        <button onClick={onClose} className="ml-4 text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
      </div>
      <p className="text-sm text-gray-500 leading-relaxed mb-8">
        Та дараах хоёр аргаас өөрт тохиромжтойгоор гарын үсгээ үүсгэнэ үү.
      </p>
      <div className="grid grid-cols-2 gap-5">
        <button onClick={() => onSelect(STEP.DRAW)}
          className="border-2 border-gray-200 p-5 flex flex-col items-center gap-3 hover:border-blue-400 hover:shadow-md transition-all text-left">
          <div className="w-full h-28"><DrawOptionIllustration /></div>
          <span className="text-sm font-semibold text-gray-800 self-start">Зурах</span>
          <span className="text-xs text-gray-400 self-start">Хулганаар гарын үсгээ зурж болно</span>
        </button>
        <button onClick={() => onSelect(STEP.AUTO)}
          className="border-2 border-gray-200 p-5 flex flex-col items-center gap-3 hover:border-blue-400 hover:shadow-md transition-all text-left">
          <div className="w-full h-28"><AutoOptionIllustration /></div>
          <span className="text-sm font-semibold text-gray-800 self-start">Системээр үүсгэх</span>
          <span className="text-xs text-gray-400 self-start">Таны нэрээр автоматаар үүсгэнэ</span>
        </button>
      </div>
    </div>
  )
}

function DrawStep({ onBack, onClose, onSave, loading }) {
  const canvasRef = useRef(null)
  const drawing   = useRef(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1e1b4b'
    ctx.lineWidth   = 2.5
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
  }, [])

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const src  = e.touches ? e.touches[0] : e
    return {
      x: (src.clientX - rect.left) * (canvas.width / rect.width),
      y: (src.clientY - rect.top)  * (canvas.height / rect.height),
    }
  }

  const startDraw = (e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    const pos    = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    drawing.current = true
    setHasDrawn(true)
  }

  const draw = (e) => {
    e.preventDefault()
    if (!drawing.current) return
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    const pos    = getPos(e, canvas)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  const stopDraw = () => { drawing.current = false }

  const handleClear = () => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-gray-400 hover:text-gray-700 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-base font-semibold text-gray-900">Гарын үсэг зурах</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
      </div>
      <p className="text-xs text-gray-400 mb-3">Доорх хэсэгт гарын үсгээ зур</p>
      <canvas ref={canvasRef} width={560} height={240}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
        className="w-full border-2 border-dashed border-gray-300 cursor-crosshair touch-none bg-white" />
      <div className="flex items-center justify-between mt-4">
        <button onClick={handleClear}
          className="px-4 py-2 text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">
          Арилгах
        </button>
        <div className="flex gap-2">
          <button onClick={onBack}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">
            Цуцлах
          </button>
          <button
            onClick={() => onSave(canvasRef.current.toDataURL('image/png'), 'DRAW')}
            disabled={!hasDrawn || loading}
            className="px-5 py-2 text-sm text-white bg-[#1e1b4b] hover:bg-[#2d2a6e] disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? 'Хадгалж байна...' : 'Хадгалах'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AutoStep({ onBack, onClose, onSave, userName, loading }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    ctx.fillStyle    = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.font         = 'italic bold 52px Georgia, "Times New Roman", serif'
    ctx.fillStyle    = '#1e1b4b'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(userName || 'Гарын үсэг', canvas.width / 2, canvas.height / 2)
    ctx.beginPath()
    ctx.moveTo(canvas.width * 0.15, canvas.height * 0.72)
    ctx.lineTo(canvas.width * 0.85, canvas.height * 0.72)
    ctx.strokeStyle = '#1e1b4b'
    ctx.lineWidth   = 1.5
    ctx.stroke()
  }, [userName])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-gray-400 hover:text-gray-700 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-base font-semibold text-gray-900">Автомат гарын үсэг</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
      </div>
      <p className="text-xs text-gray-400 mb-3">Таны нэрээр автоматаар үүсгэсэн гарын үсэг</p>
      <canvas ref={canvasRef} width={560} height={180}
        className="w-full border-2 border-dashed border-gray-300 bg-white" />
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onBack}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">
          Цуцлах
        </button>
        <button
          onClick={() => onSave(canvasRef.current.toDataURL('image/png'), 'AUTO')}
          disabled={loading}
          className="px-5 py-2 text-sm text-white bg-[#1e1b4b] hover:bg-[#2d2a6e] disabled:opacity-40">
          {loading ? 'Хадгалж байна...' : 'Хадгалах'}
        </button>
      </div>
    </div>
  )
}

export default function SignatureModal({ onClose, onSave, userName = '', loading = false }) {
  const [step, setStep] = useState(STEP.SELECT)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white shadow-xl w-full max-w-2xl">
        {step === STEP.SELECT && <SelectStep onSelect={setStep} onClose={onClose} />}
        {step === STEP.DRAW   && <DrawStep onBack={() => setStep(STEP.SELECT)} onClose={onClose} onSave={onSave} loading={loading} />}
        {step === STEP.AUTO   && <AutoStep onBack={() => setStep(STEP.SELECT)} onClose={onClose} onSave={onSave} userName={userName} loading={loading} />}
      </div>
    </div>
  )
}