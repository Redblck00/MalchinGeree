const express = require('express')
const request = require('supertest')

const mockRegister = jest.fn((req, res) => res.status(201).json({ ok: true, route: 'register' }))
const mockVerifyOtp = jest.fn((req, res) => res.status(200).json({ ok: true, route: 'verify-otp' }))
const mockLogin = jest.fn((req, res) => res.status(200).json({ ok: true, route: 'login' }))
const mockResendOtp = jest.fn((req, res) => res.status(200).json({ ok: true, route: 'resend-otp' }))
const mockRefresh = jest.fn((req, res) => res.status(200).json({ ok: true, route: 'refresh' }))
const mockLogout = jest.fn((req, res) => res.status(200).json({ ok: true, route: 'logout' }))

const mockRegisterLimiter = jest.fn((req, res, next) => next())
const mockOtpVerifyLimiter = jest.fn((req, res, next) => next())
const mockResendLimiter = jest.fn((req, res, next) => next())
const mockLoginLimiter = jest.fn((req, res, next) => next())
const mockLoginIpLimiter = jest.fn((req, res, next) => next())

jest.mock('../../controllers/auth.controller', () => ({
  register: (...args) => mockRegister(...args),
  verifyOtp: (...args) => mockVerifyOtp(...args),
  login: (...args) => mockLogin(...args),
  resendOtp: (...args) => mockResendOtp(...args),
  refresh: (...args) => mockRefresh(...args),
  logout: (...args) => mockLogout(...args),
}))

jest.mock('../../middlewares/rateLimit.middleware', () => ({
  registerLimiter: (...args) => mockRegisterLimiter(...args),
  otpVerifyLimiter: (...args) => mockOtpVerifyLimiter(...args),
  resendLimiter: (...args) => mockResendLimiter(...args),
  loginLimiter: (...args) => mockLoginLimiter(...args),
  loginIpLimiter: (...args) => mockLoginIpLimiter(...args),
}))

const authRoutes = require('../auth.routes')

const createApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRoutes)
  return app
}

describe('auth.routes API-level mock tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('POST /api/auth/register wires registerLimiter + auth.register', async () => {
    const app = createApp()
    const res = await request(app).post('/api/auth/register').send({ a: 1 })

    expect(res.status).toBe(201)
    expect(res.body).toEqual({ ok: true, route: 'register' })
    expect(mockRegisterLimiter).toHaveBeenCalledTimes(1)
    expect(mockRegister).toHaveBeenCalledTimes(1)
  })

  it('POST /api/auth/verify-otp wires otpVerifyLimiter + auth.verifyOtp', async () => {
    const app = createApp()
    const res = await request(app).post('/api/auth/verify-otp').send({ code: '123456' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, route: 'verify-otp' })
    expect(mockOtpVerifyLimiter).toHaveBeenCalledTimes(1)
    expect(mockVerifyOtp).toHaveBeenCalledTimes(1)
  })

  it('POST /api/auth/login wires loginLimiter + auth.login', async () => {
    const app = createApp()
    const res = await request(app).post('/api/auth/login').send({ phone: '99112233' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, route: 'login' })
    expect(mockLoginLimiter).toHaveBeenCalledTimes(1)
    expect(mockLogin).toHaveBeenCalledTimes(1)
  })

  it('POST /api/auth/resend-otp wires resendLimiter + auth.resendOtp', async () => {
    const app = createApp()
    const res = await request(app).post('/api/auth/resend-otp').send({ phone: '99112233' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, route: 'resend-otp' })
    expect(mockResendLimiter).toHaveBeenCalledTimes(1)
    expect(mockResendOtp).toHaveBeenCalledTimes(1)
  })
})
