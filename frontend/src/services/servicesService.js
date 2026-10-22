/**
 * Public Services Catalog API Service
 *
 * Connects public services views to Express /api/services endpoints
 * with fallback support to local static seed data under network/server failure.
 */

import apiClient, { ApiError } from './apiClient.js'
import { executeDataOperation } from './dataModes.js'
import { adaptService, isMongoObjectId } from './adapters.js'
import { SERVICES, getServiceById } from '../data/services.js'

/**
 * Filter static services catalog in memory (used for fallback or static mode).
 */
const filterStaticServices = (queryOptions = {}) => {
  const { category, search, page = 1, limit = 50 } = queryOptions
  const q = typeof search === 'string' ? search.trim().toLowerCase() : ''
  const cat = typeof category === 'string' ? category.trim().toLowerCase() : 'all'

  let list = SERVICES.filter((svc) => {
    const matchesText =
      !q ||
      svc.name.toLowerCase().includes(q) ||
      (svc.short && svc.short.toLowerCase().includes(q)) ||
      (svc.description && svc.description.toLowerCase().includes(q)) ||
      (Array.isArray(svc.tags) && svc.tags.some((t) => t.toLowerCase().includes(q)))

    if (!matchesText) return false

    if (cat === 'all' || !cat) return true
    if (cat === 'popular') return Boolean(svc.popular)

    // Category or tag match
    const matchesCategory =
      (svc.category && svc.category.toLowerCase() === cat) ||
      (Array.isArray(svc.tags) && svc.tags.some((t) => t.toLowerCase() === cat))

    return matchesCategory
  })

  const total = list.length
  const p = Math.max(1, parseInt(page, 10) || 1)
  const l = Math.min(50, Math.max(1, parseInt(limit, 10) || 50))
  const start = (p - 1) * l
  const pageItems = list.slice(start, start + l).map(adaptService)
  const totalPages = Math.ceil(total / l) || 1

  return {
    services: pageItems,
    pagination: {
      total,
      page: p,
      limit: l,
      totalPages,
      hasNextPage: p < totalPages,
      hasPrevPage: p > 1,
    },
  }
}

/**
 * Fetch public active services with optional filtering, search, and pagination.
 *
 * @param {Object} [queryOptions] - Query parameters (category, search, page, limit, sort)
 * @param {Object} [options] - Execution options (e.g. mode override)
 * @returns {Promise<{ data: { services: Array, pagination: Object }, source: string, isFallback: boolean }>}
 */
export const fetchPublicServices = async (queryOptions = {}, options = {}) => {
  const cleanParams = {}

  if (queryOptions.search && String(queryOptions.search).trim()) {
    cleanParams.search = String(queryOptions.search).trim()
  }

  if (
    queryOptions.category &&
    String(queryOptions.category).trim() &&
    queryOptions.category !== 'all' &&
    queryOptions.category !== 'popular'
  ) {
    cleanParams.category = String(queryOptions.category).trim()
  }

  if (queryOptions.page) {
    cleanParams.page = Math.max(1, parseInt(queryOptions.page, 10) || 1)
  }

  if (queryOptions.limit) {
    cleanParams.limit = Math.min(50, Math.max(1, parseInt(queryOptions.limit, 10) || 10))
  }

  if (queryOptions.sort) {
    cleanParams.sort = String(queryOptions.sort).trim()
  }

  const apiFn = async () => {
    const res = await apiClient.get('/api/services', { params: cleanParams })
    const items = Array.isArray(res.data) ? res.data : []
    const adapted = items.map(adaptService)

    // If client requested popular filter or frontend specific filtering
    let filtered = adapted
    if (queryOptions.category === 'popular') {
      filtered = adapted.filter((s) => s.popular)
    }

    return {
      services: filtered,
      pagination: res.pagination || {
        total: filtered.length,
        page: cleanParams.page || 1,
        limit: cleanParams.limit || 50,
        totalPages: 1,
      },
    }
  }

  const staticFn = async () => {
    return filterStaticServices(queryOptions)
  }

  return executeDataOperation('services:list', {
    apiFn,
    staticFn,
    mode: options.mode,
  })
}

/**
 * Fetch a single service by MongoDB ObjectId or legacy mock slug/ID.
 *
 * @param {string} idOrSlug - MongoDB ObjectId (24 hex) or mock slug (e.g. 'svc-monitoring')
 * @param {Object} [options] - Execution options
 * @returns {Promise<{ data: Object, source: string, isFallback: boolean }>}
 */
export const fetchPublicServiceById = async (idOrSlug, options = {}) => {
  if (!idOrSlug || typeof idOrSlug !== 'string') {
    throw new ApiError({
      message: 'Invalid service identifier provided',
      status: 400,
    })
  }

  const trimmed = idOrSlug.trim()

  // 1. If it is NOT a MongoDB ObjectId, resolve statically from mock services
  if (!isMongoObjectId(trimmed)) {
    const staticService =
      getServiceById(trimmed) ||
      SERVICES.find((s) => s.slug === trimmed || s.id === trimmed)

    if (!staticService) {
      throw new ApiError({
        message: `Service '${trimmed}' not found`,
        status: 404,
      })
    }

    return {
      data: adaptService(staticService),
      source: 'static',
      isFallback: false,
    }
  }

  // 2. For genuine MongoDB ObjectIds, query backend /api/services/:id
  const apiFn = async () => {
    const res = await apiClient.get(`/api/services/${trimmed}`)
    if (!res?.data) {
      throw new ApiError({
        message: 'Service record empty',
        status: 404,
      })
    }
    return adaptService(res.data)
  }

  const staticFn = async () => {
    const found = SERVICES.find((s) => s.id === trimmed || s._id === trimmed)
    if (!found) {
      throw new ApiError({
        message: `Service with ID '${trimmed}' not found in static fallback`,
        status: 404,
      })
    }
    return adaptService(found)
  }

  return executeDataOperation('services:detail', {
    apiFn,
    staticFn,
    mode: options.mode,
  })
}

export const servicesService = {
  fetchPublicServices,
  fetchPublicServiceById,
  getServices: fetchPublicServices,
  getServiceById: fetchPublicServiceById,
}

export default servicesService
