'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { MdAdd, MdRemove, MdFitScreen, MdKeyboardArrowDown } from 'react-icons/md'
import api from '@/lib/api'
import useAuthStore from '@/app/store/authStore'
import useContractDownload from '@/lib/useContractDownload'
import ContractHeader from '@/components/contracts/ContractHeader'
import ContractSidebar from '@/components/contracts/ContractSidebar'
import ContractForm from '@/components/contracts/ContractForm'
import ContractA4Document from '@/components/contracts/ContractA4Document'
import RatingModal from '@/components/contracts/RatingModal'
import CloseContractModal from '@/components/contracts/CloseContractModal'

const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]

export default function ContractDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id     = params.id

  const { user, restoreAuth } = useAuthStore()
  const contentRef = useRef(null)
  const scrollRef  = useRef(null)

  // Viewer state — zoom + page tracking
  const [zoom,        setZoom]        = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageCount,   setPageCount]   = useState(1)

  const [contract,        setContract]        = useState(null)
  const [template,        setTemplate]        = useState(null)
  const [savedSignature,  setSavedSignature]  = useState(null)
  const [loading,         setLoading]         = useState(true)
  const [signing,         setSigning]         = useState(false)
  const [sending,         setSending]         = useState(false)
  const [confirming,      setConfirming]      = useState(false)
  const [editing,         setEditing]         = useState(false)
  const [submittingEdit,  setSubmittingEdit]  = useState(false)
  const [closing,         setClosing]         = useState(false)
  const [closeModalOpen,  setCloseModalOpen]  = useState(false)
  const [ratingModalOpen, setRatingModalOpen] = useState(false)
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [contractRatings, setContractRatings] = useState([])
  const [error,           setError]           = useState(null)
  const [success,         setSuccess]         = useState(null)

  useEffect(() => { restoreAuth() }, [restoreAuth])

  const fetchContract = useCallback(async () => {
    try {
      const res = await api.get(`/contracts/${id}`)
      setContract(res.data.data || res.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Гэрээ олдсонгүй')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { if (id) fetchContract() }, [id, fetchContract])

  useEffect(() => {
    if (!contract?.template_id || template) return
    api.get(`/contracts/templates/${contract.template_id}`)
      .then(res => setTemplate(res.data.data || res.data))
      .catch(() => {})
  }, [contract?.template_id, template])

  useEffect(() => {
    api.get('/users/signatures')
      .then(res => {
        const list = res.data.data || res.data || []
        const def = list.find(s => s.is_default) || list[0]
        if (def) setSavedSignature(def)
      })
      .catch(() => {})
  }, [])

  // ── Гарын үсэг зурах ──────────────────────────────
  const handleSign = async (blob, type = 'DRAW') => {
    if (!contract) return
    const role      = contract.creator_role || 'seller'
    const isCreator = contract.creator_id === user?.user_id
    const myRoleKey = isCreator
      ? role
      : (role === 'seller' ? 'buyer' : 'seller')
    const placeholder_key = `${myRoleKey}.signature`

    setSigning(true)
    setError(null)
    try {
      await api.post(`/contracts/${id}/sign`, { signature_blob: blob, placeholder_key })

      if (!savedSignature) {
        try {
          const res = await api.post('/users/signatures', {
            signature_blob: blob, signature_type: type || 'DRAW', is_default: true,
          })
          const saved = res.data.data || res.data
          setSavedSignature({
            ...(saved || {}),
            signature_blob: blob,
            signature_type: type || 'DRAW',
            is_default:     true,
          })
        } catch (_) { /* main flow OK */ }
      }

      setSuccess('Гарын үсэг зурагдлаа')
      await fetchContract()
    } catch (err) {
      setError(err.response?.data?.message || 'Гарын үсэг зурахад алдаа гарлаа')
    } finally {
      setSigning(false)
    }
  }

  const handleSend = async (email) => {
    setSending(true)
    setError(null)
    try {
      await api.post(`/contracts/${id}/send`, {
        participants: [{ role: 'COUNTERPARTY', email }],
      })
      setSuccess('Гэрээ амжилттай илгээгдлээ')
      await fetchContract()
    } catch (err) {
      setError(err.response?.data?.message || 'Илгээхэд алдаа гарлаа')
      throw err
    } finally {
      setSending(false)
    }
  }

  const handleConfirm = async () => {
    setConfirming(true)
    setError(null)
    try {
      await api.post(`/contracts/${id}/confirm`)
      setSuccess('Гэрээ амжилттай баталгаажлаа')
      await fetchContract()
    } catch (err) {
      setError(err.response?.data?.message || 'Баталгаажуулахад алдаа гарлаа')
    } finally {
      setConfirming(false)
    }
  }

  // ── Гэрээг хаах (COMPLETED → CLOSED) ───────────────
  const handleClose = async ({ reason }) => {
    setClosing(true)
    setError(null)
    try {
      await api.post(`/contracts/${id}/close`, { reason })
      setSuccess('Гэрээ хаагдлаа')
      setCloseModalOpen(false)
      await fetchContract()
    } catch (err) {
      setError(err.response?.data?.message || 'Хаахад алдаа гарлаа')
    } finally {
      setClosing(false)
    }
  }

  // ── Гэрээний бүх үнэлгээг татах (CLOSED үед) ───────
  const fetchRatings = useCallback(async () => {
    try {
      const res = await api.get(`/contracts/${id}/ratings`)
      setContractRatings(res.data.data || [])
    } catch (_) { setContractRatings([]) }
  }, [id])

  useEffect(() => {
    if (contract?.status === 'CLOSED') fetchRatings()
  }, [contract?.status, fetchRatings])

  // ── Үнэлгээ илгээх (UPSERT) ───────────────────────
  const handleSubmitRating = async ({ rating, comment }) => {
    // Counterparty-ийн user_id-г олох
    const myUid = user?.user_id
    const other = (contract.participants || []).find(p =>
      p.user_id && p.user_id !== myUid && p.role !== 'WITNESS'
    )
    if (!other?.user_id) {
      throw new Error('Үнэлэх хүн олдсонгүй')
    }
    setRatingSubmitting(true)
    try {
      await api.post(`/contracts/${id}/ratings`, {
        rated_user_id: other.user_id,
        rating,
        comment,
      })
      setSuccess('Үнэлгээ хадгалагдлаа')
      setRatingModalOpen(false)
      await fetchRatings()
    } finally {
      setRatingSubmitting(false)
    }
  }

  // Миний өөрийн үнэлгээ (засах боломжтой)
  const myRating = contractRatings.find(r => r.rater_id === user?.user_id)

  // Нөгөө тал — кого үнэлэх вэ
  const ratedTarget = (contract?.participants || []).find(p =>
    p.user_id && p.user_id !== user?.user_id && p.role !== 'WITNESS'
  )

  // Save = зөвхөн хадгална (өөрчлөлт DB-д үлдэнэ, нөгөө тал руу автоматаар явахгүй).
  // Илгээх нь тусдаа товчоор (BottomAction-ийн "Илгээх") хийгдэнэ.
  const handleEditSubmit = async (formData) => {
    if (!contract) return
    setSubmittingEdit(true)
    setError(null)
    try {
      await api.patch(`/contracts/${id}`, { filled_data_json: formData })
      setSuccess('Засвар хадгалагдлаа')
      setEditing(false)
      await fetchContract()
    } catch (err) {
      setError(err.response?.data?.message || 'Хадгалахад алдаа гарлаа')
    } finally {
      setSubmittingEdit(false)
    }
  }

  // ── Хавсралт upload/delete ─────────────────────────
  const [uploadingAttachment, setUploadingAttachment] = useState(false)

  const handleUploadAttachment = async (file) => {
    setUploadingAttachment(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post(`/contracts/${id}/attachments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setSuccess('Хавсралт амжилттай нэмэгдлээ')
      setTimeout(() => setSuccess(null), 3000)
      await fetchContract()
    } catch (err) {
      setError(err.response?.data?.message || 'Хавсралт нэмэхэд алдаа гарлаа')
    } finally {
      setUploadingAttachment(false)
    }
  }

  const handleDeleteAttachment = async (attachmentId) => {
    if (!confirm('Хавсралтыг устгах уу?')) return
    setError(null)
    try {
      await api.delete(`/contracts/${id}/attachments/${attachmentId}`)
      setSuccess('Хавсралт устгагдлаа')
      setTimeout(() => setSuccess(null), 3000)
      await fetchContract()
    } catch (err) {
      setError(err.response?.data?.message || 'Устгахад алдаа гарлаа')
    }
  }

  // Илгээх SENT myTurn үед — нөгөө талд буцаах (POST /return)
  const handleReturn = async () => {
    setSending(true)
    setError(null)
    try {
      await api.post(`/contracts/${id}/return`, {})
      setSuccess('Гэрээ нөгөө талд илгээгдлээ')
      await fetchContract()
    } catch (err) {
      setError(err.response?.data?.message || 'Илгээхэд алдаа гарлаа')
    } finally {
      setSending(false)
    }
  }

  // ── Download/Print ────────────────────────────────
  const { downloadPdf, downloadDocx, print, busy: downloadBusy } =
    useContractDownload({
      contentRef,
      contractNumber: contract?.contract_number,
      contractTitle:  contract?.title,
    })

  // ── Zoom controls ─────────────────────────────────
  const zoomIn = () => {
    const i = ZOOM_LEVELS.findIndex(z => z >= zoom)
    if (i < ZOOM_LEVELS.length - 1) setZoom(ZOOM_LEVELS[i + 1])
  }
  const zoomOut = () => {
    const i = ZOOM_LEVELS.findIndex(z => z >= zoom)
    if (i > 0) setZoom(ZOOM_LEVELS[i - 1])
  }
  const fitToScreen = () => {
    const containerWidth = scrollRef.current?.clientWidth || 1200
    const a4WidthPx      = 794    // 210mm @ 96dpi
    const horizontalPad  = 128    // px-16 = 64px each side
    const target  = (containerWidth - horizontalPad) / a4WidthPx
    const clamped = Math.min(2, Math.max(0.5, target))
    // ZOOM_LEVELS-ийн хамгийн ойр утга руу snap
    const nearest = ZOOM_LEVELS.reduce((a, b) =>
      Math.abs(b - clamped) < Math.abs(a - clamped) ? b : a
    )
    setZoom(nearest)
  }

  // ── Page navigation (зөвхөн scrollIntoView) ──────
  const goToPage = (n) => {
    const target = Math.min(Math.max(1, n), pageCount)
    const page = contentRef.current?.querySelector(`[data-page-num="${target}"]`)
    if (page) page.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── Current page tracking (IntersectionObserver) ──
  useEffect(() => {
    if (!contentRef.current || !scrollRef.current) return
    const pages = contentRef.current.querySelectorAll('.contract-page')
    if (pages.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        // Хамгийн их харагдаж буй хуудсыг сонгох
        let best = null
        let bestRatio = 0
        entries.forEach(entry => {
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio
            best = entry.target
          }
        })
        if (best) {
          const num = parseInt(best.dataset.pageNum, 10)
          if (num) setCurrentPage(num)
        }
      },
      { root: scrollRef.current, threshold: [0, 0.25, 0.5, 0.75, 1.0] }
    )

    pages.forEach(p => observer.observe(p))
    return () => observer.disconnect()
  }, [contract, zoom, pageCount])

  // ── UI төлвүүд ────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-[#3d3a8c] rounded-full animate-spin" />
      </div>
    )
  }
  if (!contract) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">{error || 'Гэрээ олдсонгүй'}</p>
        <button
          onClick={() => router.push('/dashboard/contracts')}
          className="mt-4 px-4 py-2 text-sm text-white bg-[#3d3a8c] rounded-lg cursor-pointer border-0"
        >
          Гэрээнүүд рүү буцах
        </button>
      </div>
    )
  }

  const renderedContent = contract.latest_version?.rendered_content || ''
  const isCreator       = contract.creator_id === user?.user_id
  const myTurn          = contract.current_turn === contract.my_role
  const canEditTop      = (contract.status === 'DRAFT' && isCreator) ||
                          (contract.status === 'SENT'  && myTurn)

  // ── Edit mode: form харуулна ─────────────────────
  if (editing && template) {
    return (
      <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
        <ContractHeader
          contract={contract}
          onEdit={() => {}}
          onPdf={downloadPdf}
          onDocx={downloadDocx}
          onPrint={print}
          downloadBusy={downloadBusy}
          canEdit={false}
        />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <button
                onClick={() => setEditing(false)}
                className="text-sm text-gray-500 hover:text-gray-900 mb-3 cursor-pointer
                           bg-transparent border-0 p-0"
              >
                ← Цуцлах
              </button>
              <h1 className="text-2xl font-bold text-gray-900 m-0">
                Гэрээ засварлах
              </h1>
              <p className="text-sm text-gray-500 mt-1 m-0">
                №{contract.contract_number} • {contract.title}
              </p>
              {contract.status === 'SENT' && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200
                              rounded-lg px-3 py-2 mt-3 m-0">
                  ⚠ Засварласны дараа гэрээ нөгөө талд буцаан илгээгдэнэ
                </p>
              )}
            </div>

            <ContractForm
              template={template}
              initialData={contract.filled_data_json || {}}
              creatorRole={contract.creator_role || 'seller'}
              myRole={contract.my_role || 'CREATOR'}
              user={user}
              submitting={submittingEdit}
              error={error}
              submitLabel={contract.status === 'DRAFT' ? 'Хадгалах' : 'Хадгалаад буцаах'}
              onSubmit={handleEditSubmit}
              onCancel={() => setEditing(false)}
            />
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════
  // Default view — 2 баганат layout:
  //   ┌──────────────────────────────────┬────────────────────┐
  //   │  ContractHeader (top)            │                    │
  //   ├──────────────────────────────────┤  ContractSidebar   │
  //   │  A4 Document (scrollable)        │  (full height,     │
  //   │                                  │   sharp corners,   │
  //   │                                  │   flush right)     │
  //   └──────────────────────────────────┴────────────────────┘
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">

      {/* ── Center column: header + scrollable document ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <ContractHeader
          contract={contract}
          onEdit={() => setEditing(true)}
          onPdf={downloadPdf}
          onDocx={downloadDocx}
          onPrint={print}
          onRate={() => setRatingModalOpen(true)}
          downloadBusy={downloadBusy}
          canEdit={canEditTop}
          canRate={contract.status === 'CLOSED' && !!ratedTarget}
          hasRated={!!myRating}
        />

        {/* Error/success banner */}
        {(error || success) && (
          <div className="px-6 pt-4 shrink-0">
            {success && (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200
                            rounded-lg px-3 py-2 m-0">
                {success}
              </p>
            )}
            {error && !success && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200
                            rounded-lg px-3 py-2 m-0">
                {error}
              </p>
            )}
          </div>
        )}

        {/* A4 document viewer area — DocuSign-style */}
        <div className="flex-1 relative overflow-hidden">
          {/* Scrollable workspace */}
          <div
            ref={scrollRef}
            className="absolute inset-0 overflow-auto bg-gray-300/70 px-16 py-12"
          >
            <div ref={contentRef}>
              <ContractA4Document
                htmlContent={renderedContent}
                qrCodeUrl={contract.latest_version?.qr_code_url || null}
                contractNumber={contract.contract_number}
                attachments={contract.attachments || []}
                zoom={zoom}
                onPageCountChange={setPageCount}
              />
            </div>
          </div>

          {/* ── Floating: Хуудас: N (top-left) ── */}
          <div className="absolute top-4 left-6 px-2.5 py-1
                          bg-white/85 backdrop-blur-sm rounded-md
                          text-xs text-gray-600 font-medium
                          border border-gray-200 shadow-sm
                          pointer-events-none select-none">
            Хуудас: {currentPage}
          </div>

          {/* ── Floating: zoom + nav toolbar (bottom-right) ── */}
          <div className="absolute bottom-6 right-6 flex items-stretch
                          bg-white border border-gray-200 rounded-xl shadow-lg
                          divide-x divide-gray-100 overflow-hidden">
            {currentPage < pageCount && (
              <button
                onClick={() => goToPage(currentPage + 1)}
                className="px-3.5 py-2 text-sm font-medium text-gray-700
                           hover:bg-gray-50 cursor-pointer border-0 bg-white
                           inline-flex items-center gap-1"
                title="Дараагийн хуудас"
              >
                <MdKeyboardArrowDown size={16} />
                Хуудас {currentPage + 1}
              </button>
            )}
            <button
              onClick={zoomOut}
              disabled={zoom <= ZOOM_LEVELS[0]}
              className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-0 bg-white
                         disabled:opacity-40 disabled:cursor-not-allowed
                         text-gray-700"
              title="Бууруулах"
            >
              <MdRemove size={16} />
            </button>
            <div className="px-3 py-2 text-sm font-semibold text-gray-900 min-w-14
                            text-center select-none flex items-center justify-center">
              {Math.round(zoom * 100)}%
            </div>
            <button
              onClick={zoomIn}
              disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
              className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-0 bg-white
                         disabled:opacity-40 disabled:cursor-not-allowed
                         text-gray-700"
              title="Томруулах"
            >
              <MdAdd size={16} />
            </button>
            <button
              onClick={fitToScreen}
              className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-0 bg-white
                         text-gray-700"
              title="Дэлгэцэнд тааруулах"
            >
              <MdFitScreen size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Right column: ContractSidebar (sharp corners, full height) ── */}
      <aside className="w-96 shrink-0 h-full border-l border-gray-200 print:hidden">
        <ContractSidebar
          contract={contract}
          user={user}
          savedSignature={savedSignature}
          onSign={handleSign}
          onSend={handleSend}
          onReturn={handleReturn}
          onConfirm={handleConfirm}
          onEdit={() => setEditing(true)}
          onClose={() => setCloseModalOpen(true)}
          onUploadAttachment={handleUploadAttachment}
          onDeleteAttachment={handleDeleteAttachment}
          uploadingAttachment={uploadingAttachment}
          signing={signing}
          sending={sending}
          confirming={confirming}
          closing={closing}
        />
      </aside>

      {/* ── Modals ──────────────────────────────────── */}
      <CloseContractModal
        open={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        onConfirm={handleClose}
        submitting={closing}
      />

      <RatingModal
        open={ratingModalOpen}
        onClose={() => setRatingModalOpen(false)}
        onSubmit={handleSubmitRating}
        ratedUser={ratedTarget ? {
          user_id:    ratedTarget.user_id,
          first_name: ratedTarget.first_name,
          last_name:  ratedTarget.last_name,
        } : null}
        existingRating={myRating}
        submitting={ratingSubmitting}
      />
    </div>
  )
}
