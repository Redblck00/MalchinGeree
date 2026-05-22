const mockQuery = jest.fn()

jest.mock('../../config/db', () => ({
  query: (...args) => mockQuery(...args),
}))

const userController = require('../user.controller')

const createRes = () => {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

describe('user.controller unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('updateProfile returns 409 on unique phone violation', async () => {
    const req = {
      user: { user_id: 'u-1' },
      body: { phone: '99112233' },
    }
    const res = createRes()

    const err = new Error('duplicate key')
    err.code = '23505'
    mockQuery.mockRejectedValueOnce(err)

    await userController.updateProfile(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({
      message: 'Уг утасны дугаар аль хэдийн бүртгэгдсэн',
    })
  })

  it('searchByPhone returns 400 when phone is missing', async () => {
    const req = { query: {}, user: { user_id: 'u-1' } }
    const res = createRes()

    await userController.searchByPhone(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ message: 'Утасны дугаар шаардлагатай' })
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('saveSignature returns 400 when signature_blob is missing', async () => {
    const req = { body: {}, user: { user_id: 'u-1' } }
    const res = createRes()

    await userController.saveSignature(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ message: 'Гарын үсэг шаардлагатай' })
  })

  it('saveSignature creates signature and resets previous default when requested', async () => {
    const req = {
      user: { user_id: 'u-1' },
      body: {
        signature_blob: 'data:image/png;base64,abc',
        signature_type: 'DRAW',
        is_default: true,
      },
    }
    const res = createRes()

    mockQuery
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{ user_signature_id: 's-1', signature_type: 'DRAW', is_default: true }],
      })

    await userController.saveSignature(req, res)

    expect(mockQuery).toHaveBeenCalledTimes(2)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({
      data: { user_signature_id: 's-1', signature_type: 'DRAW', is_default: true },
    })
  })

  it('getNotifications returns unread count', async () => {
    const req = { user: { user_id: 'u-1' } }
    const res = createRes()

    mockQuery.mockResolvedValueOnce({
      rows: [
        { notification_id: 'n-1', is_read: false },
        { notification_id: 'n-2', is_read: true },
        { notification_id: 'n-3', is_read: false },
      ],
    })

    await userController.getNotifications(req, res)

    expect(res.json).toHaveBeenCalledWith({
      data: [
        { notification_id: 'n-1', is_read: false },
        { notification_id: 'n-2', is_read: true },
        { notification_id: 'n-3', is_read: false },
      ],
      unread: 2,
    })
  })

  it('getLivestockStats returns normalized response shape', async () => {
    const req = { user: { user_id: 'u-1' }, query: { role: 'seller', period: 'year' } }
    const res = createRes()

    mockQuery
      .mockResolvedValueOnce({ rows: [{ total_count: 3, total_amount: 1200000 }] })
      .mockResolvedValueOnce({ rows: [{ livestock_type: 'horse', count: 2, amount: 800000 }] })
      .mockResolvedValueOnce({ rows: [{ period: '2026-01-01', count: 3, amount: 1200000 }] })
      .mockResolvedValueOnce({ rows: [{ period: '2026-01-01', livestock_type: 'horse', avg_price: 400000 }] })
      .mockResolvedValueOnce({ rows: [{ transaction_id: 'tx-1', count: 1 }] })

    await userController.getLivestockStats(req, res)

    expect(mockQuery).toHaveBeenCalledTimes(5)
    expect(res.json).toHaveBeenCalledWith({
      data: {
        role: 'seller',
        period: 'year',
        total: { total_count: 3, total_amount: 1200000 },
        by_type: [{ livestock_type: 'horse', count: 2, amount: 800000 }],
        by_period: [{ period: '2026-01-01', count: 3, amount: 1200000 }],
        price_trend: [{ period: '2026-01-01', livestock_type: 'horse', avg_price: 400000 }],
        recent: [{ transaction_id: 'tx-1', count: 1 }],
      },
    })
  })
})
