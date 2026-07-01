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
import ContractEditSidebar from '@/components/contracts/ContractEditSidebar'
import ContractA4Document from '@/components/contracts/ContractA4Document'
import RatingModal from '@/components/contracts/RatingModal'
import CloseContractModal from '@/components/contracts/CloseContractModal'
import CancelContractModal from '@/components/contracts/CancelContractModal'
import SignOtpModal from '@/components/contracts/SignOtpModal'
import AlertModal from '@/components/ui/AlertModal'

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
  const [editLogRefresh,  setEditLogRefresh]  = useState(0)
  const [sidebarTab,      setSidebarTab]      = useState('participants')

  // ── Sign OTP flow state ───────────────────────────
  // AcceptModal → request-otp → SignOtpModal → verify+sign
  const [signOtpModalOpen, setSignOtpModalOpen] = useState(false)
  const [pendingSignature, setPendingSignature] = useState(null)
  const [otpRequesting,    setOtpRequesting]    = useState(false)
  const [otpVerifying,     setOtpVerifying]     = useState(false)
  const [otpEmailMasked,   setOtpEmailMasked]   = useState(null)
  const [otpError,         setOtpError]         = useState(null)

  // ── Cancel modal state ───────────────────────────
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelling,      setCancelling]      = useState(false)

  // ── Mobile: гэрээ / дэлгэрэнгүй хэсгийн сэлгэлт (< lg) ──
  const [mobilePanel, setMobilePanel] = useState('doc')

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

  // ── Гарын үсэг зурах (1-р алхам: OTP хүсэлт) ──────
  // Хэрэглэгчийн нэвтэрсэн имэйл рүү OTP илгээх хүсэлт явуулна.
  // Амжилттай үед signature_blob-ыг pendingSignature-д хадгалж SignOtpModal-ийг нээнэ.
  // Реал signing нь handleVerifyOtpAndSign-д OTP оруулсны дараа явагдана.
  const handleSign = async (blob, type = 'DRAW') => {
    if (!contract) return
    const role      = contract.creator_role || 'seller'
    const isCreator = contract.creator_id === user?.user_id
    const myRoleKey = isCreator
      ? role
      : (role === 'seller' ? 'buyer' : 'seller')
    const placeholder_key = `${myRoleKey}.signature`

    setOtpRequesting(true)
    setError(null)
    setOtpError(null)
    try {
      const res = await api.post(`/contracts/${id}/sign/request-otp`)
      setOtpEmailMasked(res.data?.email_masked || null)
      setPendingSignature({ blob, type, placeholder_key })
      setSignOtpModalOpen(true)
    } catch (err) {
      setError(err.response?.data?.message || 'OTP илгээхэд алдаа гарлаа')
    } finally {
      setOtpRequesting(false)
    }
  }

  // ── 2-р алхам: OTP дахин илгээх ───────────────────
  // SignOtpModal-ийн Resend товч ашиглана. Backend нь 15 минутад 5 удаа хүртэл.
  const handleResendSignOtp = async () => {
    setOtpError(null)
    try {
      const res = await api.post(`/contracts/${id}/sign/request-otp`)
      setOtpEmailMasked(res.data?.email_masked || null)
      return true
    } catch (err) {
      setOtpError(err.response?.data?.message || 'OTP дахин илгээхэд алдаа гарлаа')
      return false
    }
  }

  // ── 3-р алхам: OTP оруулж гарын үсэг зурах ────────
  // Амжилттай үед signature_blob-ыг user_signatures-д хадгална
  // (хуучин flow-ын адил — анх удаа зурахад автоматаар default болгоно).
  const handleVerifyOtpAndSign = async (otpCode) => {
    if (!pendingSignature) return
    setOtpVerifying(true)
    setOtpError(null)
    try {
      await api.post(`/contracts/${id}/sign`, {
        signature_blob:  pendingSignature.blob,
        placeholder_key: pendingSignature.placeholder_key,
        otp_code:        otpCode,
      })

      if (!savedSignature) {
        try {
          const res = await api.post('/users/signatures', {
            signature_blob: pendingSignature.blob,
            signature_type: pendingSignature.type || 'DRAW',
            is_default:     true,
          })
          const saved = res.data.data || res.data
          setSavedSignature({
            ...(saved || {}),
            signature_blob: pendingSignature.blob,
            signature_type: pendingSignature.type || 'DRAW',
            is_default:     true,
          })
        } catch (_) { /* main flow OK */ }
      }

      setSuccess('Гарын үсэг зурагдлаа')
      setSignOtpModalOpen(false)
      setPendingSignature(null)
      await fetchContract()
    } catch (err) {
      // OTP алдаа modal дотор харагдана; гэрээний түвшний алдаа дээд banner-т гарна
      const msg = err.response?.data?.message || 'OTP буруу эсвэл хугацаа дууссан'
      setOtpError(msg)
    } finally {
      setOtpVerifying(false)
    }
  }

  const handleCloseSignOtpModal = () => {
    if (otpVerifying) return
    setSignOtpModalOpen(false)
    setPendingSignature(null)
    setOtpError(null)
  }

  // ── Гэрээг цуцлах ──────────────────────────────────
  const handleCancelContract = async ({ reason }) => {
    setCancelling(true)
    setError(null)
    try {
      await api.post(`/contracts/${id}/cancel`, reason ? { reason } : {})
      setSuccess('Гэрээ цуцлагдлаа')
      setCancelModalOpen(false)
      await fetchContract()
    } catch (err) {
      // 409 = race condition (нөгөө тал зэрэгцээ зурсан) — modal дотор үлдээнэ
      setError(err.response?.data?.message || 'Цуцлахад алдаа гарлаа')
      setCancelModalOpen(false)
    } finally {
      setCancelling(false)
    }
  }

  const handleSend = async (payload) => {
    // AddParticipantModal-аас { user_id?, email, name?, subject? } ирнэ.
    const trimmed = (payload?.email || '').trim()
    if (user?.email && trimmed.toLowerCase() === user.email.toLowerCase()) {
      setError('Өөрийн имэйл рүү гэрээ илгээх боломжгүй')
      throw new Error('self-invite blocked')
    }

    setSending(true)
    setError(null)
    try {
      await api.post(`/contracts/${id}/send`, {
        participants: [{
          role:    'COUNTERPARTY',
          email:   trimmed,
          user_id: payload?.user_id || null,
        }],
        email_subject: payload?.subject || null,
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
  // ContractForm (legacy)-аас дуудагдахад editing-аас гарна.
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

  // ContractEditSidebar-ийн Save handler — editing mode-д үлдэнэ
  // mode дотроо EDIT → SEND болж шилжинэ
  const handleSidebarSave = async (formData) => {
    if (!contract) return
    setSubmittingEdit(true)
    setError(null)
    try {
      await api.patch(`/contracts/${id}`, { filled_data_json: formData })
      setSuccess('Засвар хадгалагдлаа')
      setEditLogRefresh(k => k + 1)
      await fetchContract()
    } catch (err) {
      setError(err.response?.data?.message || 'Хадгалахад алдаа гарлаа')
      throw err
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
      await fetchContract()
    } catch (err) {
      setError(err.response?.data?.message || 'Устгахад алдаа гарлаа')
    }
  }

  // Илгээх SENT myTurn үед — нөгөө талд буцаах (POST /return)
  // note: optional negotiation comment
  const handleReturn = async (note = null) => {
    setSending(true)
    setError(null)
    try {
      await api.post(`/contracts/${id}/return`, note ? { note } : {})
      setSuccess(note ? 'Тайлбар илгээгдлээ' : 'Гэрээ нөгөө талд илгээгдлээ')
      setEditing(false)
      setEditLogRefresh(k => k + 1)
      await fetchContract()
    } catch (err) {
      setError(err.response?.data?.message || 'Илгээхэд алдаа гарлаа')
      throw err
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
      attachments:    contract?.attachments || [],
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

  // ── Mobile: гэрээ ачаалагдахад A4-г дэлгэцэнд автоматаар багтаана ──
  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth >= 1024) return
    const t = setTimeout(fitToScreen, 60)
    return () => clearTimeout(t)
  }, [contract])

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
  // Цуцлах нөхцөл — DRAFT/SENT үед оролцогч аль ч талын хэрэглэгч.
  // FULLY_SIGNED/COMPLETED/CLOSED-д button нуугдана (backend ч мөн block хийнэ).
  const canCancelContract = !editing && ['DRAFT', 'SENT'].includes(contract.status)

  // ── Edit mode: SENT үед side-by-side (preview + EditSidebar), DRAFT үед full-page ──
  if (editing && template) {
    // SENT (negotiation) — side-by-side layout
    if (contract.status === 'SENT') {
      return (
        <div className="h-screen flex flex-col lg:flex-row bg-gray-50 overflow-hidden">
          <MobilePanelToggle panel={mobilePanel} onChange={setMobilePanel} />
          {/* ── Center: header + live preview ── */}
          <div className={`min-w-0 flex-col overflow-hidden lg:flex lg:flex-1 ${mobilePanel === 'doc' ? 'flex flex-1' : 'hidden'}`}>
            <ContractHeader
              contract={contract}
              onEdit={() => {}}
              onPdf={downloadPdf}
              onDocx={downloadDocx}
              onPrint={print}
              downloadBusy={downloadBusy}
              canEdit={false}
            />
            {error && (
              <div className="px-6 pt-4 shrink-0">
                <p className="text-sm text-red-700 bg-red-50 border border-red-200
                              rounded-lg px-3 py-2 m-0">{error}</p>
              </div>
            )}
            <div className="flex-1 relative overflow-hidden">
              <div
                ref={scrollRef}
                className="absolute inset-0 overflow-auto bg-gray-300/70 px-3 py-4 sm:px-8 sm:py-8 lg:px-16 lg:py-12"
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
              <div className="absolute top-4 left-6 px-2.5 py-1
                              bg-white/85 backdrop-blur-sm rounded-md
                              text-xs text-gray-600 font-medium
                              border border-gray-200 shadow-sm
                              pointer-events-none select-none">
                Хуудас: {currentPage}
              </div>
              <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 flex items-stretch
                              bg-white border border-gray-200 rounded-xl shadow-lg
                              divide-x divide-gray-100 overflow-hidden">
                <button onClick={zoomOut} disabled={zoom <= ZOOM_LEVELS[0]}
                        className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-0 bg-white
                                   disabled:opacity-40 disabled:cursor-not-allowed text-gray-700"
                        title="Бууруулах">
                  <MdRemove size={16} />
                </button>
                <div className="px-3 py-2 text-sm font-semibold text-gray-900 min-w-14
                                text-center select-none flex items-center justify-center">
                  {Math.round(zoom * 100)}%
                </div>
                <button onClick={zoomIn} disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                        className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-0 bg-white
                                   disabled:opacity-40 disabled:cursor-not-allowed text-gray-700"
                        title="Томруулах">
                  <MdAdd size={16} />
                </button>
                <button onClick={fitToScreen}
                        className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-0 bg-white
                                   text-gray-700" title="Дэлгэцэнд тааруулах">
                  <MdFitScreen size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Right: ContractEditSidebar ── */}
          <aside className={`shrink-0 border-l border-gray-200 print:hidden overflow-hidden w-full lg:w-104 lg:h-full lg:block ${mobilePanel === 'details' ? 'flex-1' : 'hidden'}`}>
            <ContractEditSidebar
              contract={contract}
              template={template}
              user={user}
              onSave={handleSidebarSave}
              onSend={handleReturn}
              onCancel={() => setEditing(false)}
              saving={submittingEdit}
              sending={sending}
              refreshLogKey={editLogRefresh}
            />
          </aside>

          <AlertModal
            open={!!success}
            message={success}
            onClose={() => setSuccess(null)}
          />
        </div>
      )
    }

    // DRAFT — full-page legacy form (creator анх удаа бөглөж байна)
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
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
            </div>

            <ContractForm
              template={template}
              initialData={contract.filled_data_json || {}}
              creatorRole={contract.creator_role || 'seller'}
              myRole={contract.my_role || 'CREATOR'}
              user={user}
              submitting={submittingEdit}
              error={error}
              submitLabel="Хадгалах"
              onSubmit={handleEditSubmit}
              onCancel={() => setEditing(false)}
            />
          </div>
        </div>

        <AlertModal
          open={!!success}
          message={success}
          onClose={() => setSuccess(null)}
        />
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
  //
  // viewTransitionName: 'contract-card' — list page-ийн row-той ижил нэр.
  // Browser нь list-ээс ороход row → page bounding box-ыг автомат морфлоно.
  // ══════════════════════════════════════════════════════════════
  return (
    <div
      className="h-screen flex flex-col lg:flex-row bg-gray-50 overflow-hidden"
      style={{ viewTransitionName: 'contract-card' }}
    >
      <MobilePanelToggle panel={mobilePanel} onChange={setMobilePanel} />

      {/* ── Center column: header + scrollable document ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <ContractHeader
          contract={contract}
          onEdit={() => setEditing(true)}
          onPdf={downloadPdf}
          onDocx={downloadDocx}
          onPrint={print}
          onRate={() => setRatingModalOpen(true)}
          onHistory={() => setSidebarTab('history')}
          onCancel={() => setCancelModalOpen(true)}
          downloadBusy={downloadBusy}
          canEdit={canEditTop}
          canRate={contract.status === 'CLOSED' && !!ratedTarget}
          hasRated={!!myRating}
          canCancel={canCancelContract}
        />

        {/* Error banner (success нь AlertModal-аар гарна) */}
        {error && (
          <div className="px-6 pt-4 shrink-0">
            <p className="text-sm text-red-700 bg-red-50 border border-red-200
                          rounded-lg px-3 py-2 m-0">
              {error}
            </p>
          </div>
        )}

        {/* A4 document viewer area — DocuSign-style */}
        <div className="flex-1 relative overflow-hidden">
          {/* Scrollable workspace */}
          <div
            ref={scrollRef}
            className="absolute inset-0 overflow-auto bg-gray-300/70 px-3 py-4 sm:px-8 sm:py-8 lg:px-16 lg:py-12"
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
          <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 flex items-stretch
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
      {/* ContractSidebar өөрөө teal→white gradient bg-аа эзэмшинэ — энд style тавихгүй */}
      <aside className={`shrink-0 print:hidden overflow-hidden w-full lg:w-96 lg:h-full lg:block ${mobilePanel === 'details' ? 'flex-1' : 'hidden'}`}>
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
          signing={signing || otpRequesting || otpVerifying}
          sending={sending}
          confirming={confirming}
          closing={closing}
          tab={sidebarTab}
          onTabChange={setSidebarTab}
          refreshLogKey={editLogRefresh}
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

      <CancelContractModal
        open={cancelModalOpen}
        contractTitle={contract.title}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleCancelContract}
        submitting={cancelling}
      />

      <SignOtpModal
        open={signOtpModalOpen}
        emailMasked={otpEmailMasked}
        onVerify={handleVerifyOtpAndSign}
        onResend={handleResendSignOtp}
        onClose={handleCloseSignOtpModal}
        verifying={otpVerifying}
        error={otpError}
      />

      {/* Амжилттай үйлдлийн modal — setSuccess(...) дуудагдах болгонд гарна */}
      <AlertModal
        open={!!success}
        message={success}
        onClose={() => setSuccess(null)}
      />
    </div>
  )
}

// ── Mobile-only segmented toggle: гэрээ ↔ дэлгэрэнгүй ──────────
// < lg дэлгэцэнд A4 гэрээ ба хажуугийн (талууд/гарын үсэг/үйлдэл) хэсгийг
// зэрэгцүүлэхийн оронд нэг нэгээр нь сэлгэж харуулна. lg+ дээр огт харагдахгүй.
function MobilePanelToggle({ panel, onChange }) {
  const base =
    'flex-1 py-2 text-sm font-medium rounded-md cursor-pointer border-0 transition-colors'
  const on  = 'bg-white text-[#3d3a8c] shadow-sm'
  const off = 'bg-transparent text-slate-500'
  return (
    // pl-16: зүүн дээд буланд Sidebar-ийн fixed hamburger (top-3 left-3, w-10)
    // байрлах тул түүнд зай үлдээж, toggle-той нэг мөрөнд давхцалгүй харагдуулна.
    <div className="lg:hidden flex items-center gap-1 bg-[#f3efe6] border-b border-[#ece8df] py-2 pr-1 pl-16 shrink-0 print:hidden">
      <button onClick={() => onChange('doc')}
              className={`${base} ${panel === 'doc' ? on : off}`}>
        Гэрээ
      </button>
      <button onClick={() => onChange('details')}
              className={`${base} ${panel === 'details' ? on : off}`}>
        Дэлгэрэнгүй
      </button>
    </div>
  )
}
