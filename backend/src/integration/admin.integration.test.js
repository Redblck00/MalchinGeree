const express = require('express')
const request = require('supertest')

const mockQuery = jest.fn()
const mockLog = jest.fn()
const mockAuth = jest.fn((req, res, next) => {
  req.user = { user_id: 'admin-1', user_type: 'ADMIN' }
  next()
})
const mockRole = jest.fn(() => (req, res, next) => next())

jest.mock('../config/db', () => ({
  query: (...args) => mockQuery(...args),
}))

jest.mock('../utils/logger', () => ({
  log: (...args) => mockLog(...args),
  LOG: { TEMPLATE_CREATE: 'TEMPLATE_CREATE' },
}))

jest.mock('../middlewares/auth.middleware', () => (...args) => mockAuth(...args))
jest.mock('../middlewares/role.middleware', () => (...args) => mockRole(...args))

const adminRoutes = require('../routes/admin.routes')

const createApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/api/admin', adminRoutes)
  return app
}

describe('Admin integration tests (route + controller)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('GET /api/admin/stats returns aggregated stats', async () => {
    const app = createApp()

    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '10', active: '8', new_30d: '2' }] })
      .mockResolvedValueOnce({ rows: [{ total: '20', completed: '5', draft: '3', new_30d: '4' }] })
      .mockResolvedValueOnce({ rows: [{ total: '7' }] })

    const res = await request(app).get('/api/admin/stats')

    expect(res.status).toBe(200)
    expect(res.body.data.users.total).toBe('10')
    expect(res.body.data.contracts.total).toBe('20')
    expect(res.body.data.templates.total).toBe('7')
    expect(mockAuth).toHaveBeenCalled()
  })

  it('POST /api/admin/templates creates template', async () => {
    const app = createApp()

    mockQuery.mockResolvedValueOnce({
      rows: [{ template_id: 't-1', name: 'Sale Template' }],
    })
    mockLog.mockResolvedValueOnce()

    const res = await request(app).post('/api/admin/templates').send({
      name: 'Sale Template',
      description: 'desc',
      template_content: '<p>{{seller_name}}</p>',
      schema_json: { fields: [{ key: 'seller_name' }] },
      is_standard: false,
    })

    expect(res.status).toBe(201)
    expect(res.body.message).toBe('Загвар амжилттай үүслээ')
    expect(res.body.data.template_id).toBe('t-1')
    expect(mockLog).toHaveBeenCalledTimes(1)
  })

  it('PATCH /api/admin/users/:id/status validates status', async () => {
    const app = createApp()

    const res = await request(app)
      .patch('/api/admin/users/u-1/status')
      .send({ status: 'PENDING' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'Буруу статус' })
    expect(mockQuery).not.toHaveBeenCalled()
  })
})
