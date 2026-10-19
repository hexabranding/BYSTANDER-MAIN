/**
 * Bystander Centralized API Client
 *
 * Provides a standardized HTTP client wrapping native fetch:
 * - Central base URL resolution with Vite environment variable support
 * - Automatic 'credentials: include' for HTTP-only cookie session handling
 * - In-memory bearer token management (strictly avoids localStorage for tokens)
 * - Safe error normalization and non-JSON error response resilience
 * - Distinct network, timeout, validation, and authorization error classification
 * - Zero logging of sensitive credentials, tokens, or health data
 */

// Custom Normalized API Error
export class ApiError extends Error {
  constructor({
    message = 'An unexpected API error occurred',
    status = 500,
    code = 'API_ERROR',
    errors = [],
    data = null,
    originalError = null,
  } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = Array.isArray(errors) ? errors : [errors].filter(Boolean);
    this.data = data;
    this.originalError = originalError;
  }

  get isNetworkError() {
    return this.status === 0 || this.code === 'NETWORK_ERROR';
  }

  get isTimeout() {
    return this.code === 'TIMEOUT';
  }

  get isAuthError() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isConflict() {
    return this.status === 409;
  }

  get isValidationError() {
    return this.status === 400 || this.code === 'ValidationError';
  }

  get isRateLimited() {
    return this.status === 429 || this.code === 'RateLimitError';
  }

  get isServerError() {
    return this.status >= 500;
  }
}

// In-Memory Token Store (Never persisted to localStorage or sessionStorage)
let inMemoryToken = null;

export const setAuthToken = (token) => {
  inMemoryToken = typeof token === 'string' && token.trim() ? token.trim() : null;
};

export const getAuthToken = () => inMemoryToken;

export const clearAuthToken = () => {
  inMemoryToken = null;
};

// Base URL resolution
export const getApiBaseUrl = () => {
  const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return '/api';
};

/**
 * Normalize and parse error responses into an ApiError instance.
 */
export const parseErrorResponse = async (response) => {
  const status = response.status;
  let errorData = null;
  let message = `Request failed with status ${status}`;
  let code = 'HTTP_ERROR';
  let errors = [];

  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      errorData = await response.json();
      message = errorData.message || errorData.error || message;
      code = errorData.error || errorData.code || (status === 400 ? 'ValidationError' : 'HTTP_ERROR');
      if (Array.isArray(errorData.errors)) {
        errors = errorData.errors;
      }
    } else {
      const text = await response.text();
      if (text && text.length < 200) {
        message = text;
      }
    }
  } catch {
    // If response body parsing fails, retain default status message
  }

  // Refine user-facing messages for standard HTTP status codes
  if (status === 400) {
    code = 'ValidationError';
    message = message || 'Validation failed. Please verify the submitted data.';
  } else if (status === 401) {
    code = 'Unauthorized';
    message = message || 'Authentication required. Please sign in to continue.';
  } else if (status === 403) {
    code = 'Forbidden';
    message = message || 'Access denied. You do not have permission for this resource.';
  } else if (status === 404) {
    code = 'NotFoundError';
    message = message || 'The requested resource was not found.';
  } else if (status === 409) {
    code = 'ConflictError';
    message = message || 'A conflicting record or state prevented this action.';
  } else if (status === 429) {
    code = 'RateLimitError';
    message = message || 'Too many requests. Please slow down and try again shortly.';
  } else if (status >= 500) {
    code = 'SERVER_ERROR';
    message = 'The service encountered an error. Please try again shortly.';
  }

  return new ApiError({
    message,
    status,
    code,
    errors,
    data: errorData,
  });
};

/**
 * Core HTTP Request Execution
 */
export const request = async (endpoint, options = {}) => {
  const baseUrl = getApiBaseUrl();
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Prevent duplicate baseUrl prefix if endpoint already includes it (e.g. /api/services)
  if (baseUrl && (cleanEndpoint.startsWith(`${baseUrl}/`) || cleanEndpoint === baseUrl)) {
    cleanEndpoint = cleanEndpoint.slice(baseUrl.length) || '/';
  }

  let url = `${baseUrl}${cleanEndpoint}`;

  // Serialize query parameters if provided
  if (options.params && typeof options.params === 'object') {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) {
      url += (url.includes('?') ? '&' : '?') + qs;
    }
  }

  const {
    method = 'GET',
    headers = {},
    body = null,
    timeoutMs = 20000,
    credentials = 'include',
    signal: externalSignal,
    params: _ignoredParams,
    ...restOptions
  } = options;

  // Timeout controller setup
  const controller = new AbortController();
  let timerId = null;

  if (timeoutMs > 0) {
    timerId = setTimeout(() => {
      controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  }

  // Forward external abort signal if provided
  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort());
  }

  // Merge headers
  const mergedHeaders = {
    Accept: 'application/json',
    ...headers,
  };

  // Attach in-memory bearer token if present and not already specified
  if (inMemoryToken && !mergedHeaders.Authorization && !mergedHeaders.authorization) {
    mergedHeaders.Authorization = `Bearer ${inMemoryToken}`;
  }

  // Handle JSON body formatting
  let serializedBody = body;
  if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
    mergedHeaders['Content-Type'] = 'application/json';
    serializedBody = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, {
      method,
      headers: mergedHeaders,
      body: serializedBody,
      credentials,
      signal: controller.signal,
      ...restOptions,
    });

    if (timerId) clearTimeout(timerId);

    // If HTTP error status, parse and throw normalized ApiError
    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    // HTTP 204 No Content
    if (response.status === 204) {
      return { success: true, status: 204, data: null };
    }

    // Parse JSON response body safely
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await response.json();
    }

    // Non-JSON response (e.g. text/plain or blob)
    const textData = await response.text();
    return { success: true, status: response.status, data: textData };
  } catch (error) {
    if (timerId) clearTimeout(timerId);

    // Re-throw if already an ApiError
    if (error instanceof ApiError) {
      throw error;
    }

    // Handle Abort / Timeout errors
    if (error.name === 'AbortError' || error.message?.includes('timed out')) {
      throw new ApiError({
        message: 'The request took too long to complete. Please try again.',
        status: 0,
        code: 'TIMEOUT',
        originalError: error,
      });
    }

    // Handle Network / Connection errors
    throw new ApiError({
      message: 'Unable to reach the server. Please check your internet connection.',
      status: 0,
      code: 'NETWORK_ERROR',
      originalError: error,
    });
  }
};

// Convenience HTTP Methods
export const get = (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' });
export const post = (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'POST', body });
export const put = (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PUT', body });
export const patch = (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PATCH', body });
export const del = (endpoint, options = {}) => request(endpoint, { ...options, method: 'DELETE' });

export const apiClient = {
  request,
  get,
  post,
  put,
  patch,
  delete: del,
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  getApiBaseUrl,
  parseErrorResponse,
  ApiError,
};

export default apiClient;
