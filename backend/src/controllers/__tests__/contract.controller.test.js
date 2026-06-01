const mockWithTransaction = jest.fn()
const mockRenderContract = jest.fn()
const mockRenderPreview = jest.fn()
const mockGenerateOtp = jest.fn()
const mockSaveOtp = jest.fn()
const mockVerifyOtp = jest.fn()
const mockSendInviteEmail = jest.fn()
const mockSendContractEventEmail = jest.fn()
const mockSendSignOtpEmail = jest.fn()
const mockLog = jest.fn()
const mockNotify = jest.fn()
const mockNotifyParticipants = jest.fn()
const mockAddBlock = jest.fn()
const mockGenerateQRDataUrl = jest.fn()

const mockRepo = {
  findTemplateForContract: jest.fn(),
  insertContract: jest.fn(),
  insertVersion: jest.fn(),
  insertCreatorParticipant: jest.fn(),
  findContractsForUser: jest.fn(),
  findParticipant: jest.fn(),
  findContractWithTemplate: jest.fn(),
  updateContractData: jest.fn(),
  updateVersionRender: jest.fn(),
  markParticipantViewed: jest.fn(),
  findVersionFull: jest.fn(),
  updateVersionBlockchainBackfill: jest.fn(),
  findParticipantsDetailed: jest.fn(),
  findSignatures: jest.fn(),
  findAttachments: jest.fn(),
  findContractForUpdate: jest.fn(),
  hasSignature: jest.fn(),
  updateContractDataAndTitle: jest.fn(),
  insertEditLog: jest.fn(),
  findContractForSend: jest.fn(),
  countCounterparties: jest.fn(),
  insertInvitedParticipant: jest.fn(),
  insertInvitation: jest.fn(),
  markContractSent: jest.fn(),
  findSignContext: jest.fn(),
  findVersionId: jest.fn(),
  upsertSignature: jest.fn(),
  updateTurnAfterSign: jest.fn(),
  findContractStatusInfo: jest.fn(),
  findParticipantContactByRole: jest.fn(),
  findContractForConfirm: jest.fn(),
  insertConfirmation: jest.fn(),
  findParticipantsWithUser: jest.fn(),
  insertLivestockTransaction: jest.fn(),
  findVersionWithHash: jest.fn(),
  updateVersionBlockchain: jest.fn(),
  findContractTitle: jest.fn(),
  findContractForCounterpartyFill: jest.fn(),
  findContractForReturn: jest.fn(),
  updateTurn: jest.fn(),
  insertTokenAccessLog: jest.fn(),
  findInvitationByTokenHash: jest.fn(),
  incrementInvitationUse: jest.fn(),
  markParticipantLinkOpened: jest.fn(),
  findContractForCancel: jest.fn(),
  cancelContractIfStatus: jest.fn(),
  insertStatusHistory: jest.fn(),
  findContractForClose: jest.fn(),
  closeContractRow: jest.fn(),
  isParticipant: jest.fn(),
  findEditLog: jest.fn(),
}

jest.mock('../../config/db', () => ({
  withTransaction: (...args) => mockWithTransaction(...args),
}))

jest.mock('../../repositories/contract.repository', () => mockRepo)

jest.mock('../../utils/render', () => ({
  renderContract: (...args) => mockRenderContract(...args),
  renderPreview: (...args) => mockRenderPreview(...args),
  extractPlaceholders: jest.fn(),
}))

jest.mock('../../utils/otp', () => ({
  generateOtp: (...args) => mockGenerateOtp(...args),
  saveOtp: (...args) => mockSaveOtp(...args),
  verifyOtp: (...args) => mockVerifyOtp(...args),
}))

jest.mock('../../utils/email', () => ({
  sendInviteEmail: (...args) => mockSendInviteEmail(...args),
  sendContractEventEmail: (...args) => mockSendContractEventEmail(...args),
  sendSignOtpEmail: (...args) => mockSendSignOtpEmail(...args),
}))

jest.mock('../../utils/logger', () => ({
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

jest.mock('../../utils/notifier', () => ({
  notify: (...args) => mockNotify(...args),
  notifyParticipants: (...args) => mockNotifyParticipants(...args),
}))

jest.mock('../../utils/blockchain', () => ({
  addBlock: (...args) => mockAddBlock(...args),
}))

jest.mock('../../utils/qrcode', () => ({
  generateQRDataUrl: (...args) => mockGenerateQRDataUrl(...args),
}))

const contractController = require('../contract.controller')

const VALID_SIGNATURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const createRes = () => {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

const baseUser = {
  user_id: 'u-1',
  first_name: 'Bat',
  last_name: 'Bold',
  email: 'bat@mail.com',
  phone: '99112233',
  address: 'UB',
}

describe('contract.controller mock tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockWithTransaction.mockImplementation(async (fn) => fn({ query: jest.fn() }))
    mockRenderContract.mockReturnValue({ rendered: '<html>rendered</html>', hash: 'hash-1' })
    mockRenderPreview.mockReturnValue({ rendered: '<html>preview</html>' })
    mockLog.mockResolvedValue(undefined)
    mockNotify.mockResolvedValue(undefined)
    mockNotifyParticipants.mockResolvedValue(undefined)
    mockSendInviteEmail.mockResolvedValue(undefined)
    mockSendContractEventEmail.mockResolvedValue(undefined)
    mockSendSignOtpEmail.mockResolvedValue(undefined)
    mockRepo.insertTokenAccessLog.mockResolvedValue(undefined)
  })

  describe('createContract', () => {
    it('returns 400 when template_id is missing', async () => {
      const req = { user: baseUser, body: {} }
      const res = createRes()

      await contractController.createContract(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ message: 'Template ID шаардлагатай' })
      expect(mockRepo.findTemplateForContract).not.toHaveBeenCalled()
    })

    it('returns 400 for invalid creator_role', async () => {
      const req = {
        user: baseUser,
        body: { template_id: 't-1', creator_role: 'witness' },
      }
      const res = createRes()

      await contractController.createContract(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        message: 'creator_role нь "seller" эсвэл "buyer" байх ёстой',
      })
    })

    it('returns 404 when template is not found', async () => {
      const req = {
        user: baseUser,
        body: { template_id: 't-1', creator_role: 'seller' },
      }
      const res = createRes()
      mockRepo.findTemplateForContract.mockResolvedValueOnce(null)

      await contractController.createContract(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ message: 'Загвар олдсонгүй' })
    })

    it('creates contract inside transaction and returns 201', async () => {
      const req = {
        user: baseUser,
        body: {
          template_id: 't-1',
          title: 'Малын гэрээ',
          creator_role: 'seller',
          filled_data_json: { seller: { name: 'Bold Bat' } },
        },
      }
      const res = createRes()

      mockRepo.findTemplateForContract.mockResolvedValueOnce({
        template_id: 't-1',
        name: 'Template',
        template_content: '<p>{{seller.name}}</p>',
        schema_json: { fields: [] },
      })
      mockRepo.insertContract.mockResolvedValueOnce({
        contract_id: 'c-1',
        contract_number: 'CTR-001',
        title: 'Малын гэрээ',
        status: 'DRAFT',
        creator_role: 'seller',
        created_at: new Date('2026-01-01'),
      })
      mockRepo.insertVersion.mockResolvedValueOnce({ version_id: 'v-1' })
      mockRepo.insertCreatorParticipant.mockResolvedValueOnce(undefined)

      await contractController.createContract(req, res)

      expect(mockWithTransaction).toHaveBeenCalledTimes(1)
      expect(mockRepo.insertContract).toHaveBeenCalled()
      expect(mockRepo.insertVersion).toHaveBeenCalled()
      expect(mockRepo.insertCreatorParticipant).toHaveBeenCalledWith('c-1', 'u-1', expect.anything())
      expect(mockLog).toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Гэрээ амжилттай үүслээ',
          data: expect.objectContaining({
            contract_id: 'c-1',
            rendered_content: '<html>rendered</html>',
            version_id: 'v-1',
          }),
        })
      )
    })
  })

  describe('getMyContracts', () => {
    it('returns user contracts list', async () => {
      const req = { user: baseUser }
      const res = createRes()
      const rows = [{ contract_id: 'c-1', title: 'Test', status: 'DRAFT' }]
      mockRepo.findContractsForUser.mockResolvedValueOnce(rows)

      await contractController.getMyContracts(req, res)

      expect(mockRepo.findContractsForUser).toHaveBeenCalledWith('u-1')
      expect(res.json).toHaveBeenCalledWith({ data: rows })
    })
  })

  describe('getContractById', () => {
    it('returns 403 when user is not a participant', async () => {
      const req = { params: { id: 'c-1' }, user: baseUser }
      const res = createRes()
      mockRepo.findParticipant.mockResolvedValueOnce(null)

      await contractController.getContractById(req, res)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ message: 'Харах эрх байхгүй' })
    })

    it('returns contract detail without template_content', async () => {
      const req = { params: { id: 'c-1' }, user: baseUser }
      const res = createRes()

      mockRepo.findParticipant.mockResolvedValueOnce({
        participant_id: 'p-1',
        role: 'CREATOR',
        status: 'VIEWED',
      })
      mockRepo.findContractWithTemplate.mockResolvedValueOnce({
        contract_id: 'c-1',
        contract_number: 'CTR-001',
        title: 'Test',
        status: 'COMPLETED',
        creator_role: 'seller',
        filled_data_json: {},
        created_at: new Date('2026-01-01'),
        template_content: '<secret>',
        schema_json: { fields: [] },
      })
      mockRepo.findVersionFull.mockResolvedValueOnce({
        version_id: 'v-1',
        rendered_content: '<html>done</html>',
        qr_code_url: 'data:image/png;base64,qr',
      })
      mockRepo.findParticipantsDetailed.mockResolvedValueOnce([])
      mockRepo.findSignatures.mockResolvedValueOnce([])
      mockRepo.findAttachments.mockResolvedValueOnce([])

      await contractController.getContractById(req, res)

      expect(res.json).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contract_id: 'c-1',
          my_role: 'CREATOR',
          my_status: 'VIEWED',
          template_content: undefined,
          latest_version: expect.objectContaining({ version_id: 'v-1' }),
          participants: [],
          signatures: [],
          attachments: [],
        }),
      })
    })
  })

  describe('updateContract', () => {
    it('returns 403 when non-creator tries to edit DRAFT', async () => {
      const req = {
        params: { id: 'c-1' },
        user: { ...baseUser, user_id: 'u-2' },
        body: { filled_data_json: {} },
      }
      const res = createRes()

      mockRepo.findContractForUpdate.mockResolvedValueOnce({
        contract_id: 'c-1',
        creator_id: 'u-1',
        status: 'DRAFT',
        filled_data_json: {},
        template_content: '<p></p>',
        schema_json: { fields: [] },
        contract_number: 'CTR-001',
      })

      await contractController.updateContract(req, res)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ message: 'Зөвхөн үүсгэгч засах эрхтэй' })
    })

    it('returns 400 when contract is locked by signature', async () => {
      const req = {
        params: { id: 'c-1' },
        user: baseUser,
        body: { filled_data_json: {} },
      }
      const res = createRes()

      mockRepo.findContractForUpdate.mockResolvedValueOnce({
        contract_id: 'c-1',
        creator_id: 'u-1',
        status: 'DRAFT',
        filled_data_json: {},
        template_content: '<p></p>',
        schema_json: { fields: [] },
        contract_number: 'CTR-001',
      })
      mockRepo.hasSignature.mockResolvedValueOnce(true)

      await contractController.updateContract(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        message: 'Гарын үсэг зурагдсан гэрээг засаж болохгүй',
      })
    })
  })

  describe('sendContract', () => {
    it('returns 400 when inviting own email', async () => {
      const req = {
        params: { id: 'c-1' },
        user: baseUser,
        body: {
          participants: [{ role: 'COUNTERPARTY', email: 'bat@mail.com', phone: '99112233' }],
        },
      }
      const res = createRes()

      mockRepo.findContractForSend.mockResolvedValueOnce({
        contract_id: 'c-1',
        creator_id: 'u-1',
        status: 'DRAFT',
        title: 'Test',
      })

      await contractController.sendContract(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        message: 'Өөрийн имэйл рүү гэрээ илгээх боломжгүй',
      })
      expect(mockWithTransaction).not.toHaveBeenCalled()
    })

    it('sends contract and queues invite email after commit', async () => {
      const req = {
        params: { id: 'c-1' },
        user: baseUser,
        body: {
          participants: [{ role: 'COUNTERPARTY', email: 'other@mail.com', phone: '88112233' }],
        },
      }
      const res = createRes()

      mockRepo.findContractForSend.mockResolvedValueOnce({
        contract_id: 'c-1',
        creator_id: 'u-1',
        status: 'DRAFT',
        title: 'Test',
      })
      mockRepo.countCounterparties.mockResolvedValueOnce(0)
      mockRepo.insertInvitedParticipant.mockResolvedValueOnce({
        participant_id: 'p-2',
      })
      mockRepo.insertInvitation.mockResolvedValueOnce(undefined)
      mockRepo.markContractSent.mockResolvedValueOnce(undefined)

      await contractController.sendContract(req, res)

      expect(mockWithTransaction).toHaveBeenCalledTimes(1)
      expect(mockSendInviteEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'other@mail.com' })
      )
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Гэрээ илгээгдлээ' })
      )
    })
  })

  describe('requestSignOtp', () => {
    it('returns 400 when user has no email', async () => {
      const req = {
        params: { id: 'c-1' },
        user: { ...baseUser, email: null },
      }
      const res = createRes()

      await contractController.requestSignOtp(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ message: 'Имэйл хаяг бүртгэлгүй байна' })
    })

    it('sends sign OTP when participant is eligible', async () => {
      const req = { params: { id: 'c-1' }, user: baseUser }
      const res = createRes()

      mockRepo.findSignContext.mockResolvedValueOnce({
        my_status: 'VIEWED',
        contract_status: 'SENT',
        title: 'Test contract',
      })
      mockGenerateOtp.mockReturnValueOnce('123456')
      mockSaveOtp.mockResolvedValueOnce(undefined)
      mockSendSignOtpEmail.mockResolvedValueOnce(undefined)

      await contractController.requestSignOtp(req, res)

      expect(mockSaveOtp).toHaveBeenCalledWith(
        'sign:bat@mail.com:c-1',
        '123456',
        'EMAIL',
        5
      )
      expect(mockSendSignOtpEmail).toHaveBeenCalledWith('bat@mail.com', '123456', 'Test contract')
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'OTP код имэйл рүү илгээгдлээ' })
      )
    })
  })

  describe('signContract', () => {
    it('returns 400 for invalid signature blob', async () => {
      const req = {
        params: { id: 'c-1' },
        user: baseUser,
        body: { signature_blob: '<script>x</script>', otp_code: '123456' },
      }
      const res = createRes()

      await contractController.signContract(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        message: 'Гарын үсгийн формат буруу эсвэл хэт том',
      })
    })

    it('returns 400 when OTP format is invalid', async () => {
      const req = {
        params: { id: 'c-1' },
        user: baseUser,
        body: { signature_blob: VALID_SIGNATURE, otp_code: '12' },
      }
      const res = createRes()

      await contractController.signContract(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        message: 'OTP код 6 оронтой тоо байх ёстой',
      })
    })

    it('stores signature when OTP is valid', async () => {
      const req = {
        params: { id: 'c-1' },
        user: baseUser,
        body: {
          signature_blob: VALID_SIGNATURE,
          placeholder_key: 'seller.signature',
          otp_code: '123456',
        },
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest' },
      }
      const res = createRes()

      mockRepo.findSignContext.mockResolvedValueOnce({
        participant_id: 'p-1',
        role: 'CREATOR',
        my_status: 'VIEWED',
        contract_status: 'SENT',
      })
      mockVerifyOtp.mockResolvedValueOnce({ valid: true })
      mockRepo.findVersionId.mockResolvedValueOnce({ version_id: 'v-1' })
      mockRepo.upsertSignature.mockResolvedValueOnce(undefined)
      mockRepo.updateTurnAfterSign.mockResolvedValueOnce(undefined)
      mockRepo.findContractStatusInfo.mockResolvedValueOnce({
        status: 'PARTIALLY_SIGNED',
        current_turn: 'COUNTERPARTY',
        title: 'Test',
        creator_id: 'u-1',
      })
      mockRepo.findParticipantContactByRole.mockResolvedValueOnce({
        user_id: 'u-2',
        user_email: 'other@mail.com',
      })

      await contractController.signContract(req, res)

      expect(mockRepo.upsertSignature).toHaveBeenCalledWith(
        expect.objectContaining({
          contractId: 'c-1',
          participantId: 'p-1',
          blob: VALID_SIGNATURE,
        })
      )
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Гарын үсэг зурагдлаа' })
      )
    })
  })

  describe('confirmContract', () => {
    it('returns 403 when caller is not creator', async () => {
      const req = { params: { id: 'c-1' }, user: { ...baseUser, user_id: 'u-2' } }
      const res = createRes()

      mockRepo.findContractForConfirm.mockResolvedValueOnce({
        contract_id: 'c-1',
        creator_id: 'u-1',
        status: 'FULLY_SIGNED',
      })

      await contractController.confirmContract(req, res)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ message: 'Эрх байхгүй' })
    })

    it('returns 400 when contract is not FULLY_SIGNED', async () => {
      const req = { params: { id: 'c-1' }, user: baseUser }
      const res = createRes()

      mockRepo.findContractForConfirm.mockResolvedValueOnce({
        contract_id: 'c-1',
        creator_id: 'u-1',
        status: 'SENT',
      })

      await contractController.confirmContract(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        message: 'Бүх оролцогч гарын үсэг зурсан байх ёстой',
      })
    })

    it('confirms contract and notifies participants', async () => {
      const req = {
        params: { id: 'c-1' },
        user: baseUser,
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest' },
      }
      const res = createRes()

      mockRepo.findContractForConfirm.mockResolvedValueOnce({
        contract_id: 'c-1',
        creator_id: 'u-1',
        status: 'FULLY_SIGNED',
        creator_role: 'seller',
        filled_data_json: { livestock: [] },
      })
      mockRepo.findVersionId.mockResolvedValueOnce({ version_id: 'v-1' })
      mockRepo.insertConfirmation.mockResolvedValueOnce(undefined)
      mockRepo.findParticipantsWithUser.mockResolvedValueOnce([
        { role: 'COUNTERPARTY', user_id: 'u-2' },
      ])
      mockRepo.findVersionWithHash.mockResolvedValueOnce({
        version_id: 'v-1',
        rendered_hash: 'hash-1',
      })
      mockAddBlock.mockResolvedValueOnce({
        block_hash: 'block-hash',
        timestamp: new Date(),
        block_id: 'b-1',
      })
      mockGenerateQRDataUrl.mockResolvedValueOnce('data:image/png;base64,qr')
      mockRepo.updateVersionBlockchain.mockResolvedValueOnce(undefined)
      mockRepo.findContractTitle.mockResolvedValueOnce({ title: 'Test' })

      await contractController.confirmContract(req, res)

      expect(mockRepo.insertConfirmation).toHaveBeenCalled()
      expect(mockNotifyParticipants).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith({ message: 'Гэрээ баталгаажлаа' })
    })
  })

  describe('cancelContract', () => {
    it('returns 403 when user has no cancel permission', async () => {
      const req = { params: { id: 'c-1' }, user: baseUser, body: {} }
      const res = createRes()
      mockRepo.findContractForCancel.mockResolvedValueOnce(null)

      await contractController.cancelContract(req, res)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ message: 'Цуцлах эрх байхгүй' })
    })

    it('returns 400 when contract is FULLY_SIGNED', async () => {
      const req = { params: { id: 'c-1' }, user: baseUser, body: {} }
      const res = createRes()

      mockRepo.findContractForCancel.mockResolvedValueOnce({
        contract_id: 'c-1',
        status: 'FULLY_SIGNED',
        title: 'Test',
        my_role: 'CREATOR',
      })

      await contractController.cancelContract(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        message: 'Хоёр тал гарын үсэг зурсан гэрээг цуцлах боломжгүй',
      })
    })

    it('returns 409 when status changed during cancel race', async () => {
      const req = { params: { id: 'c-1' }, user: baseUser, body: {} }
      const res = createRes()

      mockRepo.findContractForCancel.mockResolvedValueOnce({
        contract_id: 'c-1',
        status: 'SENT',
        title: 'Test',
        my_role: 'CREATOR',
      })
      mockRepo.cancelContractIfStatus.mockResolvedValueOnce(0)

      await contractController.cancelContract(req, res)

      expect(res.status).toHaveBeenCalledWith(409)
      expect(res.json).toHaveBeenCalledWith({
        message: 'Гэрээний статус өөрчлөгдсөн тул цуцлах боломжгүй',
      })
    })

    it('cancels contract atomically and notifies participants', async () => {
      const req = { params: { id: 'c-1' }, user: baseUser, body: { reason: 'test' } }
      const res = createRes()

      mockRepo.findContractForCancel.mockResolvedValueOnce({
        contract_id: 'c-1',
        status: 'SENT',
        title: 'Test',
        my_role: 'CREATOR',
      })
      mockRepo.cancelContractIfStatus.mockResolvedValueOnce(1)
      mockRepo.insertStatusHistory.mockResolvedValueOnce(undefined)

      await contractController.cancelContract(req, res)

      expect(mockWithTransaction).toHaveBeenCalledTimes(1)
      expect(mockNotifyParticipants).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith({ message: 'Гэрээ цуцлагдлаа' })
    })
  })

  describe('closeContract', () => {
    it('returns 403 when caller is not creator', async () => {
      const req = { params: { id: 'c-1' }, user: { ...baseUser, user_id: 'u-2' }, body: {} }
      const res = createRes()

      mockRepo.findContractForClose.mockResolvedValueOnce({
        contract_id: 'c-1',
        creator_id: 'u-1',
        status: 'COMPLETED',
      })

      await contractController.closeContract(req, res)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ message: 'Зөвхөн үүсгэгч хаах эрхтэй' })
    })

    it('closes completed contract', async () => {
      const req = { params: { id: 'c-1' }, user: baseUser, body: { reason: 'done' } }
      const res = createRes()

      mockRepo.findContractForClose.mockResolvedValueOnce({
        contract_id: 'c-1',
        creator_id: 'u-1',
        status: 'COMPLETED',
        title: 'Test',
      })
      mockRepo.closeContractRow.mockResolvedValueOnce(undefined)
      mockRepo.insertStatusHistory.mockResolvedValueOnce(undefined)

      await contractController.closeContract(req, res)

      expect(mockRepo.closeContractRow).toHaveBeenCalledWith('c-1', 'done')
      expect(mockNotifyParticipants).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith({ message: 'Гэрээ хаагдлаа' })
    })
  })

  describe('verifyInviteToken', () => {
    it('returns 404 for unknown token', async () => {
      const req = { params: { token: 'bad-token' }, ip: '127.0.0.1', headers: {} }
      const res = createRes()
      mockRepo.findInvitationByTokenHash.mockResolvedValueOnce(null)

      await contractController.verifyInviteToken(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ message: 'Урилгын линк буруу байна' })
    })

    it('returns 400 for expired invitation', async () => {
      const req = { params: { token: 'valid-token' }, ip: '127.0.0.1', headers: {} }
      const res = createRes()

      mockRepo.findInvitationByTokenHash.mockResolvedValueOnce({
        invitation_id: 'inv-1',
        is_revoked: false,
        expires_at: new Date('2020-01-01'),
        use_count: 0,
        participant_id: 'p-1',
        contract_id: 'c-1',
        invite_email: 'other@mail.com',
        user_id: null,
        email_has_account: false,
        role: 'COUNTERPARTY',
        status: 'INVITED',
      })

      await contractController.verifyInviteToken(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ message: 'Урилгын хугацаа дууссан' })
    })

    it('returns invite context for valid token', async () => {
      const req = { params: { token: 'valid-token' }, ip: '127.0.0.1', headers: {} }
      const res = createRes()

      mockRepo.findInvitationByTokenHash.mockResolvedValueOnce({
        invitation_id: 'inv-1',
        is_revoked: false,
        expires_at: new Date('2099-01-01'),
        use_count: 1,
        participant_id: 'p-1',
        contract_id: 'c-1',
        invite_email: 'other@mail.com',
        user_id: 'u-2',
        email_has_account: true,
        role: 'COUNTERPARTY',
        status: 'INVITED',
      })
      mockRepo.incrementInvitationUse.mockResolvedValueOnce(undefined)
      mockRepo.markParticipantLinkOpened.mockResolvedValueOnce(undefined)

      await contractController.verifyInviteToken(req, res)

      expect(mockRepo.incrementInvitationUse).toHaveBeenCalled()
      expect(mockRepo.markParticipantLinkOpened).toHaveBeenCalledWith('p-1')
      expect(res.json).toHaveBeenCalledWith({
        data: {
          contract_id: 'c-1',
          participant_email: 'other@mail.com',
          has_user_account: true,
          role: 'COUNTERPARTY',
          status: 'INVITED',
        },
      })
    })
  })

  describe('fillCounterpartyData', () => {
    it('returns 403 when user is not counterparty', async () => {
      const req = {
        params: { id: 'c-1' },
        user: baseUser,
        body: { filled_data: { name: 'Test' } },
      }
      const res = createRes()

      mockRepo.findContractForCounterpartyFill.mockResolvedValueOnce({
        contract_id: 'c-1',
        my_role: 'CREATOR',
        my_status: 'VIEWED',
        status: 'SENT',
      })

      await contractController.fillCounterpartyData(req, res)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ message: 'Зөвхөн нөгөө тал бөглөх эрхтэй' })
    })

    it('saves counterparty fields and writes edit log', async () => {
      const req = {
        params: { id: 'c-1' },
        user: baseUser,
        body: { filled_data: { name: 'Buyer Name', phone: '88112233' } },
      }
      const res = createRes()

      mockRepo.findContractForCounterpartyFill.mockResolvedValueOnce({
        contract_id: 'c-1',
        my_role: 'COUNTERPARTY',
        my_status: 'VIEWED',
        status: 'SENT',
        creator_role: 'seller',
        filled_data_json: { buyer: { name: '' } },
        template_content: '<p></p>',
        schema_json: { fields: [] },
        contract_number: 'CTR-001',
      })
      mockRepo.updateVersionRender.mockResolvedValueOnce(undefined)
      mockRepo.updateContractData.mockResolvedValueOnce(undefined)
      mockRepo.insertEditLog.mockResolvedValueOnce(undefined)

      await contractController.fillCounterpartyData(req, res)

      expect(mockRepo.updateContractData).toHaveBeenCalled()
      expect(mockRepo.insertEditLog).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Мэдээлэл хадгалагдлаа' })
      )
    })
  })

  describe('returnContract', () => {
    it('returns 403 when it is not user turn', async () => {
      const req = { params: { id: 'c-1' }, user: baseUser, body: {} }
      const res = createRes()

      mockRepo.findContractForReturn.mockResolvedValueOnce({
        contract_id: 'c-1',
        status: 'SENT',
        my_role: 'CREATOR',
        current_turn: 'COUNTERPARTY',
        filled_data_json: {},
      })

      await contractController.returnContract(req, res)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ message: 'Одоо таны ээлж биш байна' })
    })

    it('returns contract to other side and notifies', async () => {
      const req = {
        params: { id: 'c-1' },
        user: baseUser,
        body: { note: 'Засвар хийлээ' },
      }
      const res = createRes()

      mockRepo.findContractForReturn.mockResolvedValueOnce({
        contract_id: 'c-1',
        creator_id: 'u-1',
        status: 'SENT',
        my_role: 'CREATOR',
        current_turn: 'CREATOR',
        title: 'Test',
        filled_data_json: {},
        template_content: '<p></p>',
        schema_json: { fields: [] },
        contract_number: 'CTR-001',
      })
      mockRepo.hasSignature.mockResolvedValueOnce(false)
      mockRepo.updateTurn.mockResolvedValueOnce(undefined)
      mockRepo.insertEditLog.mockResolvedValueOnce(undefined)
      mockRepo.findParticipantContactByRole.mockResolvedValueOnce({
        user_id: 'u-2',
        user_email: 'other@mail.com',
      })

      await contractController.returnContract(req, res)

      expect(mockRepo.updateTurn).toHaveBeenCalledWith('c-1', 'COUNTERPARTY')
      expect(mockNotify).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Гэрээг буцаалаа' })
      )
    })
  })

  describe('getEditLog', () => {
    it('returns 403 when user is not participant', async () => {
      const req = { params: { id: 'c-1' }, user: baseUser }
      const res = createRes()
      mockRepo.isParticipant.mockResolvedValueOnce(false)

      await contractController.getEditLog(req, res)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ message: 'Харах эрх байхгүй' })
    })

    it('returns edit log rows for participant', async () => {
      const req = { params: { id: 'c-1' }, user: baseUser }
      const res = createRes()
      const rows = [{ edit_id: 'e-1', note: 'changed price' }]

      mockRepo.isParticipant.mockResolvedValueOnce(true)
      mockRepo.findEditLog.mockResolvedValueOnce(rows)

      await contractController.getEditLog(req, res)

      expect(res.json).toHaveBeenCalledWith({ data: rows })
    })
  })
})
