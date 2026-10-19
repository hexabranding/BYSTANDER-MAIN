/**
 * Caregiver Availability Domain Service
 *
 * Provides weekly schedule configuration and date exception management
 * against the Express/MongoDB backend.
 *
 * Enforces contract validation before dispatch to ensure all 7 weekdays are properly
 * represented with valid time slots.
 */

import apiClient from './apiClient.js'
import {
  adaptWeeklyScheduleToWeekAvailability,
  adaptWeekAvailabilityToWeeklySchedule,
} from './adapters.js'

const REQUIRED_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * Validates that weeklySchedule contains all 7 weekdays with correct shape.
 * @param {Array} weeklySchedule
 */
export const validateWeeklyScheduleContract = (weeklySchedule) => {
  if (!Array.isArray(weeklySchedule)) {
    throw new Error('Weekly schedule must be an array of 7 weekday availability objects')
  }

  const daysFound = new Set()
  for (const item of weeklySchedule) {
    if (!item || !REQUIRED_WEEKDAYS.includes(item.day)) {
      throw new Error(`Weekday '${item?.day}' is invalid. Must be one of: ${REQUIRED_WEEKDAYS.join(', ')}`)
    }
    if (daysFound.has(item.day)) {
      throw new Error(`Duplicate weekday entry for '${item.day}'`)
    }
    daysFound.add(item.day)

    if (typeof item.isAvailable !== 'boolean') {
      throw new Error(`'isAvailable' for ${item.day} must be a boolean`)
    }

    if (item.isAvailable) {
      if (!Array.isArray(item.slots) || item.slots.length === 0) {
        throw new Error(`Weekday '${item.day}' marked as available must include at least one valid time slot`)
      }
    }
  }

  const missingDays = REQUIRED_WEEKDAYS.filter((d) => !daysFound.has(d))
  if (missingDays.length > 0) {
    throw new Error(`Weekly schedule is incomplete. Missing weekdays: ${missingDays.join(', ')}`)
  }
}

/**
 * Retrieves the authenticated caregiver's availability configuration.
 * @returns {Promise<{ weeklySchedule: Array, weekAvailability: Array, dateExceptions: Array, timezone: string, availabilityStatus: string }>}
 */
export const getCaregiverAvailability = async () => {
  const response = await apiClient.get('/caregiver/availability')
  const data = response?.data || response

  const weeklySchedule = Array.isArray(data?.weeklySchedule) ? data.weeklySchedule : []
  const weekAvailability = adaptWeeklyScheduleToWeekAvailability(weeklySchedule)

  return {
    weeklySchedule,
    weekAvailability,
    dateExceptions: Array.isArray(data?.dateExceptions) ? data.dateExceptions : [],
    timezone: data?.timezone || 'Asia/Kolkata',
    availabilityStatus: data?.availabilityStatus || 'Available Now',
  }
}

/**
 * Updates recurring weekly schedule and date exceptions on the authenticated caregiver's profile.
 * @param {Object} payload - { weeklySchedule, dateExceptions, timezone, availabilityStatus }
 * @returns {Promise<Object>} Updated availability configuration
 */
export const updateCaregiverAvailability = async (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Availability payload must be an object')
  }

  const body = {}

  if (payload.timezone) {
    body.timezone = String(payload.timezone).trim()
  }

  if (payload.availabilityStatus) {
    body.availabilityStatus = String(payload.availabilityStatus).trim()
  }

  if (payload.dateExceptions && Array.isArray(payload.dateExceptions)) {
    body.dateExceptions = payload.dateExceptions
  }

  if (payload.weeklySchedule) {
    validateWeeklyScheduleContract(payload.weeklySchedule)
    body.weeklySchedule = payload.weeklySchedule
  } else if (payload.weekAvailability) {
    const weeklySchedule = adaptWeekAvailabilityToWeeklySchedule(payload.weekAvailability)
    validateWeeklyScheduleContract(weeklySchedule)
    body.weeklySchedule = weeklySchedule
  }

  const response = await apiClient.put('/caregiver/availability', body)
  const data = response?.data || response

  const updatedWeekly = Array.isArray(data?.weeklySchedule) ? data.weeklySchedule : body.weeklySchedule || []
  return {
    weeklySchedule: updatedWeekly,
    weekAvailability: adaptWeeklyScheduleToWeekAvailability(updatedWeekly),
    dateExceptions: Array.isArray(data?.dateExceptions) ? data.dateExceptions : [],
    timezone: data?.timezone || body.timezone || 'Asia/Kolkata',
    availabilityStatus: data?.availabilityStatus || body.availabilityStatus || 'Available Now',
  }
}

export const availabilityService = {
  validateWeeklyScheduleContract,
  getCaregiverAvailability,
  updateCaregiverAvailability,
}

export default availabilityService
