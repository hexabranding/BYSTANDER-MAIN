/**
 * Notifications Domain Service
 *
 * Integrates authenticated in-app notifications, unread counts,
 * and read-status management against the Express/MongoDB backend.
 *
 * All operations run strictly in api-only mode (no static fallbacks).
 */

import apiClient from './apiClient.js'
import { adaptNotification, isMongoObjectId } from './adapters.js'

/**
 * Retrieves paginated notifications for the authenticated user.
 * @param {Object} [query={}] - { page, limit, unreadOnly }
 * @returns {Promise<{ notifications: Array, pagination: Object }>}
 */
export const getNotifications = async (query = {}) => {
  const response = await apiClient.get('/notifications', { params: query })
  const rawList = Array.isArray(response?.data) ? response.data : []
  const notifications = rawList.map(adaptNotification)

  const pagination = response?.pagination || {
    total: notifications.length,
    page: 1,
    limit: notifications.length || 20,
    pages: 1,
  }

  return { notifications, pagination }
}

/**
 * Retrieves the count of unread notifications for the authenticated user.
 * @returns {Promise<{ count: number }>}
 */
export const getUnreadCount = async () => {
  const response = await apiClient.get('/notifications/unread')
  const count =
    response?.data?.unreadCount ??
    response?.data?.count ??
    response?.unreadCount ??
    response?.count ??
    0
  return { count: typeof count === 'number' ? count : 0 }
}

/**
 * Marks a single notification as read.
 * @param {string} id - Notification MongoDB ObjectId
 * @returns {Promise<Object>} Adapted updated notification
 */
export const markOneAsRead = async (id) => {
  if (!id || !isMongoObjectId(id)) {
    throw new Error('A valid notification identifier (ObjectId) is required')
  }

  const response = await apiClient.patch(`/notifications/${id}/read`)
  const raw = response?.data || response
  return adaptNotification(raw)
}

/**
 * Marks all unread notifications as read for the authenticated user.
 * @returns {Promise<{ modifiedCount: number }>}
 */
export const markAllAsRead = async () => {
  const response = await apiClient.patch('/notifications/read-all')
  return response?.data || { modifiedCount: 0 }
}

/**
 * Permanently deletes all notifications for the authenticated user.
 * @returns {Promise<{ deletedCount: number }>}
 */
export const clearAllNotifications = async () => {
  const response = await apiClient.delete('/notifications')
  return response?.data || { deletedCount: 0 }
}

/**
 * Permanently deletes a single notification.
 * @param {string} id - Notification MongoDB ObjectId
 * @returns {Promise<Object>}
 */
export const deleteOneNotification = async (id) => {
  if (!id || !isMongoObjectId(id)) {
    throw new Error('A valid notification identifier (ObjectId) is required')
  }

  const response = await apiClient.delete(`/notifications/${id}`)
  return response?.data || response
}

export const notificationService = {
  getNotifications,
  getUnreadCount,
  markOneAsRead,
  markAllAsRead,
  clearAllNotifications,
  deleteOneNotification,
}

export default notificationService
