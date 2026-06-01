const express = require('express')
const request = require('supertest')

const mockQuery = jest.fn()
const mockWithTransaction = jest.fn()
const mockRenderContract = jest.fn()
const mockRenderPreview = jest.fn()
const mockGenerateOtp = jest.fn()
const mockSaveOtp = jest.fn()
const mockVerifyOtp = jest.fn()
const mockSendInviteEmail = jest.fn()
const mockSendSignOtpEmail = jest.fn()
const mockLog = jest.fn()
const mockNotify = jest.fn()
const mockNotifyParticipants = jest.fn()

const mockAuth = jest.fn((req, res, next) => {
  req.user = {
    user_id: 'u-1',
    first_name: 'Bat',
    last_name: 'Bold',
    email: 'bat@mail.com',
    phone: '99112233',
    user_type: 'USER',
  }
  next()
})

jest.mock('../config/db', () => ({
  query: (...args) => mockQuery(...args),
  withTransaction: (...args) => mockWithTransaction(...args),
}))

jest.mock('../middlewares/auth.middleware', () => (...args) => mockAuth(...args))

jest.mock('../middlewares/rateLimit.middleware', () => ({
  signOtpLimiter: (req, res, next) => next(),
}))

jest.mock('../utils/render', () => ({
  renderContract: (...args) => mockRenderContract(...args),
  renderPreview: (...args) => mockRenderPreview(...args),
  extractPlaceholders: jest.fn(),
}))

jest.mock('../utils/otp', () => ({
  generateOtp: (...args) => mockGenerateOtp(...args),
  saveOtp: (...args) => mockSaveOtp(...args),
  verifyOtp: (...args) => mockVerifyOtp(...args),
}))

jest.mock('../utils/email', () => ({
  sendInviteEmail: (...args) => mockSendInviteEmail(...args),
  sendContractEventEmail: jest.fn(),
  sendSignOtpEmail: (...args) => mockSendSignOtpEmail(...args),
}))

jest.mock('../utils/logger', () => ({
  log: (...args) => mockLog(...args),
  LOG: {
    CONTRACT_CREATE: 'CONTRACT_CREATE',
    CONTRACT_UPDATE: 'CONTRACT_UPDATE',
    CONTRACT_SEND: 'CONTRACT_SEND',
    CONTRACT_SIGN: 'CONTRACT_SIGN',
    CONTRACT_CONFIRM: 'CONTRACT_CONFIRM',
    CONTRACT_CANCEL: 'CONTRACT_CANCEL',
  },
}))

jest.mock('../utils/notifier', () => ({
  notify: (...args) => mockNotify(...args),
  notifyParticipants: (...args) => mockNotifyParticipants(...args),
}))

jest.mock('../utils/blockchain', () => ({
  addBlock: jest.fn(),
}))

jest.mock('../utils/qrcode', () => ({
  generateQRDataUrl: jest.fn(),
}))

jest.mock('../utils/upload', () => ({
  attachmentUpload: { single: () => (req, res, next) => next() },
  handleUploadError: (err, req, res, next) => next(err),
}))

jest.mock('../utils/cloudinary', () => ({
  deleteFromCloudinary: jest.fn(),
}))

const contractRoutes = require('../routes/contract.routes')

const VALID_SIGNATURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const createApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/api/contracts', contractRoutes)
  return app
}

describe('Contract integration tests (route + controller)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockWithTransaction.mockImplementation(async (fn) => fn({ query: (...args) => mockQuery(...args) }))
    mockRenderContract.mockReturnValue({ rendered: '<html>rendered</html>', hash: 'hash-1' })
    mockRenderPreview.mockReturnValue({ rendered: '<html>preview</html>' })
    mockLog.mockResolvedValue(undefined)
    mockNotify.mockResolvedValue(undefined)
    mockNotifyParticipants.mockResolvedValue(undefined)
    mockSendInviteEmail.mockResolvedValue(undefined)
    mockSendSignOtpEmail.mockResolvedValue(undefined)
  })

  describe('Public routes', () => {
    it('POST /api/contracts/invite/:token/verify -> 404 for unknown token', async () => {
      const app = createApp()

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({})

      const res = await request(app)
        .post('/api/contracts/invite/unknown-token/verify')
        .send()

      expect(res.status).toBe(404)
      expect(res.body).toEqual({ message: 'Урилгын линк буруу байна' })
      expect(mockAuth).not.toHaveBeenCalled()
    })

    it('POST /api/contracts/invite/:token/verify -> 200 for valid token', async () => {
      const app = createApp()

      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            invitation_id: 'inv-1',
            is_revoked: false,
            expires_at: new Date('2099-01-01'),
            use_count: 0,
            participant_id: 'p-1',
            contract_id: 'c-1',
            invite_email: 'other@mail.com',
            user_id: 'u-2',
            email_has_account: true,
            role: 'COUNTERPARTY',
            status: 'INVITED',
          }],
        })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})

      const res = await request(app)
        .post('/api/contracts/invite/valid-token/verify')
        .send()

      expect(res.status).toBe(200)
      expect(res.body.data).toEqual(
        expect.objectContaining({
          contract_id: 'c-1',
          participant_email: 'other@mail.com',
          has_user_account: true,
          role: 'COUNTERPARTY',
        })
      )
      expect(mockAuth).not.toHaveBeenCalled()
    })
  })

  describe('Authenticated routes', () => {
    it('GET /api/contracts/templates -> returns active templates', async () => {
      const app = createApp()

      mockQuery.mockResolvedValueOnce({
        rows: [{ template_id: 't-1', name: 'Малын гэрээ', is_standard: true }],
      })

      const res = await request(app).get('/api/contracts/templates')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].template_id).toBe('t-1')
      expect(mockAuth).toHaveBeenCalled()
    })

    it('GET /api/contracts -> returns current user contracts', async () => {
      const app = createApp()

      mockQuery.mockResolvedValueOnce({
        rows: [{ contract_id: 'c-1', title: 'Test', status: 'DRAFT', my_role: 'CREATOR' }],
      })

      const res = await request(app).get('/api/contracts')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].contract_id).toBe('c-1')
    })

    it('POST /api/contracts -> 400 when template_id is missing', async () => {
      const app = createApp()

      const res = await request(app)
        .post('/api/contracts')
        .send({ title: 'Test' })

      expect(res.status).toBe(400)
      expect(res.body).toEqual({ message: 'Template ID шаардлагатай' })
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('POST /api/contracts -> 201 when contract is created', async () => {
      const app = createApp()

      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            template_id: 't-1',
            name: 'Template',
            template_content: '<p>{{seller.name}}</p>',
            schema_json: { fields: [] },
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            contract_id: 'c-1',
            contract_number: 'CTR-001',
            title: 'Малын гэрээ',
            status: 'DRAFT',
            creator_role: 'seller',
            created_at: new Date('2026-01-01'),
          }],
        })
        .mockResolvedValueOnce({ rows: [{ version_id: 'v-1' }] })
        .mockResolvedValueOnce({ rows: [] })

      const res = await request(app)
        .post('/api/contracts')
        .send({
          template_id: 't-1',
          title: 'Малын гэрээ',
          creator_role: 'seller',
          filled_data_json: { seller: { name: 'Bold Bat' } },
        })

      expect(res.status).toBe(201)
      expect(res.body.message).toBe('Гэрээ амжилттай үүслээ')
      expect(res.body.data.contract_id).toBe('c-1')
      expect(res.body.data.rendered_content).toBe('<html>rendered</html>')
      expect(mockWithTransaction).toHaveBeenCalledTimes(1)
    })

    it('GET /api/contracts/:id -> 403 when user is not participant', async () => {
      const app = createApp()

      mockQuery.mockResolvedValueOnce({ rows: [] })

      const res = await request(app).get('/api/contracts/c-1')

      expect(res.status).toBe(403)
      expect(res.body).toEqual({ message: 'Харах эрх байхгүй' })
    })

    it('GET /api/contracts/:id -> returns contract detail', async () => {
      const app = createApp()

      mockQuery
        .mockResolvedValueOnce({
          rows: [{ participant_id: 'p-1', role: 'CREATOR', status: 'VIEWED' }],
        })
        .mockResolvedValueOnce({
          rows: [{
            contract_id: 'c-1',
            contract_number: 'CTR-001',
            title: 'Test',
            status: 'COMPLETED',
            creator_role: 'seller',
            filled_data_json: {},
            created_at: new Date('2026-01-01'),
            template_content: '<secret>',
            schema_json: { fields: [] },
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            version_id: 'v-1',
            rendered_content: '<html>done</html>',
            qr_code_url: 'data:image/png;base64,qr',
          }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })

      const res = await request(app).get('/api/contracts/c-1')

      expect(res.status).toBe(200)
      expect(res.body.data.contract_id).toBe('c-1')
      expect(res.body.data.my_role).toBe('CREATOR')
      expect(res.body.data.template_content).toBeUndefined()
    })

    it('PATCH /api/contracts/:id -> 400 when contract is signature-locked', async () => {
      const app = createApp()

      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            contract_id: 'c-1',
            creator_id: 'u-1',
            status: 'DRAFT',
            filled_data_json: {},
            template_content: '<p></p>',
            schema_json: { fields: [] },
            contract_number: 'CTR-001',
          }],
        })
        .mockResolvedValueOnce({ rows: [{ signature_id: 's-1' }] })

      const res = await request(app)
        .patch('/api/contracts/c-1')
        .send({ filled_data_json: { seller: { name: 'New' } } })

      expect(res.status).toBe(400)
      expect(res.body).toEqual({
        message: 'Гарын үсэг зурагдсан гэрээг засаж болохгүй',
      })
    })

    it('POST /api/contracts/:id/send -> 400 when inviting own email', async () => {
      const app = createApp()

      mockQuery.mockResolvedValueOnce({
        rows: [{
          contract_id: 'c-1',
          creator_id: 'u-1',
          status: 'DRAFT',
          title: 'Test',
        }],
      })

      const res = await request(app)
        .post('/api/contracts/c-1/send')
        .send({
          participants: [{
            role: 'COUNTERPARTY',
            email: 'bat@mail.com',
            phone: '99112233',
          }],
        })

      expect(res.status).toBe(400)
      expect(res.body).toEqual({
        message: 'Өөрийн имэйл рүү гэрээ илгээх боломжгүй',
      })
      expect(mockWithTransaction).not.toHaveBeenCalled()
    })

    it('POST /api/contracts/:id/send -> 200 when invite is sent', async () => {
      const app = createApp()

      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            contract_id: 'c-1',
            creator_id: 'u-1',
            status: 'DRAFT',
            title: 'Test',
          }],
        })
        .mockResolvedValueOnce({ rows: [{ cnt: '0' }] })
        .mockResolvedValueOnce({
          rows: [{ participant_id: 'p-2' }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })

      const res = await request(app)
        .post('/api/contracts/c-1/send')
        .send({
          participants: [{
            role: 'COUNTERPARTY',
            email: 'other@mail.com',
            phone: '88112233',
          }],
        })

      expect(res.status).toBe(200)
      expect(res.body.message).toBe('Гэрээ илгээгдлээ')
      expect(mockSendInviteEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'other@mail.com' })
      )
    })

    it('POST /api/contracts/:id/sign/request-otp -> 400 when user has no email', async () => {
      const app = createApp()

      mockAuth.mockImplementationOnce((req, res, next) => {
        req.user = {
          user_id: 'u-1',
          first_name: 'Bat',
          last_name: 'Bold',
          email: null,
          phone: '99112233',
          user_type: 'USER',
        }
        next()
      })

      const res = await request(app)
        .post('/api/contracts/c-1/sign/request-otp')
        .send()

      expect(res.status).toBe(400)
      expect(res.body).toEqual({ message: 'Имэйл хаяг бүртгэлгүй байна' })
    })

    it('POST /api/contracts/:id/sign -> 400 for invalid signature blob', async () => {
      const app = createApp()

      const res = await request(app)
        .post('/api/contracts/c-1/sign')
        .send({
          signature_blob: '<script>x</script>',
          otp_code: '123456',
        })

      expect(res.status).toBe(400)
      expect(res.body).toEqual({
        message: 'Гарын үсгийн формат буруу эсвэл хэт том',
      })
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('POST /api/contracts/:id/sign -> 200 when signature is saved', async () => {
      const app = createApp()

      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            participant_id: 'p-1',
            role: 'CREATOR',
            my_status: 'VIEWED',
            contract_status: 'SENT',
          }],
        })
        .mockResolvedValueOnce({ rows: [{ version_id: 'v-1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            status: 'PARTIALLY_SIGNED',
            current_turn: 'COUNTERPARTY',
            title: 'Test',
            creator_id: 'u-1',
          }],
        })
        .mockResolvedValueOnce({ rows: [] })

      mockVerifyOtp.mockResolvedValueOnce({ valid: true })

      const res = await request(app)
        .post('/api/contracts/c-1/sign')
        .send({
          signature_blob: VALID_SIGNATURE,
          placeholder_key: 'seller.signature',
          otp_code: '123456',
        })

      expect(res.status).toBe(200)
      expect(res.body.message).toBe('Гарын үсэг зурагдлаа')
      expect(res.body.data.contract_status).toBe('PARTIALLY_SIGNED')
    })

    it('POST /api/contracts/:id/cancel -> 403 when user has no permission', async () => {
      const app = createApp()

      mockQuery.mockResolvedValueOnce({ rows: [] })

      const res = await request(app)
        .post('/api/contracts/c-1/cancel')
        .send({ reason: 'test' })

      expect(res.status).toBe(403)
      expect(res.body).toEqual({ message: 'Цуцлах эрх байхгүй' })
    })

    it('POST /api/contracts/:id/cancel -> 200 when contract is cancelled', async () => {
      const app = createApp()

      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            contract_id: 'c-1',
            status: 'SENT',
            title: 'Test',
            my_role: 'CREATOR',
          }],
        })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [] })

      const res = await request(app)
        .post('/api/contracts/c-1/cancel')
        .send({ reason: 'test' })

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ message: 'Гэрээ цуцлагдлаа' })
      expect(mockNotifyParticipants).toHaveBeenCalled()
    })

    it('GET /api/contracts/:id/edit-log -> returns edit history for participant', async () => {
      const app = createApp()

      mockQuery
        .mockResolvedValueOnce({ rows: [{ ok: true }] })
        .mockResolvedValueOnce({
          rows: [{ edit_id: 'e-1', note: 'changed price', changed_fields: '{}' }],
        })

      const res = await request(app).get('/api/contracts/c-1/edit-log')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].edit_id).toBe('e-1')
    })
  })
})
