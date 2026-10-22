/**
 * Caregiver Documents & Verification Domain Service
 *
 * Implements communication with /api/caregiver/documents endpoints.
 * Provides truthful document fetching, uploading, and verification tracking.
 */

import apiClient from './apiClient.js'
import { executeDataOperation } from './dataModes.js'

/**
 * Retrieve authenticated caregiver's verification dossier, documents, and audit history.
 * @param {Object} [options] - Execution options (e.g., mode override)
 * @returns {Promise<Object>} Truthful documents state
 */
export const getMyDocuments = async (options = {}) => {
  const result = await executeDataOperation('caregiver:getMyDocuments', {
    apiFn: async () => {
      const response = await apiClient.get('/caregiver/documents')
      return response?.data ?? response
    },
    staticFn: () => null,
    mode: options.mode,
  })

  // Ensure compatibility with callers that inspect result.data (dataModes standard)
  // as well as callers expecting the dossier record directly (e.g. DocumentsPage)
  if (result?.data && typeof result.data === 'object') {
    return Object.assign(result.data, result)
  }
  return result
}

/**
 * Upload or re-upload an individual verification document.
 * @param {Object|FormData} payload - { documentType, fileName, fileSize, mimeType, fileData, fileKey } or FormData
 * @param {Object} [options] - Execution options (e.g., mode override)
 * @returns {Promise<Object>} Created/updated document metadata
 */
export const uploadDocument = async (payload, options = {}) => {
  if (!payload) {
    throw new Error('Document payload is required for upload')
  }

  const result = await executeDataOperation('caregiver:uploadDocument', {
    apiFn: async () => {
      const response = await apiClient.post('/caregiver/documents', payload)
      return response?.data ?? response
    },
    staticFn: null, // Prohibit silent mock writes on document upload
    mode: options.mode,
  })

  if (result?.data && typeof result.data === 'object') {
    return Object.assign(result.data, result)
  }
  return result
}

export default {
  getMyDocuments,
  uploadDocument,
}
