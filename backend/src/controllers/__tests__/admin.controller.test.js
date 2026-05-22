const mockQuery = jest.fn()
const mockLog = jest.fn()

jest.mock('../../config/db', () => ({
  query: (...args) => mockQuery(...args),
}))

jest.mock('../../utils/logger', () => ({
  log: (...args) => mockLog(...args),
  LOG: {
    TEMPLATE_CREATE: 'TEMPLATE_CREATE',
  },
}))

const adminController = require('../admin.controller')

const createRes = () => {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

describe('admin.controller unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('createTemplate returns 400 when schema is invalid', async () => {
    const req = {
      user: { user_id: 'admin-1' },
      body: {
        name: 'Template A',
        template_content: '<h1>Hi</h1>',
        schema_json: '{"bad":true}',
      },
    }
    const res = createRes()

    await adminController.createTemplate(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].message).toContain('Schema JSON буруу формат')
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('createTemplate creates template and writes audit log', async () => {
    const req = {
      user: { user_id: 'admin-1' },
      body: {
        name: 'Template A',
        description: 'desc',
        template_content: '<h1>Hi</h1>',
        schema_json: { fields: [{ key: 'seller_name' }] },
        is_standard: true,
      },
    }
    const res = createRes()

    mockQuery.mockResolvedValueOnce({
      rows: [{ template_id: 't-1', name: 'Template A' }],
    })
    mockLog.mockResolvedValueOnce()

    await adminController.createTemplate(req, res)

    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(mockLog).toHaveBeenCalledTimes(1)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Загвар амжилттай үүслээ' })
    )
  })

  it('updateUserStatus returns 400 for invalid status', async () => {
    const req = { params: { id: 'u-1' }, body: { status: 'PENDING' } }
    const res = createRes()

    await adminController.updateUserStatus(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ message: 'Буруу статус' })
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('updateUserStatus returns updated user for valid status', async () => {
    const req = { params: { id: 'u-1' }, body: { status: 'SUSPENDED' } }
    const res = createRes()

    mockQuery.mockResolvedValueOnce({
      rows: [{ user_id: 'u-1', status: 'SUSPENDED' }],
    })

    await adminController.updateUserStatus(req, res)

    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(res.json).toHaveBeenCalledWith({
      data: { user_id: 'u-1', status: 'SUSPENDED' },
    })
  })

  it('getStats returns aggregated sections', async () => {
    const req = {}
    const res = createRes()

    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '10', active: '8', new_30d: '2' }] })
      .mockResolvedValueOnce({ rows: [{ total: '5', completed: '3', draft: '1', new_30d: '1' }] })
      .mockResolvedValueOnce({ rows: [{ total: '4' }] })

    await adminController.getStats(req, res)

    expect(mockQuery).toHaveBeenCalledTimes(3)
    expect(res.json).toHaveBeenCalledWith({
      data: {
        users: { total: '10', active: '8', new_30d: '2' },
        contracts: { total: '5', completed: '3', draft: '1', new_30d: '1' },
        templates: { total: '4' },
      },
    })
  })
})
