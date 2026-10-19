import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  getCustomers,
  getCaregivers,
  updateUserStatus,
  getFlaggedMessages,
} from '../src/services/adminService.js'
import {
  adaptCustomerAccount,
  adaptCaregiverAccount,
  adaptFlaggedMessage,
} from '../src/services/adapters.js'

describe('Step 13C — Admin User Governance, Account Status & Security Tests', () => {
  let mockFetchCalls = []

  const MOCK_USER_ID = '6711a1b2c3d4e5f6a7b8c991'
  const MOCK_CAREGIVER_ID = '6711a1b2c3d4e5f6a7b8c992'
  const MOCK_MESSAGE_ID = '6711a1b2c3d4e5f6a7b8c993'
  const MOCK_BOOKING_ID = '6711a1b2c3d4e5f6a7b8c994'

  beforeEach(() => {
    mockFetchCalls = []
    globalThis.fetch = async (url, options = {}) => {
      const urlStr = String(url)
      const method = (options.method || 'GET').toUpperCase()
      const body = options.body ? JSON.parse(options.body) : null
      mockFetchCalls.push({ url: urlStr, method, body, headers: options.headers })

      // 1. GET /api/admin/users/customers
      if (urlStr.includes('/api/admin/users/customers') && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                _id: MOCK_USER_ID,
                fullName: 'Vikram Malhotra',
                email: 'vikram.m@example.com',
                phone: '+919876543210',
                role: 'customer',
                status: 'active',
                city: 'Mumbai, MH',
                area: 'Bandra West',
                totalBookings: 5,
                totalSpent: 12500,
                createdAt: '2026-09-01T10:00:00.000Z',
              },
            ],
            pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
            stats: { total: 1, active: 1, suspended: 0, blocked: 0 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 2. GET /api/admin/users/caregivers
      if (urlStr.includes('/api/admin/users/caregivers') && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                _id: MOCK_CAREGIVER_ID,
                userId: MOCK_USER_ID,
                name: 'Ananya Deshmukh',
                qualification: 'BSc Nursing',
                nursingRegNo: 'MNC-2024-9988',
                experienceYears: 6,
                hourlyRate: 650,
                city: 'Pune, MH',
                services: ['Elder Bedside Care', 'Wound Dressing'],
                verificationStatus: 'verified',
                status: 'active',
                rating: 4.9,
                ratingCount: 18,
                completedJobs: 24,
                trustScore: 92,
              },
            ],
            pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
            stats: { total: 1, verified: 1, pending: 0, rejected: 0 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 3. PATCH /api/admin/users/:id/status
      if (urlStr.includes('/api/admin/users/') && urlStr.includes('/status') && method === 'PATCH') {
        // Enforce reason requirement
        if (!body || !body.reason || body.reason.trim().length < 3) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'ValidationError',
              message: 'A mandatory reason of at least 3 characters is required for account status changes.',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        // Mock self-suspension rejection
        if (body.reason.includes('self_lockout_test')) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'ValidationError',
              message: 'Administrators cannot suspend or block their own account.',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Account status updated to '${body.status}' successfully.`,
            data: {
              _id: MOCK_USER_ID,
              status: body.status,
              statusReason: body.reason,
              statusUpdatedAt: new Date().toISOString(),
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 4. GET /api/admin/messages/flagged
      if (urlStr.includes('/api/admin/messages/flagged') && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                _id: MOCK_MESSAGE_ID,
                bookingId: MOCK_BOOKING_ID,
                bookingNumber: 'BK-C994',
                bookingStatus: 'in_progress',
                senderId: MOCK_USER_ID,
                senderName: 'Vikram Malhotra',
                senderRole: 'customer',
                senderStatus: 'active',
                recipientId: '6711a1b2c3d4e5f6a7b8c995',
                recipientName: 'Ananya Deshmukh',
                recipientRole: 'caregiver',
                recipientStatus: 'active',
                content: 'Please call me directly on 9876543210 or gpay to ananya@okhdfcbank',
                isFlagged: true,
                flaggedReasons: [
                  'Potential off-platform phone number detected',
                  'Potential off-platform UPI / payment handle detected',
                ],
                flaggedAt: '2026-10-18T14:30:00.000Z',
              },
            ],
            pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
            stats: { totalFlagged: 1, phoneSignals: 1, upiSignals: 1 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      return new Response(
        JSON.stringify({ success: false, message: 'Not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }
  })

  // ---------------------------------------------------------------------------
  // Test 1: Customer Directory API
  // ---------------------------------------------------------------------------
  it('getCustomers retrieves paginated customer directory with live booking totals and normalized statuses', async () => {
    const result = await getCustomers({ page: 1, limit: 10, status: 'active' })

    assert.equal(mockFetchCalls.length, 1)
    assert.equal(mockFetchCalls[0].method, 'GET')
    assert.match(mockFetchCalls[0].url, /\/api\/admin\/users\/customers/)

    assert.equal(result.customers.length, 1)
    const customer = result.customers[0]
    assert.equal(customer.name, 'Vikram Malhotra')
    assert.equal(customer.status, 'Active')
    assert.equal(customer.totalBookings, 5)
    assert.equal(customer.totalSpent, 12500)
    assert.equal(result.pagination.total, 1)
  })

  // ---------------------------------------------------------------------------
  // Test 2: Caregiver Directory API
  // ---------------------------------------------------------------------------
  it('getCaregivers retrieves paginated caregiver directory with verification and account status', async () => {
    const result = await getCaregivers({ verificationStatus: 'verified', sort: 'rating' })

    assert.equal(mockFetchCalls.length, 1)
    assert.equal(mockFetchCalls[0].method, 'GET')
    assert.match(mockFetchCalls[0].url, /\/api\/admin\/users\/caregivers/)

    assert.equal(result.caregivers.length, 1)
    const caregiver = result.caregivers[0]
    assert.equal(caregiver.name, 'Ananya Deshmukh')
    assert.equal(caregiver.qualification, 'BSc Nursing')
    assert.equal(caregiver.verificationStatus, 'Verified')
    assert.equal(caregiver.isSuspended, false)
    assert.equal(caregiver.hourlyRate, 650)
  })

  // ---------------------------------------------------------------------------
  // Test 3: Account Status Mutation with Mandatory Reason
  // ---------------------------------------------------------------------------
  it('updateUserStatus enforces mandatory reason on client and dispatches atomic PATCH', async () => {
    // A. Rejects missing reason
    await assert.rejects(
      async () => {
        await updateUserStatus(MOCK_USER_ID, { status: 'suspended', reason: '' })
      },
      (err) => {
        assert.match(err.message, /mandatory reason of at least 3 characters/i)
        return true
      },
    )

    // B. Successful status change with valid reason
    const response = await updateUserStatus(MOCK_USER_ID, {
      status: 'suspended',
      reason: 'Repeated off-platform payment solicitations',
    })

    assert.equal(response.status, 'suspended')
    assert.equal(response.statusReason, 'Repeated off-platform payment solicitations')
    assert.ok(response.statusUpdatedAt)

    const patchCall = mockFetchCalls.find((c) => c.method === 'PATCH')
    assert.ok(patchCall)
    assert.equal(patchCall.body.status, 'suspended')
    assert.equal(patchCall.body.reason, 'Repeated off-platform payment solicitations')
  })

  // ---------------------------------------------------------------------------
  // Test 4: Server Rejection Handling (Never claim false success)
  // ---------------------------------------------------------------------------
  it('updateUserStatus propagates server rejection without false success', async () => {
    await assert.rejects(
      async () => {
        await updateUserStatus(MOCK_USER_ID, {
          status: 'suspended',
          reason: 'self_lockout_test: Attempting to suspend self',
        })
      },
      (err) => {
        assert.match(err.message, /Administrators cannot suspend or block their own account/i)
        return true
      },
    )
  })

  // ---------------------------------------------------------------------------
  // Test 5: Flagged-Message Moderation Queue
  // ---------------------------------------------------------------------------
  it('getFlaggedMessages retrieves off-platform contact signals with privacy safeguards', async () => {
    const result = await getFlaggedMessages()

    assert.equal(mockFetchCalls.length, 1)
    assert.match(mockFetchCalls[0].url, /\/api\/admin\/messages\/flagged/)

    assert.equal(result.messages.length, 1)
    const msg = result.messages[0]
    assert.equal(msg.id, MOCK_MESSAGE_ID)
    assert.equal(msg.bookingNumber, 'BK-C994')
    assert.equal(msg.senderName, 'Vikram Malhotra')
    assert.equal(msg.senderRole, 'customer')
    assert.equal(msg.isFlagged, true)
    assert.equal(msg.flaggedReasons.length, 2)
    assert.match(msg.content, /9876543210/)
  })

  // ---------------------------------------------------------------------------
  // Test 6: Adapter Unit Tests
  // ---------------------------------------------------------------------------
  it('adapters normalize customer, caregiver, and flagged message representations reliably', () => {
    // 1. Customer adapter handles empty values and normalizes status
    const custAdapted = adaptCustomerAccount({
      _id: '671100001111222233334444',
      fullName: 'Sunita Rao',
      status: 'suspended',
      totalSpent: '4500',
    })
    assert.equal(custAdapted.name, 'Sunita Rao')
    assert.equal(custAdapted.status, 'Suspended')
    assert.equal(custAdapted.isSuspended, true)
    assert.equal(custAdapted.totalSpent, 4500)
    assert.equal(custAdapted.city, '—')

    // 2. Caregiver adapter handles qualification, regNo, and suspension
    const cgAdapted = adaptCaregiverAccount({
      _id: '671100001111222233334445',
      name: 'Rohan Sharma',
      qualification: 'ANM',
      nursingRegNo: 'DL-ANM-101',
      status: 'blocked',
      verificationStatus: 'verified',
    })
    assert.equal(cgAdapted.name, 'Rohan Sharma')
    assert.equal(cgAdapted.qualification, 'ANM')
    assert.equal(cgAdapted.isBlocked, true)
    assert.equal(cgAdapted.status, 'Blocked')
    assert.equal(cgAdapted.verified, true)

    // 3. Flagged message adapter ensures safe defaults
    const flagAdapted = adaptFlaggedMessage({
      _id: '671100001111222233334446',
      content: 'Call me on 9999999999',
    })
    assert.equal(flagAdapted.content, 'Call me on 9999999999')
    assert.equal(flagAdapted.bookingNumber, '—')
    assert.equal(flagAdapted.senderName, 'User')
    assert.equal(flagAdapted.isFlagged, true)
  })
})
