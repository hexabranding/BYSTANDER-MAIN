/**
 * SOS Emergency Domain Service
 *
 * Integrates high-priority emergency incident reporting, incident tracking,
 * and escalation timeline auditing against the Express/MongoDB backend.
 *
 * All operations run strictly in api-only mode (no static fallbacks).
 * Never fabricates GPS coordinates or claims external emergency services were dispatched.
 */

import apiClient from './apiClient.js'
import { adaptSosIncident, isMongoObjectId } from './adapters.js'

/**
 * Raises a high-priority SOS emergency incident for an active care booking.
 * @param {Object} payload
 * @param {string} payload.bookingId - MongoDB ObjectId of the associated booking
 * @param {string} payload.summary - Description of the emergency (5-1000 chars)
 * @param {string} [payload.priority='Critical'] - 'Critical' | 'High' | 'Medium' | 'Low'
 * @param {Object} [payload.location] - Optional live GPS location. NEVER pass fabricated coordinates.
 * @returns {Promise<Object>} Created and adapted SOS incident
 */
export const raiseSos = async (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('SOS payload is required')
  }

  const { bookingId, summary, priority = 'Critical', location } = payload

  if (!bookingId || !isMongoObjectId(bookingId)) {
    throw new Error('A valid booking identifier (ObjectId) is required to raise an SOS')
  }

  if (!summary || typeof summary !== 'string' || summary.trim().length < 5) {
    throw new Error('Emergency summary must be at least 5 characters')
  }

  const trimmedSummary = summary.trim()
  if (trimmedSummary.length > 1000) {
    throw new Error('Emergency summary cannot exceed 1000 characters')
  }

  // Location validation: ensure coordinates are genuine numbers if provided, never fabricated
  let sanitizedLocation = {
    isAvailable: false,
    label: 'Location not shared',
    latitude: null,
    longitude: null,
    accuracy: null,
  }

  if (location && typeof location === 'object') {
    const lat = location.latitude !== undefined ? Number(location.latitude) : (location.lat !== undefined ? Number(location.lat) : null)
    const lng = location.longitude !== undefined ? Number(location.longitude) : (location.lng !== undefined ? Number(location.lng) : null)

    if (lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng)) {
      sanitizedLocation = {
        isAvailable: true,
        label: typeof location.label === 'string' ? location.label.slice(0, 200) : 'Live location captured',
        latitude: lat,
        longitude: lng,
        accuracy: location.accuracy ? Number(location.accuracy) : null,
      }
    } else if (location.label && typeof location.label === 'string') {
      sanitizedLocation = {
        isAvailable: false,
        label: location.label.slice(0, 200),
        latitude: null,
        longitude: null,
        accuracy: null,
      }
    }
  }

  const response = await apiClient.post('/sos', {
    bookingId: bookingId.trim(),
    summary: trimmedSummary,
    priority,
    location: sanitizedLocation,
  })

  const rawIncident = response?.data || response
  return adaptSosIncident(rawIncident)
}

/**
 * Retrieves a list of SOS incidents scoped to the authenticated caller's authorized bookings.
 * @param {Object} [query={}] - Optional query filters (status, priority, page, limit)
 * @returns {Promise<{ incidents: Array, pagination: Object }>}
 */
export const getSosIncidents = async (query = {}) => {
  const response = await apiClient.get('/sos', { params: query })
  const rawList = Array.isArray(response?.data) ? response.data : []
  const incidents = rawList.map(adaptSosIncident)

  const pagination = response?.pagination || {
    total: incidents.length,
    page: 1,
    limit: incidents.length || 20,
    pages: 1,
  }

  return { incidents, pagination }
}

/**
 * Retrieves full details and operational audit timeline of a specific SOS incident.
 * @param {string} id - Incident MongoDB ObjectId
 * @returns {Promise<Object>} Adapted SOS incident
 */
export const getSosById = async (id) => {
  if (!id || !isMongoObjectId(id)) {
    throw new Error('A valid SOS incident identifier (ObjectId) is required')
  }

  const response = await apiClient.get(`/sos/${id}`)
  const rawIncident = response?.data || response
  return adaptSosIncident(rawIncident)
}

/**
 * Appends an operational note or status event to the incident timeline.
 * @param {string} id - Incident MongoDB ObjectId
 * @param {Object} noteData - { action: string, notes?: string }
 * @returns {Promise<Object>} Updated and adapted SOS incident
 */
export const addTimelineNote = async (id, noteData) => {
  if (!id || !isMongoObjectId(id)) {
    throw new Error('A valid SOS incident identifier (ObjectId) is required')
  }

  if (!noteData || !noteData.action) {
    throw new Error('Timeline action description is required')
  }

  const response = await apiClient.post(`/sos/${id}/timeline`, noteData)
  const rawIncident = response?.data || response
  return adaptSosIncident(rawIncident)
}

/**
 * Assigns an SOS incident to an administrative operations desk handler.
 * @param {string} id - Incident MongoDB ObjectId
 * @param {string} assignedTo - Admin User ObjectId
 * @returns {Promise<Object>} Updated and adapted SOS incident
 */
export const assignSos = async (id, assignedTo) => {
  if (!id || !isMongoObjectId(id)) {
    throw new Error('A valid SOS incident identifier (ObjectId) is required')
  }

  const response = await apiClient.patch(`/sos/${id}/assign`, { assignedTo })
  const rawIncident = response?.data || response
  return adaptSosIncident(rawIncident)
}

/**
 * Resolves an SOS incident or closes it as a false alarm.
 * @param {string} id - Incident MongoDB ObjectId
 * @param {Object} resolveData - { resolution: string, resolutionNotes?: string, isFalseAlarm?: boolean }
 * @returns {Promise<Object>} Updated and adapted SOS incident
 */
export const resolveSos = async (id, resolveData) => {
  if (!id || !isMongoObjectId(id)) {
    throw new Error('A valid SOS incident identifier (ObjectId) is required')
  }

  const response = await apiClient.patch(`/sos/${id}/resolve`, resolveData)
  const rawIncident = response?.data || response
  return adaptSosIncident(rawIncident)
}

export const sosService = {
  raiseSos,
  getSosIncidents,
  getSosById,
  addTimelineNote,
  assignSos,
  resolveSos,
}

export default sosService
