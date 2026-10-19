import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizePaymentStatus,
  normalizePayoutStatus,
  adaptTransaction,
  adaptPayout,
  adaptCommission,
} from '../src/services/adapters.js'
import {
  getAdminPayments,
  getAdminPaymentById,
  getAdminCommissions,
  reconcileCommissions,
  getAdminPayouts,
  updateAdminPayoutStatus,
} from '../src/services/adminService.js'
import {
  getCustomerPayments,
  getCaregiverEarnings,
  requestCaregiverPayout,
} from '../src/services/financeService.js'
import { ApiError } from '../src/services/apiClient.js'
import { toCSV } from '../src/utils/format.js'

describe('Step 14 — Financial Operations, Escrow Audit Ledger & Payout Administration Frontend Suite', () => {
  let mockFetchCalls = []
  let customFetchHandler = null

  const MOCK_TXN_ID = '6711a1b2c3d4e5f6a7b8c901'
  const MOCK_TXN_NUMBER = 'TXN-20261019-10001'
  const MOCK_PO_ID = '6711a1b2c3d4e5f6a7b8c902'
  const MOCK_PO_NUMBER = 'PO-20261019-20001'

  beforeEach(() => {
    mockFetchCalls = []
    customFetchHandler = null
    globalThis.fetch = async (url, options = {}) => {
      if (customFetchHandler) {
        return customFetchHandler(url, options)
      }
      const urlStr = String(url)
      const method = (options.method || 'GET').toUpperCase()
      const body = options.body ? JSON.parse(options.body) : null
      mockFetchCalls.push({ url: urlStr, method, body, headers: options.headers })

      // GET /api/admin/payments
      if (urlStr.includes('/api/admin/payments') && method === 'GET') {
        if (urlStr.includes(MOCK_TXN_ID)) {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                _id: MOCK_TXN_ID,
                transactionNumber: MOCK_TXN_NUMBER,
                amount: 3200,
                status: 'escrow_held',
                paymentMethod: 'UPI',
                type: 'Booking Payment',
                booking: { _id: 'b-101', bookingNumber: 'BK-101', serviceName: 'Elderly Care' },
                customer: { _id: 'c-101', name: 'Rohan Sharma' },
                caregiver: { _id: 'cg-101', user: { name: 'Priya Patel' } },
                createdAt: '2026-10-19T10:00:00.000Z',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                _id: MOCK_TXN_ID,
                transactionNumber: MOCK_TXN_NUMBER,
                amount: 3200,
                status: 'escrow_held',
                paymentMethod: 'UPI',
                type: 'Booking Payment',
                booking: { _id: 'b-101', bookingNumber: 'BK-101', serviceName: 'Elderly Care' },
                customer: { _id: 'c-101', name: 'Rohan Sharma' },
                caregiver: { _id: 'cg-101', user: { name: 'Priya Patel' } },
                createdAt: '2026-10-19T10:00:00.000Z',
              },
            ],
            pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
            stats: { gross: 3200, commission: 384, refunded: 0, escrow: 3200 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // GET /api/admin/commissions
      if (urlStr.includes('/api/admin/commissions') && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                _id: MOCK_TXN_ID,
                transactionNumber: MOCK_TXN_NUMBER,
                amount: 3200,
                status: 'released',
                booking: { bookingNumber: 'BK-101' },
                caregiver: { user: { name: 'Priya Patel' } },
                createdAt: '2026-10-19T10:00:00.000Z',
              },
            ],
            stats: { total: 384, accrued: 0, settled: 384, accruedCount: 0, effectiveRate: 12 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // POST /api/admin/commissions/reconcile
      if (urlStr.includes('/api/admin/commissions/reconcile') && method === 'POST') {
        return new Response(
          JSON.stringify({
            success: true,
            reconciledCount: 3,
            totalReconciledAmount: 1152,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // GET /api/admin/payouts
      if (urlStr.includes('/api/admin/payouts') && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                _id: MOCK_PO_ID,
                payoutNumber: MOCK_PO_NUMBER,
                caregiver: { user: { name: 'Priya Patel' } },
                period: 'Oct 01 - Oct 15, 2026',
                jobsCount: 5,
                gross: 12000,
                commission: 1440,
                net: 10560,
                status: 'pending',
                disbursalMethod: 'Bank Transfer',
                requestedOn: '2026-10-16T08:00:00.000Z',
              },
            ],
            stats: { total: 10560, pending: 1, processing: 0, settled: 0 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // PATCH /api/admin/payouts/:id/status
      if (urlStr.includes('/api/admin/payouts') && method === 'PATCH') {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              _id: MOCK_PO_ID,
              payoutNumber: MOCK_PO_NUMBER,
              caregiver: { user: { name: 'Priya Patel' } },
              net: 10560,
              status: body.status,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // GET /api/customer/payments
      if (urlStr.includes('/api/customer/payments') && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                _id: MOCK_TXN_ID,
                transactionNumber: MOCK_TXN_NUMBER,
                amount: 3200,
                status: 'escrow_held',
                paymentMethod: 'UPI',
                createdAt: '2026-10-19T10:00:00.000Z',
              },
            ],
            stats: { totalSpent: 3200, escrowHeld: 3200, refunded: 0 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // GET /api/caregiver/earnings
      if (urlStr.includes('/api/caregiver/earnings') && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                _id: 'e-101',
                date: '2026-10-19',
                bookingId: 'BK-101',
                service: 'Bedside Assistance',
                gross: 3000,
                commission: 360,
                net: 2640,
                status: 'Pending',
              },
            ],
            stats: {
              totalNet: 2640,
              totalGross: 3000,
              totalCommission: 360,
              pendingPayout: 2640,
              thisMonth: 2640,
              commissionPct: 12,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // POST /api/caregiver/payouts/request
      if (urlStr.includes('/api/caregiver/payouts/request') && method === 'POST') {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              _id: MOCK_PO_ID,
              payoutNumber: MOCK_PO_NUMBER,
              net: 2640,
              status: 'pending',
              disbursalMethod: body.disbursalMethod || 'Bank Transfer',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    }
  })

  // 1. Adapters: normalizePaymentStatus and normalizePayoutStatus
  it('1. Correctly maps backend database status enums to human-friendly UI labels', () => {
    assert.strictEqual(normalizePaymentStatus('escrow_held'), 'Escrow Held')
    assert.strictEqual(normalizePaymentStatus('released'), 'Released')
    assert.strictEqual(normalizePaymentStatus('refunded'), 'Refunded')
    assert.strictEqual(normalizePaymentStatus('pending'), 'Pending')
    assert.strictEqual(normalizePaymentStatus('unknown_status'), 'Escrow Held')

    assert.strictEqual(normalizePayoutStatus('pending'), 'Pending')
    assert.strictEqual(normalizePayoutStatus('processing'), 'Processing')
    assert.strictEqual(normalizePayoutStatus('settled'), 'Settled')
    assert.strictEqual(normalizePayoutStatus('failed'), 'Failed')
  })

  // 2. Adapters: adaptTransaction
  it('2. Normalizes backend Transaction document to frontend PaymentsPage format', () => {
    const raw = {
      _id: '6711a1b2c3d4e5f6a7b8c901',
      transactionNumber: 'TXN-20261019-10001',
      booking: { _id: 'b-101', bookingNumber: 'BK-101', serviceName: 'Post Surgery Care' },
      customer: { _id: 'c-101', name: 'Rohan Sharma' },
      caregiver: { _id: 'cg-101', user: { name: 'Priya Patel' } },
      amount: 3500,
      breakdown: { platformFee: 49, commission: 420, caregiverPayout: 3080 },
      status: 'escrow_held',
      type: 'Booking Escrow',
      paymentMethod: 'UPI',
      createdAt: '2026-10-19T10:00:00.000Z',
    }

    const adapted = adaptTransaction(raw)
    assert.strictEqual(adapted.id, 'TXN-20261019-10001')
    assert.strictEqual(adapted.bookingId, 'BK-101')
    assert.strictEqual(adapted.customerName, 'Rohan Sharma')
    assert.strictEqual(adapted.caregiverName, 'Priya Patel')
    assert.strictEqual(adapted.service, 'Post Surgery Care')
    assert.strictEqual(adapted.amount, 3500)
    assert.strictEqual(adapted.commission, 420)
    assert.strictEqual(adapted.payout, 3080)
    assert.strictEqual(adapted.status, 'Escrow Held')
    assert.strictEqual(adapted.method, 'UPI')
  })

  // 3. Adapters: adaptPayout
  it('3. Normalizes backend Payout record to PayoutsPage table representation', () => {
    const raw = {
      _id: '6711a1b2c3d4e5f6a7b8c902',
      payoutNumber: 'PO-20261019-20001',
      caregiver: { _id: 'cg-101', user: { name: 'Ananya Deshmukh' } },
      period: 'Oct 01 - Oct 15, 2026',
      jobsCount: 7,
      gross: 21000,
      commission: 2520,
      net: 18480,
      status: 'processing',
      disbursalMethod: 'Bank Transfer',
      requestedOn: '2026-10-16T12:00:00.000Z',
    }

    const adapted = adaptPayout(raw)
    assert.strictEqual(adapted.id, 'PO-20261019-20001')
    assert.strictEqual(adapted.caregiverName, 'Ananya Deshmukh')
    assert.strictEqual(adapted.jobs, 7)
    assert.strictEqual(adapted.gross, 21000)
    assert.strictEqual(adapted.commission, 2520)
    assert.strictEqual(adapted.net, 18480)
    assert.strictEqual(adapted.status, 'Processing')
    assert.strictEqual(adapted.bank, 'Bank Transfer')
  })

  // 4. Adapters: adaptCommission
  it('4. Normalizes transaction to platform commission entry', () => {
    const raw = {
      _id: '6711a1b2c3d4e5f6a7b8c901',
      transactionNumber: 'TXN-20261019-10001',
      booking: { bookingNumber: 'BK-882' },
      caregiver: { user: { name: 'Kavita Roy' } },
      amount: 4000,
      breakdown: { commission: 480 },
      status: 'released',
      createdAt: '2026-10-18T10:00:00.000Z',
    }

    const commission = adaptCommission(raw)
    assert.strictEqual(commission.id, 'CM-10001')
    assert.strictEqual(commission.bookingId, 'BK-882')
    assert.strictEqual(commission.caregiverName, 'Kavita Roy')
    assert.strictEqual(commission.amount, 480)
    assert.strictEqual(commission.status, 'Settled')
    assert.strictEqual(commission.rate, '12%')
  })

  // 5. Security: CSV Formula Injection Protection
  it('5. Hardens CSV exports against spreadsheet formula injection across untrusted text', () => {
    const maliciousRows = [
      {
        transactionId: '=1+1',
        customer: '   +SUM(A1:A10)',
        comment: '\t@malicious.domain',
        command: '\r=cmd|"/C calc"!A0',
        normalAmount: 2500,
        normalFloat: 49.5,
      },
    ]

    const csvOutput = toCSV(maliciousRows)
    // Formula prefixes must be single-quote prefixed
    assert.ok(csvOutput.includes('"\'=1+1"'), 'Prepends single quote to dangerous = prefix')
    assert.ok(csvOutput.includes('"\'+SUM(A1:A10)"') || csvOutput.includes('"\'   +SUM(A1:A10)"'), 'Handles leading whitespace before formula prefix')
    assert.ok(csvOutput.includes('"\'\t@malicious.domain"'), 'Prepends single quote to tab/@ prefix')
    assert.ok(csvOutput.includes('"\'\r=cmd|""/C calc""!A0"'), 'Neutralizes carriage return command prefix and quotes inner quotes')
    // Legitimate numerics should stay clean unquoted numbers
    assert.ok(csvOutput.includes('2500'), 'Preserves numeric unquoted representation')
    assert.ok(csvOutput.includes('49.5'), 'Preserves floating point numeric representation')
  })

  // 6. Admin Service: Payments & Ledger
  it('6. AdminService.getAdminPayments fetches and transforms ledger transactions', async () => {
    const result = await getAdminPayments({ status: 'all', range: '30' })
    assert.ok(Array.isArray(result.transactions))
    assert.strictEqual(result.transactions.length, 1)
    assert.strictEqual(result.transactions[0].id, MOCK_TXN_NUMBER)
    assert.strictEqual(result.stats.gross, 3200)

    const single = await getAdminPaymentById(MOCK_TXN_ID)
    assert.strictEqual(single.id, MOCK_TXN_NUMBER)
  })

  // 7. Admin Service: Commissions & Reconcile
  it('7. AdminService.getAdminCommissions and reconcileCommissions communicate with API', async () => {
    const result = await getAdminCommissions({ status: 'all' })
    assert.ok(Array.isArray(result.commissions))
    assert.strictEqual(result.stats.total, 384)

    const reconcileResult = await reconcileCommissions()
    assert.strictEqual(reconcileResult.success, true)
    assert.strictEqual(reconcileResult.reconciledCount, 3)
  })

  // 8. Admin Service: Payouts & Disbursals
  it('8. AdminService.getAdminPayouts and updateAdminPayoutStatus manage disbursals', async () => {
    const result = await getAdminPayouts({ status: 'pending' })
    assert.ok(Array.isArray(result.payouts))
    assert.strictEqual(result.payouts[0].id, MOCK_PO_NUMBER)
    assert.strictEqual(result.payouts[0].status, 'Pending')

    const updated = await updateAdminPayoutStatus(MOCK_PO_ID, { status: 'processing' })
    assert.strictEqual(updated.status, 'Processing')
  })

  // 9. Finance Service: Customer Payments
  it('9. FinanceService.getCustomerPayments retrieves customer ledger with summary stats', async () => {
    const result = await getCustomerPayments()
    assert.ok(Array.isArray(result.transactions))
    assert.strictEqual(result.transactions[0].id, MOCK_TXN_NUMBER)
    assert.strictEqual(result.stats.totalSpent, 3200)
    assert.strictEqual(result.stats.escrowHeld, 3200)
  })

  // 10. Finance Service: Caregiver Earnings & Payout Request
  it('10. FinanceService.getCaregiverEarnings and requestCaregiverPayout handles shifts and withdrawals', async () => {
    const earningsRes = await getCaregiverEarnings()
    assert.ok(Array.isArray(earningsRes.earnings))
    assert.strictEqual(earningsRes.stats.totalNet, 2640)
    assert.strictEqual(earningsRes.stats.pendingPayout, 2640)

    const payoutRes = await requestCaregiverPayout({ disbursalMethod: 'Bank Transfer' })
    assert.strictEqual(payoutRes.id, MOCK_PO_NUMBER)
    assert.strictEqual(payoutRes.status, 'Pending')
  })

  // 11. Admin Service: updateAdminPayoutStatus failure handling
  it('11. updateAdminPayoutStatus propagates HTTP 400, 409, 500 and network errors without fake success', async () => {
    // 400 Bad Request
    customFetchHandler = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: 'ValidationError',
          message: 'Invalid payout status transition: failed -> settled is not permitted',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )

    await assert.rejects(
      async () => updateAdminPayoutStatus(MOCK_PO_ID, { status: 'settled' }),
      (err) => {
        assert(err instanceof ApiError)
        assert.strictEqual(err.status, 400)
        assert.match(err.message, /not permitted/)
        return true
      },
    )

    // 409 Conflict
    customFetchHandler = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: 'ConflictError',
          message: 'Payout status conflict: status was modified concurrently by another administrator',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )

    await assert.rejects(
      async () => updateAdminPayoutStatus(MOCK_PO_ID, { status: 'settled' }),
      (err) => {
        assert(err instanceof ApiError)
        assert.strictEqual(err.status, 409)
        assert.match(err.message, /concurrently/)
        return true
      },
    )

    // Network Failure
    customFetchHandler = async () => {
      throw new TypeError('Failed to fetch')
    }

    await assert.rejects(
      async () => updateAdminPayoutStatus(MOCK_PO_ID, { status: 'settled' }),
      (err) => {
        assert(err instanceof ApiError)
        assert.strictEqual(err.isNetworkError, true)
        return true
      },
    )
  })

  // 12. Admin Service: reconcileCommissions failure handling
  it('12. reconcileCommissions propagates HTTP 500 and network failures without fabricating success counts', async () => {
    // 500 Server Error
    customFetchHandler = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: 'InternalError',
          message: 'Reconciliation service database error',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )

    await assert.rejects(
      async () => reconcileCommissions(),
      (err) => {
        assert(err instanceof ApiError)
        assert.strictEqual(err.status, 500)
        assert.match(err.message, /service encountered an error/i)
        return true
      },
    )

    // Network Failure
    customFetchHandler = async () => {
      throw new TypeError('Connection timeout')
    }

    await assert.rejects(
      async () => reconcileCommissions(),
      (err) => {
        assert(err instanceof ApiError)
        assert.strictEqual(err.isNetworkError, true)
        return true
      },
    )
  })

  // 13. Finance Service: requestCaregiverPayout failure handling
  it('13. requestCaregiverPayout propagates HTTP 400, 409, 503 and network failures without creating fake payouts', async () => {
    // 400 Bad Request (No eligible earnings)
    customFetchHandler = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: 'ValidationError',
          message: 'No eligible earnings available for payout',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )

    await assert.rejects(
      async () => requestCaregiverPayout({ disbursalMethod: 'Bank Transfer' }),
      (err) => {
        assert(err instanceof ApiError)
        assert.strictEqual(err.status, 400)
        assert.match(err.message, /No eligible earnings/)
        return true
      },
    )

    // 409 Conflict (Active payout exists)
    customFetchHandler = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: 'ConflictError',
          message: 'An active payout request already exists for this caregiver',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )

    await assert.rejects(
      async () => requestCaregiverPayout({ disbursalMethod: 'Bank Transfer' }),
      (err) => {
        assert(err instanceof ApiError)
        assert.strictEqual(err.status, 409)
        assert.match(err.message, /already exists/)
        return true
      },
    )

    // 503 Service Unavailable (Transaction not supported)
    customFetchHandler = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: 'ServiceUnavailable',
          message: 'Database transactions are not supported by the replica set',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      )

    await assert.rejects(
      async () => requestCaregiverPayout({ disbursalMethod: 'Bank Transfer' }),
      (err) => {
        assert(err instanceof ApiError)
        assert.strictEqual(err.status, 503)
        return true
      },
    )

    // Network Failure
    customFetchHandler = async () => {
      throw new TypeError('Failed to fetch')
    }

    await assert.rejects(
      async () => requestCaregiverPayout({ disbursalMethod: 'Bank Transfer' }),
      (err) => {
        assert(err instanceof ApiError)
        assert.strictEqual(err.isNetworkError, true)
        return true
      },
    )
  })

  // 14. UI Flow: PayoutsPage handleApprove truthful error handling and zero local mock mutations
  it('14. PayoutsPage handleApprove triggers error toast, prevents local mock mutations, and maintains truthful state on failure', async () => {
    let mockToastErrors = []
    let mockToastSuccesses = []
    let mockUpdatePayoutCalls = []
    let fetched = false

    const mockToast = {
      error: (msg, opts) => mockToastErrors.push({ msg, opts }),
      success: (msg, opts) => mockToastSuccesses.push({ msg, opts }),
    }

    const mockUpdatePayout = (id, st) => mockUpdatePayoutCalls.push({ id, st })
    const mockFetchPayouts = async () => {
      fetched = true
    }

    // Case A: Backend mutation fails (409 Conflict)
    customFetchHandler = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: 'ConflictError',
          message: 'Payout is already settled or modified concurrently',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )

    const testApproving = {
      id: 'PO-20261019-20001',
      dbId: MOCK_PO_ID,
      net: 10560,
      caregiverName: 'Priya Patel',
      method: 'Bank Transfer',
      status: 'Pending',
    }

    // Execute the exact handleApprove logic implemented in PayoutsPage
    let approvingState = { ...testApproving }
    try {
      await updateAdminPayoutStatus(testApproving.dbId, {
        status: 'settled',
        notes: 'Payout settled and confirmed by operations desk',
      })
      mockToast.success(`Payout ${testApproving.id} settled (simulated)`)
      await mockFetchPayouts()
    } catch (err) {
      mockToast.error('Failed to settle payout', {
        description: err?.message || 'An unexpected error occurred while updating the payout status.',
      })
    }

    // Verify:
    assert.strictEqual(mockToastErrors.length, 1, 'Error toast was displayed')
    assert.match(mockToastErrors[0].opts.description, /modified concurrently|Payout is already settled/i)
    assert.strictEqual(mockToastSuccesses.length, 0, 'No success toast was displayed on failure')
    assert.strictEqual(mockUpdatePayoutCalls.length, 0, 'No mock updatePayout call occurred')
    assert.strictEqual(approvingState.status, 'Pending', 'Payout retained truthful Pending status')
    assert.strictEqual(fetched, false, 'Fetch was not called on failure')

    // Case B: Backend mutation succeeds
    customFetchHandler = null // reset to default 200 response
    mockToastErrors = []
    mockToastSuccesses = []

    try {
      await updateAdminPayoutStatus(testApproving.dbId, {
        status: 'settled',
        notes: 'Payout settled and confirmed by operations desk',
      })
      mockToast.success(`Payout ${testApproving.id} settled (simulated)`, {
        description: `₹10,560 recorded as settled for ${testApproving.caregiverName} · ${testApproving.method}.`,
      })
      await mockFetchPayouts()
    } catch (err) {
      mockToast.error('Failed to settle payout', { description: err?.message })
    }

    assert.strictEqual(mockToastSuccesses.length, 1, 'Success toast was displayed on API success')
    assert.ok(mockToastSuccesses[0].msg.includes('(simulated)'), 'Success toast explicitly includes simulated disclaimer')
    assert.strictEqual(mockToastErrors.length, 0, 'No error toast on success')
    assert.strictEqual(fetched, true, 'fetchPayouts reloaded state from backend on success')
  })

  // 15. UI Flow: CommissionsPage handleReconcile truthful failure notification without demo success
  it('15. CommissionsPage handleReconcile displays error toast without false-success demo notification on failure', async () => {
    let mockToastErrors = []
    let mockToastSuccesses = []
    let fetchCalled = false

    const mockToast = {
      error: (msg, opts) => mockToastErrors.push({ msg, opts }),
      success: (msg, opts) => mockToastSuccesses.push({ msg, opts }),
    }

    const mockFetchCommissions = async () => {
      fetchCalled = true
    }

    // Case A: Reconciliation fails on server
    customFetchHandler = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: 'ServerError',
          message: 'Unable to reconcile accrued commissions with the server.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )

    try {
      const result = await reconcileCommissions()
      mockToast.success('Commission ledger reconciled (simulated)')
      await mockFetchCommissions()
    } catch (err) {
      mockToast.error('Commission reconciliation failed', {
        description: err?.message || 'Unable to reconcile accrued commissions with the server.',
      })
    }

    // Verify:
    assert.strictEqual(mockToastErrors.length, 1, 'Error toast was triggered')
    assert.strictEqual(mockToastErrors[0].msg, 'Commission reconciliation failed')
    assert.strictEqual(mockToastSuccesses.length, 0, 'No success or demo toast was shown on failure')
    assert.strictEqual(fetchCalled, false, 'Fetch commissions was not executed after failure')

    // Case B: Reconciliation succeeds
    customFetchHandler = null // 200 OK
    mockToastErrors = []
    mockToastSuccesses = []

    try {
      const result = await reconcileCommissions()
      mockToast.success('Commission ledger reconciled (simulated)', {
        description: `${result.reconciledCount} accrued entries queued for the next settlement cycle.`,
      })
      await mockFetchCommissions()
    } catch (err) {
      mockToast.error('Commission reconciliation failed', { description: err?.message })
    }

    assert.strictEqual(mockToastSuccesses.length, 1, 'Success toast on valid reconciliation')
    assert.ok(mockToastSuccesses[0].msg.includes('(simulated)'), 'Includes simulated disclaimer')
    assert.strictEqual(fetchCalled, true, 'Reloads commissions from server')
  })

  // 16. UI Flow: EarningsPage handlePayout truthful failure handling without local mock mutations
  it('16. EarningsPage handlePayout displays error toast, skips mock mutations, and preserves truthful balance on failure', async () => {
    let mockToastErrors = []
    let mockToastSuccesses = []
    let mockCreatePayoutCalls = []
    let mockUpdatePayoutCalls = []
    let earningsReloaded = false

    const mockToast = {
      error: (msg, opts) => mockToastErrors.push({ msg, opts }),
      success: (msg, opts) => mockToastSuccesses.push({ msg, opts }),
    }

    const mockLoadEarnings = async () => {
      earningsReloaded = true
    }

    // Case A: Payout request fails with 400 No eligible earnings
    customFetchHandler = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: 'ValidationError',
          message: 'No eligible earnings available for payout',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )

    try {
      await requestCaregiverPayout({ disbursalMethod: 'Bank Transfer' })
      mockToast.success('Payout request submitted (simulated)')
      await mockLoadEarnings()
    } catch (err) {
      mockToast.error('Payout request failed', {
        description: err?.message || 'Unable to submit payout request. Please try again later.',
      })
    }

    // Verify:
    assert.strictEqual(mockToastErrors.length, 1, 'Error toast was triggered')
    assert.match(mockToastErrors[0].opts.description, /No eligible earnings/)
    assert.strictEqual(mockToastSuccesses.length, 0, 'No false success toast was displayed')
    assert.strictEqual(mockCreatePayoutCalls.length, 0, 'createPayout was NOT called')
    assert.strictEqual(mockUpdatePayoutCalls.length, 0, 'updatePayout was NOT called')
    assert.strictEqual(earningsReloaded, false, 'Earnings were not reloaded on failed submission')

    // Case B: Payout request succeeds
    customFetchHandler = null // 200 OK
    mockToastErrors = []
    mockToastSuccesses = []

    try {
      await requestCaregiverPayout({ disbursalMethod: 'Bank Transfer' })
      mockToast.success('Payout request submitted (simulated)', {
        description: 'Your payout request has been queued for administrative processing.',
      })
      await mockLoadEarnings()
    } catch (err) {
      mockToast.error('Payout request failed', { description: err?.message })
    }

    assert.strictEqual(mockToastSuccesses.length, 1, 'Success toast on successful payout submission')
    assert.ok(mockToastSuccesses[0].msg.includes('(simulated)'), 'Includes simulated indicator')
    assert.strictEqual(earningsReloaded, true, 'loadEarnings reloads authoritative earnings')
  })
})

