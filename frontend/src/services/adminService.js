/**
 * Admin Operations & Verification Domain Service
 *
 * Provides administrative oversight capabilities including caregiver verification
 * queue processing, document review, and status transitions against the Express/MongoDB backend.
 *
 * All operations run strictly in api-only mode (no static fallbacks) with admin authorization.
 */

import apiClient from './apiClient.js'
import {
  adaptVerificationRecord,
  adaptVerificationDocument,
  adaptCustomerAccount,
  adaptCaregiverAccount,
  adaptFlaggedMessage,
  adaptComplaint,
  denormalizeComplaintStatus,
  adaptTransaction,
  adaptPayout,
  adaptCommission,
} from './adapters.js'

/**
 * Retrieves list of caregiver applications awaiting verification or filtered by status.
 * @param {Object} [query={}] - Optional filters (status, search, page, limit)
 * @returns {Promise<{ verifications: Array, pagination: Object }>}
 */
export const getVerifications = async (query = {}) => {
  const response = await apiClient.get('/admin/verifications', { params: query })
  const rawList = Array.isArray(response?.data) ? response.data : []
  const verifications = rawList.map(adaptVerificationRecord)

  const pagination = response?.pagination || {
    total: verifications.length,
    page: 1,
    limit: verifications.length || 10,
    totalPages: 1,
  }

  return { verifications, pagination }
}

/**
 * Retrieves a single caregiver verification dossier with all submitted documents and review audit history.
 * @param {string} id - CaregiverProfile ObjectId
 * @returns {Promise<Object>} Adapted verification record
 */
export const getVerificationById = async (id) => {
  if (!id) {
    throw new Error('A caregiver identifier is required')
  }

  const response = await apiClient.get(`/admin/verifications/${id}`)
  const rawData = response?.data || response
  return adaptVerificationRecord(rawData)
}

/**
 * Reviews and updates the status of an individual document (approve, reject, or under review).
 * @param {string} documentId - Document ObjectId
 * @param {Object} payload - { status: 'verified' | 'rejected' | 'under_review', notes?: string }
 * @returns {Promise<Object>} Updated and adapted document
 */
export const updateDocumentStatus = async (documentId, payload) => {
  if (!documentId) {
    throw new Error('A valid document identifier is required')
  }

  if (!payload || !payload.status) {
    throw new Error('Document status is required')
  }

  const response = await apiClient.patch(`/admin/verifications/documents/${documentId}`, payload)
  const rawData = response?.data || response
  return adaptVerificationDocument(rawData)
}

/**
 * Updates the overall verification status of a caregiver application.
 * @param {string} caregiverId - CaregiverProfile ObjectId
 * @param {Object} payload - { status: 'verified' | 'rejected' | 'under_review', reason?: string, trustScore?: number }
 * @returns {Promise<Object>} Updated and adapted verification record
 */
export const updateCaregiverVerificationStatus = async (caregiverId, payload) => {
  if (!caregiverId) {
    throw new Error('A valid caregiver identifier is required')
  }

  if (!payload || !payload.status) {
    throw new Error('Verification status is required')
  }

  const response = await apiClient.patch(`/admin/verifications/${caregiverId}/status`, payload)
  const rawData = response?.data || response
  return adaptVerificationRecord(rawData)
}

/**
 * Retrieves paginated list of registered customers with real database profile and booking summaries.
 * @param {Object} [query={}] - Optional filters (page, limit, status, city, search)
 * @returns {Promise<{ customers: Array, pagination: Object, stats: Object }>}
 */
export const getCustomers = async (query = {}) => {
  const response = await apiClient.get('/admin/users/customers', { params: query })
  const rawList = Array.isArray(response?.data) ? response.data : []
  const customers = rawList.map(adaptCustomerAccount)

  const pagination = response?.pagination || {
    total: customers.length,
    page: 1,
    limit: customers.length || 10,
    totalPages: 1,
  }

  const stats = response?.stats || {
    total: customers.length,
    active: customers.filter((c) => c.status === 'Active').length,
    suspended: customers.filter((c) => c.status === 'Suspended').length,
    blocked: customers.filter((c) => c.status === 'Blocked').length,
  }

  return { customers, pagination, stats }
}

/**
 * Retrieves paginated list of registered caregivers with verification and account status.
 * @param {Object} [query={}] - Optional filters (page, limit, status, verificationStatus, city, qualification, sort, search)
 * @returns {Promise<{ caregivers: Array, pagination: Object, stats: Object }>}
 */
export const getCaregivers = async (query = {}) => {
  const response = await apiClient.get('/admin/users/caregivers', { params: query })
  const rawList = Array.isArray(response?.data) ? response.data : []
  const caregivers = rawList.map(adaptCaregiverAccount)

  const pagination = response?.pagination || {
    total: caregivers.length,
    page: 1,
    limit: caregivers.length || 10,
    totalPages: 1,
  }

  const stats = response?.stats || {
    total: caregivers.length,
    verified: caregivers.filter((c) => c.verificationStatus === 'Verified').length,
    pending: caregivers.filter((c) => c.verificationStatus === 'Pending' || c.verificationStatus === 'Under Review').length,
    rejected: caregivers.filter((c) => c.verificationStatus === 'Rejected').length,
  }

  return { caregivers, pagination, stats }
}

/**
 * Updates a user account status (active, suspended, blocked) with mandatory audit reason.
 * @param {string} userId - User ObjectId or CaregiverProfile ObjectId
 * @param {Object} payload - { status: 'active' | 'suspended' | 'blocked', reason: string }
 * @returns {Promise<Object>} Updated user record
 */
export const updateUserStatus = async (userId, payload) => {
  if (!userId) {
    throw new Error('A valid user identifier is required')
  }

  if (!payload || !payload.status) {
    throw new Error('Account status is required')
  }

  if (!payload.reason || typeof payload.reason !== 'string' || payload.reason.trim().length < 3) {
    throw new Error('A mandatory reason of at least 3 characters is required for status changes')
  }

  const response = await apiClient.patch(`/admin/users/${userId}/status`, payload)
  return response?.data || response
}

/**
 * Retrieves paginated moderation queue of flagged messages (off-platform contact/payment signals).
 * @param {Object} [query={}] - Optional filters (page, limit, search, reason, bookingId)
 * @returns {Promise<{ messages: Array, pagination: Object, stats: Object }>}
 */
export const getFlaggedMessages = async (query = {}) => {
  const response = await apiClient.get('/admin/messages/flagged', { params: query })
  const rawList = Array.isArray(response?.data) ? response.data : []
  const messages = rawList.map(adaptFlaggedMessage)

  const pagination = response?.pagination || {
    total: messages.length,
    page: 1,
    limit: messages.length || 10,
    totalPages: 1,
  }

  const stats = response?.stats || {
    totalFlagged: messages.length,
    phoneSignals: messages.filter((m) => m.flaggedReasons.some((r) => /phone/i.test(r))).length,
    upiSignals: messages.filter((m) => m.flaggedReasons.some((r) => /upi/i.test(r))).length,
  }

  return { messages, pagination, stats }
}

/**
 * Retrieves paginated administrative queue of complaints with triage statistics.
 * @param {Object} [query={}] - Optional filters (page, limit, status, priority, category, search)
 * @returns {Promise<{ complaints: Array, pagination: Object, stats: Object }>}
 */
export const getComplaints = async (query = {}) => {
  const params = { ...query }
  if (params.status && params.status !== 'All') {
    params.status = denormalizeComplaintStatus(params.status)
  }
  const response = await apiClient.get('/admin/complaints', { params })
  const rawList = Array.isArray(response?.data) ? response.data : []
  const complaints = rawList.map(adaptComplaint)

  const pagination = response?.pagination || {
    total: complaints.length,
    page: 1,
    limit: complaints.length || 10,
    totalPages: 1,
  }

  const stats = response?.stats || {
    total: complaints.length,
    open: complaints.filter((c) => c.status === 'Submitted').length,
    underReview: complaints.filter((c) => ['Under Review', 'Investigation'].includes(c.status)).length,
    resolved: complaints.filter((c) => c.status === 'Resolved').length,
    highPriority: complaints.filter((c) => ['High', 'Critical'].includes(c.priority)).length,
  }

  return { complaints, pagination, stats }
}

/**
 * Retrieves a single administrative complaint dossier with full internal notes and timeline.
 * @param {string} id - Complaint identifier (ObjectId or CP- reference)
 * @returns {Promise<Object>} Adapted complaint dossier
 */
export const getAdminComplaintById = async (id) => {
  if (!id) {
    throw new Error('Complaint identifier is required')
  }

  const response = await apiClient.get(`/admin/complaints/${id}`)
  const rawData = response?.data || response
  return adaptComplaint(rawData)
}

/**
 * Transitions complaint status and optionally records resolution details and audit notes.
 * @param {string} id - Complaint identifier
 * @param {Object} payload - { status, resolutionDetails?, notes? }
 * @returns {Promise<Object>} Updated and adapted complaint
 */
export const updateComplaintStatus = async (id, payload) => {
  if (!id) {
    throw new Error('Complaint identifier is required')
  }
  if (!payload || !payload.status) {
    throw new Error('New complaint status is required')
  }

  const body = {
    status: denormalizeComplaintStatus(payload.status),
    resolutionDetails: payload.resolutionDetails,
    notes: payload.notes,
  }

  const response = await apiClient.patch(`/admin/complaints/${id}/status`, body)
  const rawData = response?.data || response
  return adaptComplaint(rawData)
}

/**
 * Appends an internal investigation note to a complaint.
 * @param {string} id - Complaint identifier
 * @param {Object} payload - { note: string }
 * @returns {Promise<Object>} Updated and adapted complaint
 */
export const addComplaintNote = async (id, payload) => {
  if (!id) {
    throw new Error('Complaint identifier is required')
  }
  if (!payload || !payload.note || !payload.note.trim()) {
    throw new Error('Investigation note text is required')
  }

  const response = await apiClient.post(`/admin/complaints/${id}/notes`, {
    note: payload.note.trim(),
  })
  const rawData = response?.data || response
  return adaptComplaint(rawData)
}

/**
 * Retrieves platform metrics and analytics charts from MongoDB aggregations.
 * @returns {Promise<Object>} Aggregated metrics and time-series
 */
export const getAdminMetrics = async () => {
  const response = await apiClient.get('/admin/metrics')
  return response?.data || response
}

/**
 * Retrieves caregiver ratings directory with star distribution statistics.
 * @param {Object} [query={}]
 * @returns {Promise<{ rows: Array, stats: Object, distribution: Array }>}
 */
export const getAdminRatings = async (query = {}) => {
  const response = await apiClient.get('/admin/ratings', { params: query })
  return response?.data || response
}

/**
 * Retrieves written review dossier for an individual caregiver.
 * @param {string} caregiverId
 * @returns {Promise<Array>}
 */
export const getAdminCaregiverReviews = async (caregiverId) => {
  if (!caregiverId) {
    throw new Error('A caregiver identifier is required')
  }
  const response = await apiClient.get(`/admin/ratings/${caregiverId}/reviews`)
  return response?.data?.reviews || response?.reviews || (Array.isArray(response?.data) ? response.data : [])
}

/**
 * Generates an operational report with real CSV content.
 * @param {Object} payload - { type, period, format }
 * @returns {Promise<Object>} Generated report metadata and CSV content
 */
export const generateAdminReport = async (payload) => {
  const response = await apiClient.post('/admin/reports/generate', payload)
  return response?.data || response
}

/**
 * Retrieves paginated transactions ledger with real financial aggregates.
 * @param {Object} [query={}] - Optional filters (page, limit, status, range, search)
 * @returns {Promise<{ transactions: Array, pagination: Object, stats: Object }>}
 */
export const getAdminPayments = async (query = {}) => {
  const response = await apiClient.get('/admin/payments', { params: query })
  const rawList = Array.isArray(response?.data) ? response.data : []
  const transactions = rawList.map(adaptTransaction)

  const pagination = response?.pagination || {
    total: transactions.length,
    page: 1,
    limit: transactions.length || 10,
    totalPages: 1,
  }

  const stats = response?.stats || {
    gross: transactions.reduce((acc, t) => acc + (t.status !== 'Refunded' ? t.amount : 0), 0),
    commission: transactions.reduce((acc, t) => acc + (t.commission || 0), 0),
    refunded: transactions.reduce((acc, t) => acc + (t.status === 'Refunded' ? t.amount : 0), 0),
    escrow: transactions.reduce((acc, t) => acc + (t.status === 'Escrow Held' ? t.amount : 0), 0),
  }

  return { transactions, pagination, stats }
}

/**
 * Retrieves a single transaction audit record by ID or transaction number.
 * @param {string} id
 * @returns {Promise<Object>}
 */
export const getAdminPaymentById = async (id) => {
  if (!id) {
    throw new Error('A transaction identifier is required')
  }
  const response = await apiClient.get(`/admin/payments/${id}`)
  const rawData = response?.data || response
  return adaptTransaction(rawData)
}

/**
 * Retrieves paginated platform commissions with accrued and settled aggregates.
 * @param {Object} [query={}]
 * @returns {Promise<{ commissions: Array, pagination: Object, stats: Object }>}
 */
export const getAdminCommissions = async (query = {}) => {
  const response = await apiClient.get('/admin/commissions', { params: query })
  const rawList = Array.isArray(response?.data) ? response.data : []
  const commissions = rawList.map(adaptCommission)

  const pagination = response?.pagination || {
    total: commissions.length,
    page: 1,
    limit: commissions.length || 10,
    totalPages: 1,
  }

  const stats = response?.stats || {
    total: commissions.reduce((acc, c) => acc + (c.amount || 0), 0),
    accrued: commissions.filter((c) => c.status === 'Accrued').reduce((acc, c) => acc + (c.amount || 0), 0),
    settled: commissions.filter((c) => c.status === 'Settled').reduce((acc, c) => acc + (c.amount || 0), 0),
    accruedCount: commissions.filter((c) => c.status === 'Accrued').length,
    effectiveRate: 12,
  }

  return { commissions, pagination, stats }
}

/**
 * Reconciles accrued commissions for completed care engagements.
 * @returns {Promise<Object>}
 */
export const reconcileCommissions = async () => {
  const response = await apiClient.post('/admin/commissions/reconcile')
  return response?.data || response
}

/**
 * Retrieves paginated caregiver payouts with status summary statistics.
 * @param {Object} [query={}]
 * @returns {Promise<{ payouts: Array, pagination: Object, stats: Object }>}
 */
export const getAdminPayouts = async (query = {}) => {
  const response = await apiClient.get('/admin/payouts', { params: query })
  const rawList = Array.isArray(response?.data) ? response.data : []
  const payouts = rawList.map(adaptPayout)

  const pagination = response?.pagination || {
    total: payouts.length,
    page: 1,
    limit: payouts.length || 10,
    totalPages: 1,
  }

  const stats = response?.stats || {
    total: payouts.reduce((acc, p) => acc + (p.net || 0), 0),
    pending: payouts.filter((p) => p.status === 'Pending').length,
    processing: payouts.filter((p) => p.status === 'Processing').length,
    settled: payouts.filter((p) => p.status === 'Settled').length,
  }

  return { payouts, pagination, stats }
}

/**
 * Updates payout status (e.g. pending -> processing -> settled) with admin audit.
 * @param {string} id - Payout ObjectId or PO- reference
 * @param {Object} payload - { status, notes? }
 * @returns {Promise<Object>}
 */
export const updateAdminPayoutStatus = async (id, payload) => {
  if (!id) {
    throw new Error('A payout identifier is required')
  }
  if (!payload || !payload.status) {
    throw new Error('Target payout status is required')
  }

  const response = await apiClient.patch(`/admin/payouts/${id}/status`, payload)
  const rawData = response?.data || response
  return adaptPayout(rawData)
}

/**
 * Retrieves paginated list of blacklist records with live summary statistics.
 * @param {Object} [query={}] - Optional filters (search, type, page, limit)
 * @returns {Promise<{ entries: Array, stats: Object, pagination: Object }>}
 */
export const getAdminBlacklist = async (query = {}) => {
  const response = await apiClient.get('/admin/blacklist', { params: query })
  return {
    entries: response?.data || [],
    stats: response?.stats || { total: 0, caregivers: 0, customers: 0, permanent: 0 },
    pagination: response?.pagination || { total: 0, page: 1, limit: 50, totalPages: 1 },
  }
}

/**
 * Adds an account to the platform blacklist in MongoDB and blocks the user.
 * @param {Object} payload - { name, type, reason, reviewAfter, userId, phone, email }
 * @returns {Promise<Object>}
 */
export const addToBlacklist = async (payload) => {
  const response = await apiClient.post('/admin/blacklist', payload)
  return response?.data || response
}

/**
 * Removes an account from the blacklist and restores account access in MongoDB.
 * @param {string} id - Entry ID (BL-XXX) or MongoDB _id
 * @param {Object} [payload={}] - { reason }
 * @returns {Promise<Object>}
 */
export const removeFromBlacklist = async (id, payload = {}) => {
  const response = await apiClient.delete(`/admin/blacklist/${id}`, { data: payload })
  return response?.data || response
}

/**
 * Searches registered candidates for quick blacklisting.
 * @param {string} [search='']
 * @returns {Promise<Array>}
 */
export const getBlacklistCandidates = async (search = '') => {
  const response = await apiClient.get('/admin/blacklist/candidates', { params: { search } })
  return response?.data || []
}

export const adminService = {
  getVerifications,
  getVerificationById,
  updateDocumentStatus,
  updateCaregiverVerificationStatus,
  getCustomers,
  getCaregivers,
  updateUserStatus,
  getFlaggedMessages,
  getComplaints,
  getComplaintById: getAdminComplaintById,
  getAdminComplaintById,
  updateComplaintStatus,
  addComplaintNote,
  getAdminMetrics,
  getAdminRatings,
  getAdminCaregiverReviews,
  generateAdminReport,
  getAdminPayments,
  getAdminPaymentById,
  getAdminCommissions,
  reconcileCommissions,
  getAdminPayouts,
  updateAdminPayoutStatus,
  getAdminBlacklist,
  addToBlacklist,
  removeFromBlacklist,
  getBlacklistCandidates,
}

export default adminService


