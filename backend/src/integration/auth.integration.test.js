const express = require('express')
const request = require('supertest')

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

jest.mock('../config/db', () => ({
  query: (...args) => mockQuery(...args),
}))

jest.mock('../utils/jwt', () => ({
  signToken: (...args) => mockSignToken(...args),
}))

jest.mock('../utils/otp', () => ({
  generateOtp: (...args) => mockGenerateOtp(...args),
  saveOtp: (...args) => mockSaveOtp(...args),
  verifyOtp: (...args) => mockVerifyOtp(...args),
  findPendingByPhone: (...args) => mockFindPendingByPhone(...args),
}))

jest.mock('../utils/email', () => ({
  sendOtpEmail: (...args) => mockSendOtpEmail(...args),
}))

jest.mock('../utils/logger', () => ({
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

// Integration test-д rate limiter нөлөөлөхөөс сэргийлж pass-through болгов.
jest.mock('../middlewares/rateLimit.middleware', () => ({
  registerLimiter: (req, res, next) => next(),
  otpVerifyLimiter: (req, res, next) => next(),
  resendLimiter: (req, res, next) => next(),
  loginLimiter: (req, res, next) => next(),
  loginIpLimiter: (req, res, next) => next(),
}))

const authRoutes = require('../routes/auth.routes')

const createApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRoutes)
  return app
}

describe('Auth integration tests (route + controller)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('POST /api/auth/register -> 201 when input is valid', async () => {
    const app = createApp()

    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockBcryptHash.mockResolvedValueOnce('hashed-pass')
    mockGenerateOtp.mockReturnValueOnce('123456')
    mockSaveOtp.mockResolvedValueOnce()
    mockSendOtpEmail.mockResolvedValueOnce()

    const payload = {
      first_name: 'Bat',
      last_name: 'Bold',
      phone: '99112233',
      email: 'user@mail.com',
      password: 'secret123',
    }

    const res = await request(app).post('/api/auth/register').send(payload)

    expect(res.status).toBe(201)
    expect(res.body).toEqual({
      message: 'OTP имейл рүү илгээгдлээ',
      phone: '99112233',
    })
    expect(mockSaveOtp).toHaveBeenCalled()
  })

  it('POST /api/auth/verify-otp -> creates user and returns token', async () => {
    const app = createApp()

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
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
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

    const res = await request(app).post('/api/auth/verify-otp').send({
      phone: '99112233',
      code: '123456',
    })

    expect(res.status).toBe(200)
    expect(res.body).toEqual(
      expect.objectContaining({
        message: 'Бүртгэл амжилттай баталгаажлаа',
        token: 'jwt-token',
        linked_invitations: 1,
      })
    )
  })

  it('POST /api/auth/login -> returns token and user when credentials are valid', async () => {
    const app = createApp()

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

    const res = await request(app).post('/api/auth/login').send({
      phone: '99112233',
      password: 'secret123',
    })

    expect(res.status).toBe(200)
    expect(res.body).toEqual(
      expect.objectContaining({
        message: 'Амжилттай нэвтэрлээ',
        token: 'jwt-token',
      })
    )
    expect(res.body.user.password_hash).toBeUndefined()
  })
})
