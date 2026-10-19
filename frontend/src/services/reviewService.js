/**
 * Customer & Public Review Domain Service
 *
 * Connects frontend review submission, public caregiver reviews,
 * and caregiver replies to the Express/MongoDB backend.
 */

import apiClient from './apiClient.js'

/**
 * Submits a star rating and feedback review for a completed booking engagement.
 * @param {Object} payload - { bookingId, rating, criteria, comment }
 * @returns {Promise<Object>} Created review document
 */
export const submitReview = async (payload) => {
  if (!payload || !payload.bookingId) {
    throw new Error('A booking identifier is required to submit a review')
  }

  const response = await apiClient.post('/reviews', payload)
  return response?.data || response
}

/**
 * Retrieves public reviews for a specific caregiver.
 * @param {string} caregiverId - Caregiver profile or user ObjectId
 * @param {Object} [query={}] - Optional pagination { page, limit }
 * @returns {Promise<{ reviews: Array, pagination: Object }>}
 */
export const getCaregiverReviews = async (caregiverId, query = {}) => {
  if (!caregiverId) {
    throw new Error('A caregiver identifier is required')
  }

  const response = await apiClient.get(`/reviews/caregiver/${caregiverId}`, { params: query })
  const data = response?.data || response
  return {
    reviews: data?.reviews || [],
    pagination: data?.pagination || { total: 0, page: 1, limit: 10, pages: 1 },
  }
}

/**
 * Caregiver replies to a review on their profile.
 * @param {string} reviewId - Review ObjectId
 * @param {string} reply - Caregiver response text
 * @returns {Promise<Object>} Updated review
 */
export const replyToReview = async (reviewId, reply) => {
  if (!reviewId) {
    throw new Error('A review identifier is required')
  }
  if (!reply || !reply.trim()) {
    throw new Error('Reply text is required')
  }

  const response = await apiClient.post(`/reviews/${reviewId}/reply`, { reply: reply.trim() })
  return response?.data || response
}

export const reviewService = {
  submitReview,
  getCaregiverReviews,
  replyToReview,
}

export default reviewService
