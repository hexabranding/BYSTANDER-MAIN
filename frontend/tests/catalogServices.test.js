import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  fetchPublicServices,
  fetchPublicServiceById,
} from '../src/services/servicesService.js'
import {
  fetchPublicCaregivers,
  fetchPublicCaregiverById,
} from '../src/services/caregiversService.js'
import apiClient, { ApiError } from '../src/services/apiClient.js'
import { DATA_MODES } from '../src/services/dataModes.js'

describe('Step 12C - Services & Caregiver Directory Integration', () => {
  let originalFetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('1. fetchPublicServices maps search and category parameters to backend query', async () => {
    let capturedUrl = null

    globalThis.fetch = async (url) => {
      capturedUrl = String(url)
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: [
            {
              _id: '6711a1b2c3d4e5f6a7b8c9d0',
              name: 'Patient Monitoring',
              slug: 'patient-monitoring',
              category: 'Clinical',
              baseHourlyRate: 449,
              isActive: true,
            },
          ],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
      }
    }

    const res = await fetchPublicServices(
      { search: 'monitoring', category: 'Clinical', page: 1, limit: 10 },
      { mode: DATA_MODES.API_ONLY },
    )

    assert.strictEqual(res.source, 'api')
    assert.strictEqual(res.isFallback, false)
    assert.strictEqual(res.data.services.length, 1)
    assert.strictEqual(res.data.services[0].name, 'Patient Monitoring')
    assert.match(capturedUrl, /search=monitoring/)
    assert.match(capturedUrl, /category=Clinical/)
    assert.match(capturedUrl, /page=1/)
    assert.match(capturedUrl, /limit=10/)
  })

  it('2. fetchPublicCaregivers maps city, qualification, rating, and rate filters to backend query', async () => {
    let capturedUrl = null

    globalThis.fetch = async (url) => {
      capturedUrl = String(url)
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: [
            {
              _id: '6711a1b2c3d4e5f6a7b8c9e1',
              fullName: 'Sunita Rao',
              qualification: 'B.Sc Nursing',
              hourlyRate: 550,
              city: 'Pune',
              verificationStatus: 'verified',
              rating: { average: 4.9, count: 20 },
            },
          ],
          pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
        }),
      }
    }

    const res = await fetchPublicCaregivers(
      {
        city: 'Pune',
        qualification: 'B.Sc Nursing',
        minRating: 4.5,
        maxRate: 600,
        page: 1,
        limit: 12,
      },
      { mode: DATA_MODES.API_ONLY },
    )

    assert.strictEqual(res.source, 'api')
    assert.strictEqual(res.isFallback, false)
    assert.strictEqual(res.data.caregivers.length, 1)
    assert.strictEqual(res.data.caregivers[0].name, 'Sunita Rao')
    assert.match(capturedUrl, /city=Pune/)
    assert.match(capturedUrl, /qualification=B\.Sc\+Nursing/)
    assert.match(capturedUrl, /minRating=4\.5/)
    assert.match(capturedUrl, /maxRate=600/)
  })

  it('3. Resolves legacy mock IDs statically without hitting the backend', async () => {
    let apiCalled = false

    globalThis.fetch = async () => {
      apiCalled = true
      throw new Error('Backend should not be contacted for mock IDs')
    }

    // A. Service mock ID resolution
    const serviceRes = await fetchPublicServiceById('svc-monitoring')
    assert.strictEqual(serviceRes.source, 'static')
    assert.strictEqual(serviceRes.isFallback, false)
    assert.strictEqual(serviceRes.data.id, 'svc-monitoring')
    assert.strictEqual(serviceRes.data.name, 'Patient Monitoring')

    // B. Caregiver mock ID resolution
    const caregiverRes = await fetchPublicCaregiverById('cg-101')
    assert.strictEqual(caregiverRes.source, 'static')
    assert.strictEqual(caregiverRes.isFallback, false)
    assert.strictEqual(caregiverRes.data.id, 'cg-101')
    assert.strictEqual(caregiverRes.data.name, 'Ananya Deshmukh')

    assert.strictEqual(apiCalled, false)
  })

  it('4. Queries backend API when given a genuine 24-character MongoDB ObjectId', async () => {
    let capturedServiceId = null
    let capturedCaregiverId = null

    globalThis.fetch = async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('/api/services/')) {
        capturedServiceId = urlStr.split('/api/services/')[1].split('?')[0]
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            success: true,
            data: {
              _id: '6711a1b2c3d4e5f6a7b8c9d0',
              name: 'Elderly Care',
              slug: 'elderly-care',
              baseHourlyRate: 350,
              isActive: true,
            },
          }),
        }
      }

      if (urlStr.includes('/api/caregivers/')) {
        capturedCaregiverId = urlStr.split('/api/caregivers/')[1].split('?')[0]
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            success: true,
            data: {
              _id: '6711a1b2c3d4e5f6a7b8c9e1',
              fullName: 'Meera Krishnan',
              hourlyRate: 479,
              verificationStatus: 'verified',
            },
          }),
        }
      }

      throw new Error(`Unexpected URL: ${urlStr}`)
    }

    const svcRes = await fetchPublicServiceById('6711a1b2c3d4e5f6a7b8c9d0', { mode: DATA_MODES.API_ONLY })
    assert.strictEqual(svcRes.source, 'api')
    assert.strictEqual(capturedServiceId, '6711a1b2c3d4e5f6a7b8c9d0')

    const cgRes = await fetchPublicCaregiverById('6711a1b2c3d4e5f6a7b8c9e1', { mode: DATA_MODES.API_ONLY })
    assert.strictEqual(cgRes.source, 'api')
    assert.strictEqual(capturedCaregiverId, '6711a1b2c3d4e5f6a7b8c9e1')
  })

  it('5. Falls back to static catalog during 500 server error or network outage in api-first mode', async () => {
    // Simulate 500 Internal Server Error
    globalThis.fetch = async () => ({
      ok: false,
      status: 500,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: 'InternalServerError',
        message: 'Database connection failed',
      }),
    })

    // Services fallback
    const svcRes = await fetchPublicServices({}, { mode: DATA_MODES.API_FIRST })
    assert.strictEqual(svcRes.source, 'static')
    assert.strictEqual(svcRes.isFallback, true)
    assert.strictEqual(svcRes.data.services.length > 0, true)

    // Caregivers fallback
    const cgRes = await fetchPublicCaregivers({}, { mode: DATA_MODES.API_FIRST })
    assert.strictEqual(cgRes.source, 'static')
    assert.strictEqual(cgRes.isFallback, true)
    assert.strictEqual(cgRes.data.caregivers.length > 0, true)
  })

  it('6. Strictly DOES NOT fall back on 404 Not Found for genuine MongoDB ObjectIds', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 404,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: 'NotFoundError',
        message: 'Caregiver profile not found or ineligible',
      }),
    })

    // In api-first mode, a genuine 404 MUST throw and NEVER silently substitute a mock profile
    await assert.rejects(
      async () => {
        await fetchPublicCaregiverById('6711a1b2c3d4e5f6a7b8c999', { mode: DATA_MODES.API_FIRST })
      },
      (err) => {
        assert.strictEqual(err instanceof ApiError, true)
        assert.strictEqual(err.status, 404)
        return true
      },
    )

    await assert.rejects(
      async () => {
        await fetchPublicServiceById('6711a1b2c3d4e5f6a7b8c999', { mode: DATA_MODES.API_FIRST })
      },
      (err) => {
        assert.strictEqual(err instanceof ApiError, true)
        assert.strictEqual(err.status, 404)
        return true
      },
    )
  })

  it('7. Strictly DOES NOT fall back on 400 Bad Request / Validation errors', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 400,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: 'ValidationError',
        message: 'Invalid query parameters provided',
      }),
    })

    await assert.rejects(
      async () => {
        await fetchPublicCaregivers({ minRating: 99 }, { mode: DATA_MODES.API_FIRST })
      },
      (err) => {
        assert.strictEqual(err instanceof ApiError, true)
        assert.strictEqual(err.status, 400)
        return true
      },
    )
  })

  it('8. Returns proper pagination structure on empty results', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: [],
        pagination: { page: 1, limit: 12, total: 0, totalPages: 1 },
      }),
    })

    const res = await fetchPublicCaregivers({ city: 'NonExistentCity' }, { mode: DATA_MODES.API_ONLY })
    assert.strictEqual(res.source, 'api')
    assert.strictEqual(res.data.caregivers.length, 0)
    assert.strictEqual(res.data.pagination.total, 0)
  })
})
