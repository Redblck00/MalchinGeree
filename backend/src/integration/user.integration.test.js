const express = require('express')
const request = require('supertest')

const mockQuery = jest.fn()
const mockAuth = jest.fn((req, res, next) => {
  req.user = { user_id: 'user-1', user_type: 'USER' }
  next()
})

jest.mock('../config/db', () => ({
  query: (...args) => mockQuery(...args),
}))

jest.mock('../middlewares/auth.middleware', () => (...args) => mockAuth(...args))

jest.mock('../utils/upload', () => ({
  profileUpload: { single: () => (req, res, next) => next() },
  signatureUpload: { single: () => (req, res, next) => next() },
}))

const userRoutes = require('../routes/user.routes')

const createApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/api/users', userRoutes)
  return app
}

describe('User integration tests (route + controller)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('GET /api/users/profile returns current user profile', async () => {
    const app = createApp()

    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          user_id: 'user-1',
          first_name: 'Bat',
          last_name: 'Bold',
          email: 'user@mail.com',
        },
      ],
    })

    const res = await request(app).get('/api/users/profile')

    expect(res.status).toBe(200)
    expect(res.body.data.user_id).toBe('user-1')
    expect(mockAuth).toHaveBeenCalled()
  })

  it('GET /api/users/search returns 400 when phone missing', async () => {
    const app = createApp()

    const res = await request(app).get('/api/users/search')

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'Утасны дугаар шаардлагатай' })
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('GET /api/users/notifications returns unread count', async () => {
    const app = createApp()

    mockQuery.mockResolvedValueOnce({
      rows: [
        { notification_id: 'n-1', is_read: false },
        { notification_id: 'n-2', is_read: true },
      ],
    })

    const res = await request(app).get('/api/users/notifications')

    expect(res.status).toBe(200)
    expect(res.body.unread).toBe(1)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})
