/**
 * Public Caregiver Directory API Service
 *
 * Connects caregiver discovery pages to Express /api/caregivers endpoints
 * with fallback support to local static seed data under network/server failure.
 */

import apiClient, { ApiError } from './apiClient.js'
import { executeDataOperation } from './dataModes.js'
import { adaptCaregiver, isMongoObjectId } from './adapters.js'
import { CAREGIVERS, getCaregiverById } from '../data/caregivers.js'

/**
 * Filter static caregivers catalog in memory (used for fallback or static mode).
 */
const filterStaticCaregivers = (queryOptions = {}) => {
  const {
    search,
    city,
    qualification,
    service,
    minRating,
    maxRate,
    availability,
    maxDistance,
    sort,
    page = 1,
    limit = 12,
  } = queryOptions

  const q = typeof search === 'string' ? search.trim().toLowerCase() : ''
  const cityFilter = typeof city === 'string' ? city.trim().toLowerCase() : ''
  const qualFilter =
    typeof qualification === 'string' && qualification !== 'Any'
      ? qualification.trim().toLowerCase()
      : ''
  const availFilter =
    typeof availability === 'string' && availability !== 'Any'
      ? availability.trim().toLowerCase()
      : ''

  let list = CAREGIVERS.filter((cg) => {
    if (q) {
      const haystack = `${cg.name} ${cg.qualification} ${cg.area} ${cg.city} ${(cg.services || []).join(' ')}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }

    if (cityFilter && !cg.city.toLowerCase().includes(cityFilter)) return false

    if (qualFilter && !cg.qualification.toLowerCase().includes(qualFilter)) return false

    if (availFilter && cg.availability.toLowerCase() !== availFilter) return false

    if (service && service !== 'All services') {
      const sLower = String(service).toLowerCase()
      const hasSvc = (cg.services || []).some((s) => s.toLowerCase().includes(sLower))
      if (!hasSvc) return false
    }

    if (minRating && Number(minRating) > 0 && Number(cg.rating || 0) < Number(minRating)) {
      return false
    }

    if (maxRate && Number(maxRate) > 0 && Number(cg.hourlyRate || 0) > Number(maxRate)) {
      return false
    }

    if (maxDistance && Number(maxDistance) > 0 && Number(cg.distanceKm || 0) > Number(maxDistance)) {
      return false
    }

    return true
  })

  // Sort static list
  if (sort === 'price-asc' || sort === 'priceAsc') {
    list.sort((a, b) => a.hourlyRate - b.hourlyRate)
  } else if (sort === 'price-desc' || sort === 'priceDesc') {
    list.sort((a, b) => b.hourlyRate - a.hourlyRate)
  } else if (sort === 'experience') {
    list.sort((a, b) => b.experienceYears - a.experienceYears)
  } else if (sort === 'rating') {
    list.sort((a, b) => b.rating - a.rating || (b.reviewCount || 0) - (a.reviewCount || 0))
  } else if (sort === 'distance') {
    list.sort((a, b) => (a.distanceKm || 99) - (b.distanceKm || 99))
  } else {
    // default recommended: verified first, then highest rating
    list.sort((a, b) => Number(b.verified) - Number(a.verified) || b.rating - a.rating)
  }

  const total = list.length
  const p = Math.max(1, parseInt(page, 10) || 1)
  const l = Math.min(50, Math.max(1, parseInt(limit, 10) || 12))
  const start = (p - 1) * l
  const pageItems = list.slice(start, start + l).map(adaptCaregiver)
  const totalPages = Math.ceil(total / l) || 1

  return {
    caregivers: pageItems,
    pagination: {
      total,
      page: p,
      limit: l,
      totalPages,
    },
  }
}

/**
 * Fetch public verified caregivers directory with search, filtering, and pagination.
 *
 * @param {Object} [queryOptions] - Query parameters
 * @param {Object} [options] - Execution options
 * @returns {Promise<{ data: { caregivers: Array, pagination: Object }, source: string, isFallback: boolean }>}
 */
export const fetchPublicCaregivers = async (queryOptions = {}, options = {}) => {
  const backendParams = {}

  if (queryOptions.page) {
    backendParams.page = Math.max(1, parseInt(queryOptions.page, 10) || 1)
  }

  if (queryOptions.limit) {
    backendParams.limit = Math.min(50, Math.max(1, parseInt(queryOptions.limit, 10) || 12))
  }

  if (queryOptions.city && String(queryOptions.city).trim()) {
    backendParams.city = String(queryOptions.city).trim()
  }

  if (
    queryOptions.qualification &&
    String(queryOptions.qualification).trim() &&
    queryOptions.qualification !== 'Any'
  ) {
    backendParams.qualification = String(queryOptions.qualification).trim()
  }

  if (
    queryOptions.service &&
    String(queryOptions.service).trim() &&
    queryOptions.service !== 'All services'
  ) {
    backendParams.service = String(queryOptions.service).trim()
  }

  if (queryOptions.minRating && Number(queryOptions.minRating) > 0) {
    backendParams.minRating = Number(queryOptions.minRating)
  }

  if (queryOptions.maxRate && Number(queryOptions.maxRate) > 0) {
    backendParams.maxRate = Number(queryOptions.maxRate)
  }

  if (
    queryOptions.availability &&
    String(queryOptions.availability).trim() &&
    queryOptions.availability !== 'Any' &&
    queryOptions.availability !== 'Any availability'
  ) {
    backendParams.availabilityStatus = String(queryOptions.availability).trim()
  }

  const apiFn = async () => {
    const res = await apiClient.get('/api/caregivers', { params: backendParams })
    const items = Array.isArray(res.data) ? res.data : []
    let adapted = items.map(adaptCaregiver)

    // Optional client-side refinement for search keyword if provided
    if (queryOptions.search && String(queryOptions.search).trim()) {
      const q = String(queryOptions.search).trim().toLowerCase()
      adapted = adapted.filter((cg) => {
        const haystack = `${cg.name} ${cg.qualification} ${cg.area} ${cg.city} ${(cg.services || []).join(' ')}`.toLowerCase()
        return haystack.includes(q)
      })
    }

    // Optional client-side sort if specified
    if (queryOptions.sort === 'price-asc' || queryOptions.sort === 'priceAsc') {
      adapted.sort((a, b) => a.hourlyRate - b.hourlyRate)
    } else if (queryOptions.sort === 'price-desc' || queryOptions.sort === 'priceDesc') {
      adapted.sort((a, b) => b.hourlyRate - a.hourlyRate)
    } else if (queryOptions.sort === 'experience') {
      adapted.sort((a, b) => b.experienceYears - a.experienceYears)
    }

    return {
      caregivers: adapted,
      pagination: res.pagination || {
        total: adapted.length,
        page: backendParams.page || 1,
        limit: backendParams.limit || 12,
        totalPages: Math.ceil(adapted.length / (backendParams.limit || 12)) || 1,
      },
    }
  }

  const staticFn = async () => {
    return filterStaticCaregivers(queryOptions)
  }

  return executeDataOperation('caregivers:directory', {
    apiFn,
    staticFn,
    mode: options.mode,
  })
}

/**
 * Fetch a single caregiver profile by MongoDB ObjectId or legacy mock ID (e.g. 'cg-101').
 *
 * @param {string} id - MongoDB ObjectId (24 hex) or mock ID
 * @param {Object} [options] - Execution options
 * @returns {Promise<{ data: Object, source: string, isFallback: boolean }>}
 */
export const fetchPublicCaregiverById = async (id, options = {}) => {
  if (!id || typeof id !== 'string') {
    throw new ApiError({
      message: 'Invalid caregiver identifier provided',
      status: 400,
    })
  }

  const trimmed = id.trim()

  // 1. If it is NOT a MongoDB ObjectId, resolve statically from mock caregivers
  if (!isMongoObjectId(trimmed)) {
    const staticCaregiver = getCaregiverById(trimmed)

    if (!staticCaregiver) {
      throw new ApiError({
        message: `Caregiver with ID '${trimmed}' not found`,
        status: 404,
      })
    }

    return {
      data: adaptCaregiver(staticCaregiver),
      source: 'static',
      isFallback: false,
    }
  }

  // 2. For genuine MongoDB ObjectIds, query backend /api/caregivers/:id
  const apiFn = async () => {
    const res = await apiClient.get(`/api/caregivers/${trimmed}`)
    if (!res?.data) {
      throw new ApiError({
        message: 'Caregiver profile empty',
        status: 404,
      })
    }
    return adaptCaregiver(res.data)
  }

  const staticFn = async () => {
    const found = CAREGIVERS.find((c) => c.id === trimmed || c._id === trimmed)
    if (!found) {
      throw new ApiError({
        message: `Caregiver with ID '${trimmed}' not found in static fallback`,
        status: 404,
      })
    }
    return adaptCaregiver(found)
  }

  return executeDataOperation('caregivers:detail', {
    apiFn,
    staticFn,
    mode: options.mode,
  })
}

export const caregiversService = {
  fetchPublicCaregivers,
  fetchPublicCaregiverById,
}

export default caregiversService
