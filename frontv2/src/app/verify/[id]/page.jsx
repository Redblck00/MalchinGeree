'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import api from '@/lib/api'

const STATUS_LABEL = {
  DRAFT: 'Ноорог', SENT: 'Илгээгдсэн',
  PARTIALLY_SIGNED: 'Хагас зурсан', FULLY_SIGNED: 'Бүрэн зурсан',
  COMPLETED: 'Баталгаажсан', DECLINED: 'Татгалзсан',
  CANCELLED: 'Цуцлагдсан', EXPIRED: 'Хугацаа дууссан',
}

const ROLE_LABEL = {
  CREATOR: 'Үүсгэгч', COUNTERPARTY: 'Нөгөө тал', WITNESS: 'Гэрч',
}

export default function VerifyPage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    api.get(`/public/verify/${id}`)
      .then(res => setData(res.data.data || res.data))
      .catch(err => setError(err.response?.data?.message || 'Гэрээ олдсонгүй'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-2 border-gray-200 border-t-[#3d3a8c] rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="bg-white rounded-2xl shadow-md max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto text-3xl">
            ✕
          </div>
          <h1 className="text-xl font-bold text-gray-900 mt-4 mb-2 m-0">Гэрээ олдсонгүй</h1>
          <p className="text-sm text-gray-500 m-0">{error || 'Хүчингүй ID'}</p>
        </div>
      </div>
    )
  }

  const { contract, participants, verification } = data
  const overallValid = verification.is_completed
    && verification.has_blockchain
    && verification.chain_valid
    && verification.hash_match

  // Testnet explorer-ийн суурь хаяг (default: Polygon Amoy).
  // Сүлжээ солих бол NEXT_PUBLIC_BLOCKCHAIN_EXPLORER-ээр дарж бичнэ.
  const blockchainExplorer =
    process.env.NEXT_PUBLIC_BLOCKCHAIN_EXPLORER || 'https://amoy.polygonscan.com'

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-6">
      <div className="max-w-3xl mx-auto">

        {/* ── Header banner ─────────────────────── */}
        <div className={`rounded-2xl p-8 mb-6 text-white shadow-lg
          ${overallValid
            ? 'bg-linear-to-br from-emerald-500 to-emerald-700'
            : 'bg-linear-to-br from-orange-500 to-red-600'}`}>
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-3xl">
              {overallValid ? '✓' : '⚠'}
            </div>
            <div>
              <h1 className="text-2xl font-bold m-0">
                {overallValid
                  ? 'Гэрээ хүчин төгөлдөр'
                  : verification.is_completed
                    ? 'Шалгалт амжилтгүй'
                    : 'Баталгаажаагүй гэрээ'}
              </h1>
              <p className="text-white/80 text-sm m-0 mt-1">
                {overallValid
                  ? 'Blockchain дээр баталгаажиж, агуулга өөрчлөгдөөгүй'
                  : 'Гэрээ хараахан баталгаажаагүй эсвэл агуулга өөрчлөгдсөн байж болзошгүй'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Гэрээний мэдээлэл ──────────────── */}
        <Section title="Гэрээний мэдээлэл">
          <Field label="Гэрээний дугаар">
            <span className="font-mono text-[#3d3a8c] font-semibold">
              {contract.contract_number || '—'}
            </span>
          </Field>
          <Field label="Гарчиг">{contract.title || '—'}</Field>
          <Field label="Загвар">{contract.template_name || '—'}</Field>
          <Field label="Үүсгэгч">{contract.creator_name || '—'}</Field>
          <Field label="Статус">
            <Badge color={contract.status === 'COMPLETED' ? 'green' : 'gray'}>
              {STATUS_LABEL[contract.status] || contract.status}
            </Badge>
          </Field>
          <Field label="Баталгаажсан огноо">
            {contract.completed_at
              ? new Date(contract.completed_at).toLocaleString('mn-MN')
              : '—'}
          </Field>
        </Section>

        {/* ── Оролцогчид ────────────────────── */}
        <Section title="Оролцогчид">
          <div className="flex flex-col gap-2">
            {participants.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                <div>
                  <p className="text-sm font-medium text-gray-900 m-0">{p.name}</p>
                  <p className="text-xs text-gray-500 m-0">{ROLE_LABEL[p.role] || p.role}</p>
                </div>
                <Badge color={p.status === 'SIGNED' ? 'green' : 'gray'}>
                  {p.status === 'SIGNED' ? '✓ Зурсан' : p.status}
                </Badge>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Blockchain мэдээлэл ──────────── */}
        <Section title="⛓ Blockchain баталгаажуулалт">
          {verification.has_blockchain && verification.block ? (
            <>
              <CheckRow ok={verification.chain_valid}>
                Block hash тооцоо зөв
                {verification.chain_valid
                  ? ' — өгөгдөл өөрчлөгдөөгүй'
                  : ' — өгөгдөл өөрчлөгдсөн!'}
              </CheckRow>
              <CheckRow ok={verification.hash_match}>
                Контракт hash таарч байна
                {!verification.hash_match && ' — версийн hash зөрчилтэй'}
              </CheckRow>

              <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-gray-100">
                <Field label="Block №">
                  <span className="font-mono font-semibold text-[#3d3a8c]">
                    #{verification.block.block_number}
                  </span>
                </Field>
                <Field label="Бүртгэсэн огноо">
                  {new Date(verification.block.timestamp).toLocaleString('mn-MN')}
                </Field>
              </div>

              <HashField label="Block hash"     value={verification.block.block_hash} />
              <HashField label="Previous hash"  value={verification.block.previous_hash} />
              <HashField label="Contract hash"  value={verification.block.contract_hash} />

              {verification.block.onchain_tx_hash ? (
                <a
                  href={`${blockchainExplorer}/tx/${verification.block.onchain_tx_hash}`}
                  target="_blank" rel="noopener"
                  className="inline-block mt-4 text-xs text-[#3d3a8c] font-semibold hover:underline"
                >
                  {(verification.block.onchain_network || 'Testnet')} explorer-аар үзэх ↗
                </a>
              ) : (
                <p className="mt-4 text-[11px] text-gray-400 italic m-0">
                  Дотоод hash chain (off-chain) дээр баталгаажсан.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 italic m-0">
              Энэ гэрээ хараахан blockchain дээр бүртгэгдээгүй байна.
            </p>
          )}
        </Section>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          E-Geree — цахим гэрээний систем · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// SUBCOMPONENTS
// ══════════════════════════════════════════════════════

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4 m-0">
        {title}
      </h2>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1 mb-3">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm text-gray-900">{children}</span>
    </div>
  )
}

function HashField({ label, value }) {
  return (
    <div className="flex flex-col gap-1 mb-3">
      <span className="text-xs text-gray-400">{label}</span>
      <code className="text-[11px] text-gray-700 bg-gray-50 px-3 py-2 rounded-lg break-all font-mono">
        {value || '—'}
      </code>
    </div>
  )
}

function Badge({ color = 'gray', children }) {
  const colors = {
    green: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    gray:  'bg-gray-100 text-gray-600 border border-gray-200',
  }
  return (
    <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  )
}

function CheckRow({ ok, children }) {
  return (
    <div className="flex items-start gap-2 mb-2">
      <span className={`shrink-0 ${ok ? 'text-emerald-600' : 'text-red-500'}`}>
        {ok ? '✓' : '✕'}
      </span>
      <span className={`text-sm ${ok ? 'text-gray-800' : 'text-red-700'}`}>
        {children}
      </span>
    </div>
  )
}
