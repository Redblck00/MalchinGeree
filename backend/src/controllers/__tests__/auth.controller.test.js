const mockQuery = jest.fn()
const mockSignToken = jest.fn()
const mockGenerateOtp = jest.fn()
const mockSaveOtp = jest.fn()
const mockVerifyOtp = jest.fn()
const mockFindPendingByPhone = jest.fn()
const mockSendOtpEmail = jest.fn()
const mockLog = jest.fn()
const mockBcryptHash = jest.fn()
const mockBcryptCompare = jest.fn()

jest.mock('../../config/db', () => ({
  query: (...args) => mockQuery(...args),
}))

jest.mock('../../utils/jwt', () => ({
  signToken: (...args) => mockSignToken(...args),
}))

jest.mock('../../utils/otp', () => ({
  generateOtp: (...args) => mockGenerateOtp(...args),
  saveOtp: (...args) => mockSaveOtp(...args),
  verifyOtp: (...args) => mockVerifyOtp(...args),
  findPendingByPhone: (...args) => mockFindPendingByPhone(...args),
}))

jest.mock('../../utils/email', () => ({
  sendOtpEmail: (...args) => mockSendOtpEmail(...args),
}))

jest.mock('../../utils/logger', () => ({
  log: (...args) => mockLog(...args),
  LOG: {
    REGISTER: 'REGISTER',
    LOGIN: 'LOGIN',
  },
}))

jest.mock('bcryptjs', () => ({
  hash: (...args) => mockBcryptHash(...args),
  compare: (...args) => mockBcryptCompare(...args),
}))

const authController = require('../auth.controller')

const createRes = () => {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

describe('auth.controller mock tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('register', () => {
    it('returns 400 when required fields are missing', async () => {
      const req = { body: { first_name: 'A' } }
      const res = createRes()

      await authController.register(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ message: 'Бүх талбарыг бөглөнө үү' })
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('registers pending OTP data successfully', async () => {
      const req = {
        body: {
          first_name: 'Bat',
          last_name: 'Bold',
          phone: '99112233',
          email: 'USER@MAIL.COM',
          password: 'secret123',
        },
      }
      const res = createRes()

      mockQuery.mockResolvedValueOnce({ rows: [] })
      mockBcryptHash.mockResolvedValueOnce('hashed-pass')
      mockGenerateOtp.mockReturnValueOnce('123456')
      mockSaveOtp.mockResolvedValueOnce()
      mockSendOtpEmail.mockResolvedValueOnce()

      await authController.register(req, res)

      expect(mockQuery).toHaveBeenCalled()
      expect(mockSaveOtp).toHaveBeenCalledWith(
        'USER@MAIL.COM',
        '123456',
        'EMAIL',
        undefined,
        expect.objectContaining({
          email: 'user@mail.com',
          password_hash: 'hashed-pass',
        })
      )
      expect(mockSendOtpEmail).toHaveBeenCalledWith('USER@MAIL.COM', '123456')
      expect(res.status).toHaveBeenCalledWith(201)
    })
  })

  describe('verifyOtp', () => {
    it('returns mapped error when OTP is wrong', async () => {
      const req = { body: { phone: '99112233', code: '000000' } }
      const res = createRes()

      mockQuery.mockResolvedValueOnce({ rows: [] })
      mockFindPendingByPhone.mockResolvedValueOnce({ email: 'user@mail.com' })
      mockVerifyOtp.mockResolvedValueOnce({ valid: false, reason: 'WRONG_CODE' })

      await authController.verifyOtp(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ message: 'OTP код буруу байна' })
    })

    it('creates user and returns token when OTP is valid', async () => {
      const req = {
        body: { phone: '99112233', code: '123456' },
        headers: {},
      }
      const res = createRes()

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'u-1',
              first_name: 'Bat',
              last_name: 'Bold',
              phone: '99112233',
              email: 'user@mail.com',
              user_type: 'USER',
              status: 'ACTIVE',
            },
          ],
        })
        .mockResolvedValueOnce({ rowCount: 2, rows: [] })
        .mockResolvedValueOnce({ rows: [{ token_id: 'rt-1' }] })  // insertRefreshToken
      mockFindPendingByPhone.mockResolvedValueOnce({ email: 'user@mail.com' })
      mockVerifyOtp.mockResolvedValueOnce({
        valid: true,
        pendingData: {
          first_name: 'Bat',
          last_name: 'Bold',
          email: 'user@mail.com',
          password_hash: 'hashed-pass',
        },
      })
      mockSignToken.mockReturnValueOnce('jwt-token')
      mockLog.mockResolvedValueOnce()

      await authController.verifyOtp(req, res)

      expect(mockSignToken).toHaveBeenCalledWith({ user_id: 'u-1', user_type: 'USER' })
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Бүртгэл амжилттай баталгаажлаа',
          token: 'jwt-token',
          refresh_token: expect.any(String),
          linked_invitations: 2,
        })
      )
    })
  })

  describe('login', () => {
    it('returns 400 for wrong credentials', async () => {
      const req = { body: { phone: '99112233', password: 'bad-pass' } }
      const res = createRes()

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            user_id: 'u-1',
            password_hash: 'hash',
            status: 'ACTIVE',
          },
        ],
      })
      mockBcryptCompare.mockResolvedValueOnce(false)

      await authController.login(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ message: 'Утас эсвэл нууц үг буруу' })
    })

    it('returns token and safe user when login succeeds', async () => {
      const req = { body: { phone: '99112233', password: 'good-pass' } }
      const res = createRes()

      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'u-1',
              first_name: 'Bat',
              last_name: 'Bold',
              email: 'user@mail.com',
              phone: '99112233',
              password_hash: 'hash',
              user_type: 'USER',
              status: 'ACTIVE',
              address: null,
              profile_image_url: null,
            },
          ],
        })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ token_id: 'rt-1' }] })  // insertRefreshToken
      mockBcryptCompare.mockResolvedValueOnce(true)
      mockSignToken.mockReturnValueOnce('jwt-token')
      mockLog.mockResolvedValueOnce()

      await authController.login(req, res)

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Амжилттай нэвтэрлээ',
          token: 'jwt-token',
          refresh_token: expect.any(String),
        })
      )
      const payload = res.json.mock.calls[0][0]
      expect(payload.user.password_hash).toBeUndefined()
    })
  })

  describe('resendOtp', () => {
    it('returns 400 when phone is missing', async () => {
      const req = { body: {} }
      const res = createRes()

      await authController.resendOtp(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ message: 'Утасны дугаар шаардлагатай' })
    })

    it('resends OTP using existing pending registration data', async () => {
      const req = { body: { phone: '99112233' } }
      const res = createRes()

      mockQuery.mockResolvedValueOnce({ rows: [] })
      mockFindPendingByPhone.mockResolvedValueOnce({
        email: 'user@mail.com',
        pending_data: { first_name: 'Bat' },
      })
      mockGenerateOtp.mockReturnValueOnce('654321')
      mockSaveOtp.mockResolvedValueOnce()
      mockSendOtpEmail.mockResolvedValueOnce()

      await authController.resendOtp(req, res)

      expect(mockSaveOtp).toHaveBeenCalledWith(
        'user@mail.com',
        '654321',
        'EMAIL',
        undefined,
        { first_name: 'Bat' }
      )
      expect(res.json).toHaveBeenCalledWith({ message: 'OTP дахин илгээгдлээ' })
    })
  })

  describe('refresh', () => {
    it('returns 400 when refresh_token is missing', async () => {
      const req = { body: {} }
      const res = createRes()

      await authController.refresh(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ message: 'refresh_token шаардлагатай' })
    })

    it('rotates tokens for a valid refresh_token', async () => {
      const req = { body: { refresh_token: 'valid-token' }, headers: {} }
      const res = createRes()

      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            token_id: 't-1', user_id: 'u-1',
            expires_at: new Date(Date.now() + 60_000), revoked_at: null,
            user_type: 'USER', status: 'ACTIVE',
          }],
        })                                             // findRefreshTokenByHash
        .mockResolvedValueOnce({})                     // revokeRefreshToken (rotation)
        .mockResolvedValueOnce({ rows: [{ token_id: 'rt-2' }] }) // insertRefreshToken
      mockSignToken.mockReturnValueOnce('new-jwt')

      await authController.refresh(req, res)

      expect(mockSignToken).toHaveBeenCalledWith({ user_id: 'u-1', user_type: 'USER' })
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'new-jwt', refresh_token: expect.any(String) })
      )
    })

    it('revokes all sessions when a revoked token is reused', async () => {
      const req = { body: { refresh_token: 'reused-token' }, headers: {} }
      const res = createRes()

      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            token_id: 't-1', user_id: 'u-1',
            expires_at: new Date(Date.now() + 60_000), revoked_at: new Date(),
            user_type: 'USER', status: 'ACTIVE',
          }],
        })                          // findRefreshTokenByHash (аль хэдийн revoked)
        .mockResolvedValueOnce({})  // revokeAllUserRefreshTokens

      await authController.refresh(req, res)

      expect(res.status).toHaveBeenCalledWith(401)
    })
  })

  describe('logout', () => {
    it('revokes the given refresh token', async () => {
      const req = { body: { refresh_token: 'tok' } }
      const res = createRes()

      mockQuery
        .mockResolvedValueOnce({ rows: [{ token_id: 't-1', revoked_at: null }] }) // findRefreshTokenByHash
        .mockResolvedValueOnce({})  // revokeRefreshToken

      await authController.logout(req, res)

      expect(res.json).toHaveBeenCalledWith({ message: 'Амжилттай гарлаа' })
    })
  })
})
