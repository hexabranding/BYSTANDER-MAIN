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
import { toCSV } from '../src/utils/format.js'

describe('Step 14 — Financial Operations, Escrow Audit Ledger & Payout Administration Frontend Suite', () => {
  let mockFetchCalls = []

  const MOCK_TXN_ID = '6711a1b2c3d4e5f6a7b8c901'
  const MOCK_TXN_NUMBER = 'TXN-20261019-10001'
  const MOCK_PO_ID = '6711a1b2c3d4e5f6a7b8c902'
  const MOCK_PO_NUMBER = 'PO-20261019-20001'

  beforeEach(() => {
    mockFetchCalls = []
    globalThis.fetch = async (url, options = {}) => {
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
})
