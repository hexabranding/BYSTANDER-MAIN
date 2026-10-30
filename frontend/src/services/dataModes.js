/**
 * Centralized Data Access Modes & Fallback Infrastructure
 *
 * Implements a three-tier data-access governance model:
 * - 'static': Pure local mock/seed data simulation (offline development or unintegrated modules)
 * - 'api-first': Backend API primary, with controlled static fallback strictly for approved public read-only catalogs
 * - 'api-only': Backend API is the sole source of truth; errors are propagated transparently
 *
 * Fallback Safety Invariants:
 * 1. Strictly enforces an allowlist of public read-only resources eligible for fallback.
 * 2. Strictly prohibits fallback for authentication, bookings, state transitions, OTP, SOS, messaging, or profile edits.
 * 3. Never turns an API failure into a successful mutation.
 * 4. Never falls back on application-level 4xx errors (400, 401, 403, 404, 409).
 * 5. Returns explicit source metadata ({ data, source: 'api' | 'static', isFallback: boolean }).
 */

import { ApiError } from './apiClient.js';

export const DATA_MODES = {
  STATIC: 'static',
  API_FIRST: 'api-first',
  API_ONLY: 'api-only',
};

// Approved read-only showcase resources (only permitted when mode is explicitly api-first; ignored in api-only)
export const FALLBACK_ALLOWLIST = new Set([
  'services:list',
  'services:detail',
  'caregivers:directory',
  'caregivers:detail',
]);

// Strict Blocklist: State mutations, auth, security, and transactions MUST NEVER use static fallback
export const FORBIDDEN_FALLBACK_RESOURCES = new Set([
  'auth:login',
  'auth:register',
  'auth:me',
  'auth:logout',
  'customer:profile_update',
  'caregiver:profile_update',
  'caregiver:availability_update',
  'bookings:create',
  'bookings:rebroadcast',
  'bookings:accept',
  'bookings:reject',
  'bookings:cancel',
  'bookings:checkin_otp',
  'bookings:checkin_verify',
  'bookings:checkout_otp',
  'bookings:checkout_verify',
  'messages:send',
  'messages:read',
  'notifications:mutation',
  'notifications:read',
  'sos:create',
  'sos:update',
  'sos:assign',
  'sos:resolve',
  'payments:simulate',
  'payouts:request',
  'payouts:update_status',
  'commissions:reconcile',
  'reviews:submit',
  'reviews:my',
  'complaints:create',
]);

/**
 * Determine the global configured data mode from Vite environment.
 */
export const getGlobalDataMode = () => {
  const envMode = typeof import.meta !== 'undefined' && import.meta.env?.VITE_DATA_MODE;
  if (envMode && Object.values(DATA_MODES).includes(envMode)) {
    return envMode;
  }
  return DATA_MODES.API_ONLY;
};

/**
 * Determines whether a given resource key is permitted to fall back to static data.
 */
export const isFallbackPermitted = (resourceKey) => {
  if (!resourceKey || typeof resourceKey !== 'string') return false;
  if (FORBIDDEN_FALLBACK_RESOURCES.has(resourceKey)) return false;
  return FALLBACK_ALLOWLIST.has(resourceKey);
};

/**
 * Executes a data operation adhering to the configured data mode and fallback rules.
 *
 * @param {string} resourceKey - Unique identifier for the data resource (e.g. 'services:list')
 * @param {Object} options
 * @param {Function} [options.apiFn] - Asynchronous function performing the real API call
 * @param {Function} [options.staticFn] - Function returning static/mock data
 * @param {string} [options.mode] - Optional mode override ('static' | 'api-first' | 'api-only')
 * @returns {Promise<{ data: any, source: 'api' | 'static', isFallback: boolean, error?: ApiError }>}
 */
export const executeDataOperation = async (resourceKey, { apiFn, staticFn, mode } = {}) => {
  const globalMode = getGlobalDataMode();
  let effectiveMode = mode || globalMode;

  // Validate mode value
  if (!Object.values(DATA_MODES).includes(effectiveMode)) {
    effectiveMode = DATA_MODES.API_FIRST;
  }

  // Safety Constraint: If a transactional or non-allowlisted resource is requested,
  // it must never fall back to static data even if the global mode is 'api-first'.
  const canFallback = isFallbackPermitted(resourceKey);
  if (!canFallback && effectiveMode === DATA_MODES.API_FIRST) {
    effectiveMode = DATA_MODES.API_ONLY;
  }

  // 1. Static Mode: Return static data directly
  if (effectiveMode === DATA_MODES.STATIC) {
    if (typeof staticFn !== 'function') {
      throw new Error(`Static fallback provider not defined for resource '${resourceKey}'`);
    }
    const staticData = await staticFn();
    return {
      data: staticData,
      source: 'static',
      isFallback: false,
    };
  }

  // 2. Api-Only Mode: Sole source of truth
  if (effectiveMode === DATA_MODES.API_ONLY) {
    if (typeof apiFn !== 'function') {
      throw new Error(`API provider function not defined for resource '${resourceKey}'`);
    }
    const apiData = await apiFn();
    return {
      data: apiData,
      source: 'api',
      isFallback: false,
    };
  }

  // 3. Api-First Mode: Attempt API, fall back only on eligible server/network failures
  if (typeof apiFn !== 'function') {
    throw new Error(`API provider function required for api-first resource '${resourceKey}'`);
  }

  try {
    const apiData = await apiFn();
    return {
      data: apiData,
      source: 'api',
      isFallback: false,
    };
  } catch (error) {
    // If not an allowlisted resource, re-throw immediately
    if (!canFallback) {
      throw error;
    }

    // Do NOT fall back on 4xx application errors (400, 401, 403, 404, 409)
    // Application-level errors reflect intentional server rejection and must be surfaced.
    const isApplicationError =
      error instanceof ApiError && error.status >= 400 && error.status < 500;
    if (isApplicationError) {
      throw error;
    }

    // Only network disconnects (status 0) or server errors (500+) may trigger fallback
    if (typeof staticFn === 'function') {
      const fallbackData = await staticFn();
      return {
        data: fallbackData,
        source: 'static',
        isFallback: true,
        error: error instanceof ApiError ? error : new ApiError({ originalError: error }),
      };
    }

    throw error;
  }
};

export default {
  DATA_MODES,
  FALLBACK_ALLOWLIST,
  FORBIDDEN_FALLBACK_RESOURCES,
  getGlobalDataMode,
  isFallbackPermitted,
  executeDataOperation,
};
