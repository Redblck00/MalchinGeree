'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

// Имэйлээр ирсэн линк: /invite#token=<token>
// Token-г URL fragment-д тавьсан тул server лог / Referer header / OG link
// preview-д token leak хийгдэхгүй (fragment нь client-only).
//
// Урсгал:
//   1. window.location.hash-аас token уншина (client only)
//   2. Backend POST /api/contracts/invite/:token/verify
//      → { contract_id, participant_email, has_user_account }
//   3. Нэвтэрсэн → шууд гэрээний хуудсанд
//   4. Эс нэвтэрсэн + бүртгэлтэй → /login (email pre-fill, redirect)
//   5. Эс нэвтэрсэн + бүртгэлгүй → /register (email pre-fill, redirect)
export default function InviteVerifyPage() {
  const router = useRouter()

  const [token,   setToken]   = useState(null)
  const [error,   setError]   = useState(null)
  const [working, setWorking] = useState(true)

  // 1) URL fragment-аас token уншина (зөвхөн client дээр).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash || ''
    const t = new URLSearchParams(hash.slice(1)).get('token')
    if (!t) {
      setError('Урилгын линк буруу байна')
      setWorking(false)
      return
    }
    setToken(t)
  }, [])

  // 2) Token бэлэн болсны дараа verify хийнэ.
  useEffect(() => {
    if (!token) return

    const verifyAndRedirect = async () => {
      try {
        const res = await api.post(`/contracts/invite/${token}/verify`)
        const { contract_id, participant_email, has_user_account } = res.data.data

        const isAuthed = typeof window !== 'undefined' && !!localStorage.getItem('token')
        const contractPath = `/dashboard/contracts/${contract_id}`

        if (isAuthed) {
          router.replace(contractPath)
          return
        }

        const params = new URLSearchParams({ redirect: contractPath })
        if (participant_email) params.set('email', participant_email)

        router.replace(
          has_user_account
            ? `/login?${params.toString()}`
            : `/register?${params.toString()}`
        )
      } catch (err) {
        setError(err.response?.data?.message || 'Урилгын линк хүчингүй')
        setWorking(false)
      }
    }
    verifyAndRedirect()
  }, [token, router])

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-gray-50">
      <div className="bg-white rounded-2xl shadow-md max-w-md w-full p-8 text-center">
        {working ? (
          <>
            <div className="w-10 h-10 border-2 border-gray-200 border-t-[#3d3a8c] rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-600 mt-5 m-0">Урилгыг шалгаж байна...</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto text-2xl">
              ✕
            </div>
            <h1 className="text-lg font-semibold text-gray-900 mt-4 mb-2 m-0">
              Урилга хүчингүй
            </h1>
            <p className="text-sm text-gray-500 m-0">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="mt-6 px-5 py-2.5 bg-[#3d3a8c] text-white text-sm rounded-xl
                         cursor-pointer border-0 hover:bg-[#2d2a6e]"
            >
              Нүүр хуудас
            </button>
          </>
        )}
      </div>
    </div>
  )
}
