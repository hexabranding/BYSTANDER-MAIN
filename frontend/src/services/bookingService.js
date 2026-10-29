/**
 * Booking Domain Service
 *
 * Provides transactional booking lifecycle operations, role-scoped lists,
 * and shift verification OTP endpoints against the Express/MongoDB backend.
 *
 * All operations run strictly in api-only mode (no static fallbacks).
 */

import apiClient from './apiClient.js'
import { adaptBooking } from './adapters.js'

/**
 * Creates a new customer booking request.
 * @param {Object} payload - Booking request payload
 * @returns {Promise<Object>} Created and adapted booking
 */
export const createBooking = async (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Booking payload is required')
  }

  const response = await apiClient.post('/bookings', payload)
  const rawBooking = response?.data || response
  return adaptBooking(rawBooking)
}

/**
 * Retrieves role-scoped booking list with optional status filtering and pagination.
 * @param {Object} [query={}] - Query params (status, page, limit, sort)
 * @returns {Promise<{ bookings: Array, pagination: Object }>}
 */
export const getBookings = async (query = {}) => {
  const response = await apiClient.get('/bookings', { params: query })
  const rawList = Array.isArray(response?.data) ? response.data : []
  const bookings = rawList.map(adaptBooking)
  const pagination = response?.pagination || {
    total: bookings.length,
    page: 1,
    limit: bookings.length || 10,
    totalPages: 1,
  }

  return { bookings, pagination }
}

/**
 * Retrieves a single booking record by ID.
 * @param {string} id - Booking ObjectId
 * @returns {Promise<Object>} Adapted booking
 */
export const getBookingById = async (id) => {
  if (!id) throw new Error('Booking ID is required')
  const response = await apiClient.get(`/bookings/${id}`)
  const rawBooking = response?.data || response
  return adaptBooking(rawBooking)
}

/**
 * Caregiver accepts a pending booking request.
 * @param {string} id - Booking ObjectId
 * @returns {Promise<Object>} Updated and adapted booking
 */
export const acceptBooking = async (id) => {
  if (!id) throw new Error('Booking ID is required')
  const response = await apiClient.patch(`/bookings/${id}/accept`)
  const rawBooking = response?.data || response
  return adaptBooking(rawBooking)
}

/**
 * Customer chooses a caregiver from the applicants list who accepted the broadcast.
 * @param {string} id - Booking ObjectId
 * @param {string} caregiverId - Chosen CaregiverProfile ObjectId
 * @returns {Promise<Object>} Updated and adapted booking
 */
export const selectCaregiver = async (id, caregiverId) => {
  if (!id) throw new Error('Booking ID is required')
  if (!caregiverId) throw new Error('Caregiver ID is required')
  const response = await apiClient.patch(`/bookings/${id}/select-caregiver`, { caregiverId })
  const rawBooking = response?.data || response
  return adaptBooking(rawBooking)
}

/**
 * Caregiver or admin declines a pending booking request.
 * @param {string} id - Booking ObjectId
 * @param {string} [reason=''] - Rejection reason
 * @returns {Promise<Object>} Updated and adapted booking
 */
export const rejectBooking = async (id, reason = '') => {
  if (!id) throw new Error('Booking ID is required')
  const payload = reason ? { reason } : {}
  const response = await apiClient.patch(`/bookings/${id}/reject`, payload)
  const rawBooking = response?.data || response
  return adaptBooking(rawBooking)
}

/**
 * Participant or admin cancels a booking engagement.
 * @param {string} id - Booking ObjectId
 * @param {string} [reason=''] - Cancellation reason
 * @returns {Promise<Object>} Updated and adapted booking
 */
export const cancelBooking = async (id, reason = '') => {
  if (!id) throw new Error('Booking ID is required')
  const payload = reason ? { reason } : {}
  const response = await apiClient.patch(`/bookings/${id}/cancel`, payload)
  const rawBooking = response?.data || response
  return adaptBooking(rawBooking)
}

/**
 * Customer requests a 6-digit Check-In OTP for a confirmed booking.
 * Note: OTP is in plaintext in response and should not be persisted in browser storage or logged.
 * @param {string} id - Booking ObjectId
 * @returns {Promise<{ otp: string, expiresAt: string, maxAttempts: number, message: string }>}
 */
export const requestCheckInOtp = async (id) => {
  if (!id) throw new Error('Booking ID is required')
  const response = await apiClient.post(`/bookings/${id}/checkin/otp`)
  return {
    otp: response?.otp || '',
    expiresAt: response?.expiresAt || null,
    maxAttempts: response?.maxAttempts ?? 5,
    message: response?.message || 'Check-in OTP generated successfully',
  }
}

/**
 * Caregiver submits Check-In OTP to transition booking to 'in_progress'.
 * @param {string} id - Booking ObjectId
 * @param {Object} checkInData - { otp, selfieUrl, location, notes }
 * @returns {Promise<Object>} Updated and adapted booking
 */
export const verifyCheckIn = async (id, checkInData) => {
  if (!id) throw new Error('Booking ID is required')
  if (!checkInData || !checkInData.otp) {
    throw new Error('A 6-digit OTP is required for check-in verification')
  }

  const response = await apiClient.post(`/bookings/${id}/checkin/verify`, checkInData)
  const rawBooking = response?.data || response
  return adaptBooking(rawBooking)
}

/**
 * Customer requests a 6-digit Check-Out OTP for an in_progress booking.
 * @param {string} id - Booking ObjectId
 * @returns {Promise<{ otp: string, expiresAt: string, maxAttempts: number, message: string }>}
 */
export const requestCheckOutOtp = async (id) => {
  if (!id) throw new Error('Booking ID is required')
  const response = await apiClient.post(`/bookings/${id}/checkout/otp`)
  return {
    otp: response?.otp || '',
    expiresAt: response?.expiresAt || null,
    maxAttempts: response?.maxAttempts ?? 5,
    message: response?.message || 'Check-out OTP generated successfully',
  }
}

/**
 * Caregiver submits Check-Out OTP to transition booking to 'completed'.
 * @param {string} id - Booking ObjectId
 * @param {Object} checkOutData - { otp, selfieUrl, location, notes }
 * @returns {Promise<Object>} Updated and adapted booking
 */
export const verifyCheckOut = async (id, checkOutData) => {
  if (!id) throw new Error('Booking ID is required')
  if (!checkOutData || !checkOutData.otp) {
    throw new Error('A 6-digit OTP is required for check-out verification')
  }

  const response = await apiClient.post(`/bookings/${id}/checkout/verify`, checkOutData)
  const rawBooking = response?.data || response
  return adaptBooking(rawBooking)
}

export const bookingService = {
  createBooking,
  getBookings,
  getBookingById,
  acceptBooking,
  selectCaregiver,
  rejectBooking,
  cancelBooking,
  requestCheckInOtp,
  verifyCheckIn,
  requestCheckOutOtp,
  verifyCheckOut,
}

export default bookingService

