/**
 * Profile Domain Service
 *
 * Provides customer and caregiver profile retrieval and update operations
 * against the Express/MongoDB backend.
 *
 * Enforces strict allowlists on mutation payloads to prevent server validation errors
 * or unauthorized privilege escalation.
 */

import apiClient from './apiClient.js'
import { adaptCustomerProfile, adaptCaregiver } from './adapters.js'

export const PERMITTED_CUSTOMER_PROFILE_FIELDS = [
  'fullName',
  'emergencyContact',
  'defaultAddress',
  'careNotes',
  'patients',
]

export const PERMITTED_CAREGIVER_PROFILE_FIELDS = [
  'bio',
  'experienceYears',
  'languages',
  'gender',
  'street',
  'area',
  'city',
  'district',
  'state',
  'pincode',
  'address',
  'maxDistanceKm',
  'hourlyRate',
  'servicesOffered',
  'services',
  'careSettings',
  'availabilityStatus',
  'avatar',
]

/**
 * Retrieves the authenticated customer's profile.
 * @returns {Promise<Object>} Adapted customer profile
 */
export const getCustomerProfile = async () => {
  const response = await apiClient.get('/customer/profile')
  const rawProfile = response?.data || response
  return adaptCustomerProfile(rawProfile)
}

/**
 * Updates permitted fields on the authenticated customer's profile.
 * @param {Object} updates
 * @returns {Promise<Object>} Updated adapted customer profile
 */
export const updateCustomerProfile = async (updates) => {
  if (!updates || typeof updates !== 'object') {
    throw new Error('Update payload must be an object')
  }

  // Filter to strictly permitted fields
  const sanitized = {}
  for (const field of PERMITTED_CUSTOMER_PROFILE_FIELDS) {
    if (updates[field] !== undefined) {
      sanitized[field] = updates[field]
    }
  }

  const response = await apiClient.patch('/customer/profile', sanitized)
  const rawProfile = response?.data || response
  return adaptCustomerProfile(rawProfile)
}

/**
 * Retrieves the authenticated caregiver's private profile.
 * @returns {Promise<Object>} Adapted caregiver profile
 */
export const getCaregiverProfile = async () => {
  const response = await apiClient.get('/caregiver/profile')
  const rawProfile = response?.data || response
  return adaptCaregiver(rawProfile)
}

/**
 * Updates permitted professional fields on the authenticated caregiver's profile.
 * @param {Object} updates
 * @returns {Promise<Object>} Updated adapted caregiver profile
 */
export const updateCaregiverProfile = async (updates) => {
  if (!updates || typeof updates !== 'object') {
    throw new Error('Update payload must be an object')
  }

  // Filter to strictly permitted fields
  const sanitized = {}
  for (const field of PERMITTED_CAREGIVER_PROFILE_FIELDS) {
    if (updates[field] !== undefined) {
      sanitized[field] = updates[field]
    }
  }

  const response = await apiClient.patch('/caregiver/profile', sanitized)
  const rawProfile = response?.data || response
  return adaptCaregiver(rawProfile)
}

export const profileService = {
  PERMITTED_CUSTOMER_PROFILE_FIELDS,
  PERMITTED_CAREGIVER_PROFILE_FIELDS,
  getCustomerProfile,
  updateCustomerProfile,
  getCaregiverProfile,
  updateCaregiverProfile,
}

export default profileService
