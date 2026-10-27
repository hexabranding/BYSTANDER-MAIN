/**
 * Participant Financial Operations Service
 *
 * Scoped endpoints for authenticated Customers and Caregivers
 * to view payment ledger history, earnings breakdowns, and request payouts.
 */

import apiClient from './apiClient.js'
import { adaptTransaction, adaptPayout } from './adapters.js'

/**
 * Retrieves payment transactions ledger for the authenticated customer.
 * @param {Object} [query={}]
 * @returns {Promise<{ transactions: Array, stats: Object }>}
 */
export const getCustomerPayments = async (query = {}) => {
  const response = await apiClient.get('/customer/payments', { params: query })
  const rawList = Array.isArray(response?.data) ? response.data : []
  const transactions = rawList.map(adaptTransaction)

  const stats = response?.stats || {
    totalSpent: transactions.reduce((s, t) => s + (t.status !== 'Refunded' ? t.amount : 0), 0),
    escrowHeld: transactions.reduce((s, t) => s + (t.status === 'Escrow Held' ? t.amount : 0), 0),
    refunded: transactions.reduce((s, t) => s + (t.status === 'Refunded' ? t.amount : 0), 0),
  }

  return {
    transactions,
    stats,
    monthlySpend: Array.isArray(response?.monthlySpend) ? response.monthlySpend : null,
  }
}

/**
 * Retrieves earnings history and totals for the authenticated caregiver.
 * @returns {Promise<{ earnings: Array, stats: Object }>}
 */
export const getCaregiverEarnings = async () => {
  const response = await apiClient.get('/caregiver/earnings')
  const rawList = Array.isArray(response?.data) ? response.data : []
  const earnings = rawList.map((e) => ({
    id: e.id || `EX-${String(e._id || '').slice(-6).toUpperCase()}`,
    date: e.date || new Date().toISOString().slice(0, 10),
    bookingId: e.bookingId || '—',
    service: e.service || 'Bedside Care',
    gross: Number(e.gross || 0),
    commission: Number(e.commission || 0),
    net: Number(e.net || 0),
    status: e.status || 'Pending',
    payoutId: e.payoutId || null,
  }))

  const stats = response?.stats || {
    totalNet: earnings.reduce((s, e) => s + e.net, 0),
    totalGross: earnings.reduce((s, e) => s + e.gross, 0),
    totalCommission: earnings.reduce((s, e) => s + e.commission, 0),
    pendingPayout: earnings.filter((e) => e.status === 'Pending').reduce((s, e) => s + e.net, 0),
    availableBalance: earnings.filter((e) => e.status === 'Released' && !e.payoutId).reduce((s, e) => s + e.net, 0),
    thisMonth: earnings.reduce((s, e) => s + e.net, 0),
    commissionPct: 12,
  }

  return {
    earnings,
    stats,
    weeklyEarnings: Array.isArray(response?.weeklyEarnings) ? response.weeklyEarnings : null,
    monthlyEarnings: Array.isArray(response?.monthlyEarnings) ? response.monthlyEarnings : null,
  }
}

/**
 * Caregiver requests a payout batch for completed shifts.
 * @param {Object} payload - { disbursalMethod?, notes? }
 * @returns {Promise<Object>}
 */
export const requestCaregiverPayout = async (payload = {}) => {
  const response = await apiClient.post('/caregiver/payouts/request', payload)
  const rawData = response?.data || response
  return adaptPayout(rawData)
}

/**
 * Simulate payment for a booking in test/development environment.
 * Connects to /api/test/payments/:bookingId/simulate.
 * @param {string} bookingId - Booking ObjectId
 * @param {Object} [simulationData={}] - { status }
 * @returns {Promise<Object>}
 */
export const simulateBookingPayment = async (bookingId, simulationData = {}) => {
  if (!bookingId) {
    throw new Error('A booking identifier is required for payment simulation')
  }
  const response = await apiClient.post(`/test/payments/${bookingId}/simulate`, simulationData)
  return response?.data || response
}

/**
 * Retrieve simulated payment status for a booking.
 * @param {string} bookingId - Booking ObjectId
 * @returns {Promise<Object>}
 */
export const getSimulatedBookingPayment = async (bookingId) => {
  if (!bookingId) {
    throw new Error('A booking identifier is required')
  }
  const response = await apiClient.get(`/test/payments/${bookingId}`)
  return response?.data || response
}

/**
 * Dynamically loads the official Razorpay Checkout SDK script
 * @returns {Promise<boolean>}
 */
export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

/**
 * Retrieves the public Razorpay test key ID
 * @returns {Promise<string>}
 */
export const getRazorpayKey = async () => {
  try {
    const response = await apiClient.get('/payments/key')
    return response?.keyId || response?.data?.keyId || 'rzp_test_bystander_sandbox'
  } catch (_) {
    return 'rzp_test_bystander_sandbox'
  }
}

/**
 * Creates a Razorpay Order for a specific booking
 * @param {string} bookingId
 * @returns {Promise<Object>}
 */
export const createPaymentOrder = async (bookingId) => {
  if (!bookingId) throw new Error('A valid booking ID is required')
  const response = await apiClient.post('/payments/create-order', { bookingId })
  return response?.data || response
}

/**
 * Verifies Razorpay payment signature
 * @param {Object} paymentData - { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * @returns {Promise<Object>}
 */
export const verifyPaymentSignature = async (paymentData) => {
  const response = await apiClient.post('/payments/verify', paymentData)
  return response?.data || response
}

/**
 * Releases escrow funds upon shift completion
 * @param {string} bookingId
 * @returns {Promise<Object>}
 */
export const releaseEscrow = async (bookingId) => {
  if (!bookingId) throw new Error('A valid booking ID is required')
  const response = await apiClient.post('/payments/release-escrow', { bookingId })
  return response?.data || response
}

export const financeService = {
  getCustomerPayments,
  getCaregiverEarnings,
  requestCaregiverPayout,
  loadRazorpayScript,
  getRazorpayKey,
  createPaymentOrder,
  verifyPaymentSignature,
  releaseEscrow,
  simulateBookingPayment,
  getSimulatedBookingPayment,
}

export default financeService

