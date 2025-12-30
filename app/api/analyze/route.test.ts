/* eslint-disable @typescript-eslint/no-explicit-any */
import { POST } from './route'
import { processCollection } from '@/lib/discogs'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'

jest.mock('@/lib/discogs')
jest.mock('iron-session')
jest.mock('next/headers')
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }))

/** Unit coverage for the analyze route to ensure validation and job bootstrapping behave as expected. */
describe('POST /api/analyze', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 400 if user is not logged in and no username provided', async () => {
    ;(getIronSession as any).mockResolvedValue({ user: null })
    ;(cookies as any).mockResolvedValue({})

    const req = {
      json: jest.fn().mockResolvedValue({}),
    } as unknown as Request

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Username is required')
  })

  it('should create a job and return the runId', async () => {
    ;(getIronSession as any).mockResolvedValue({ user: null })
    ;(cookies as any).mockResolvedValue({})
    ;(processCollection as any).mockResolvedValue(undefined)

    const req = {
      json: jest.fn().mockResolvedValue({ username: 'testuser' }),
    } as unknown as Request

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.runId).toBe('test-uuid')
    expect(processCollection).toHaveBeenCalledWith(
        'test-uuid', 
        'testuser', 
        undefined, 
        { allLabels: undefined, sampleSize: undefined }
    )
  })

  it('should use session username if logged in and no username provided', async () => {
    ;(getIronSession as any).mockResolvedValue({ 
      user: { username: 'loggeduser', accessToken: 'tk', accessTokenSecret: 'sec' } 
    })
    ;(cookies as any).mockResolvedValue({})

    const req = {
      json: jest.fn().mockResolvedValue({}),
    } as unknown as Request

    const response = await POST(req)
    await response.json() 

    expect(response.status).toBe(200)
    expect(processCollection).toHaveBeenCalledWith(
        'test-uuid', 
        'loggeduser', 
        { accessToken: 'tk', accessTokenSecret: 'sec' }, 
        { allLabels: undefined, sampleSize: undefined }
    )
  })
})
