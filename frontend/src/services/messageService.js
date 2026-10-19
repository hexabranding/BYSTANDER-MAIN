/**
 * Messaging Domain Service
 *
 * Integrates booking-scoped conversations, message history, read status,
 * and unread count tracking against the Express/MongoDB backend.
 *
 * All mutations and fetches run in api-only mode (strictly no mock fallbacks).
 */

import apiClient from './apiClient.js'
import { adaptMessage, isMongoObjectId } from './adapters.js'

/**
 * Retrieves paginated message history for a booking engagement.
 * @param {string} bookingId - MongoDB ObjectId of the booking
 * @param {Object} [query={}] - Optional pagination (page, limit)
 * @param {string} [currentUserId] - Optional user ID for 'from: me' identification
 * @returns {Promise<{ messages: Array, pagination: Object }>}
 */
export const getMessages = async (bookingId, query = {}, currentUserId = null) => {
  if (!bookingId || !isMongoObjectId(bookingId)) {
    throw new Error('A valid booking identifier (ObjectId) is required to view messages')
  }

  const response = await apiClient.get(`/messages/booking/${bookingId}`, { params: query })
  const rawList = Array.isArray(response?.data) ? response.data : []
  const messages = rawList.map((m) => adaptMessage(m, currentUserId))

  const pagination = response?.pagination || {
    total: messages.length,
    page: 1,
    limit: messages.length || 20,
    pages: 1,
  }

  return { messages, pagination }
}

/**
 * Sends a message within an authorized care booking.
 * @param {string} bookingId - MongoDB ObjectId of the booking
 * @param {string} content - Message text (1-2000 characters)
 * @param {string} [currentUserId] - Optional user ID for immediate 'me' identification
 * @returns {Promise<Object>} Created and adapted message
 */
export const sendMessage = async (bookingId, content, currentUserId = null) => {
  if (!bookingId || !isMongoObjectId(bookingId)) {
    throw new Error('A valid booking identifier (ObjectId) is required to send a message')
  }

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('Message content cannot be empty')
  }

  const trimmed = content.trim()
  if (trimmed.length > 2000) {
    throw new Error('Message content cannot exceed 2000 characters')
  }

  const response = await apiClient.post('/messages', {
    bookingId: bookingId.trim(),
    content: trimmed,
  })

  const rawMessage = response?.data || response
  return adaptMessage(rawMessage, currentUserId)
}

/**
 * Marks unread incoming messages in a booking as read for the authenticated recipient.
 * @param {string} bookingId - MongoDB ObjectId of the booking
 * @returns {Promise<{ modifiedCount: number }>}
 */
export const markMessagesAsRead = async (bookingId) => {
  if (!bookingId || !isMongoObjectId(bookingId)) {
    throw new Error('A valid booking identifier (ObjectId) is required to mark messages as read')
  }

  const response = await apiClient.patch(`/messages/booking/${bookingId}/read`)
  return response?.data || { modifiedCount: 0 }
}

/**
 * Retrieves unread message counts across all bookings for the authenticated user.
 * @returns {Promise<{ totalUnread: number, unreadByBooking: Array }>}
 */
export const getUnreadCounts = async () => {
  const response = await apiClient.get('/messages/unread')
  const data = response?.data || response
  return {
    totalUnread: typeof data?.totalUnread === 'number' ? data.totalUnread : 0,
    unreadByBooking: Array.isArray(data?.unreadByBooking) ? data.unreadByBooking : [],
  }
}

export const messageService = {
  getMessages,
  sendMessage,
  markMessagesAsRead,
  getUnreadCounts,
}

export default messageService
