/**
 * Complaints Domain Service
 *
 * Provides customer and caregiver complaint submission and lifecycle tracking
 * against the Express/MongoDB backend.
 *
 * All operations run strictly against the verified API endpoints with session-derived
 * identity and participant authorization.
 */

import apiClient from './apiClient.js';
import { adaptComplaint } from './adapters.js';

/**
 * Submit a formal grievance or complaint regarding a booking or platform experience.
 *
 * @param {Object} payload - { bookingId?, category, priority, subject, description, evidence? }
 * @returns {Promise<Object>} Created and adapted complaint
 */
export const submitComplaint = async (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Complaint payload is required');
  }

  const { subject, description, category } = payload;
  if (!subject || subject.trim().length < 3) {
    throw new Error('Subject must be at least 3 characters long');
  }
  if (!description || description.trim().length < 5) {
    throw new Error('Description must be at least 5 characters long');
  }
  if (!category) {
    throw new Error('Complaint category is required');
  }

  const response = await apiClient.post('/complaints', {
    bookingId: payload.bookingId || undefined,
    category: payload.category,
    priority: payload.priority || 'Medium',
    subject: payload.subject.trim(),
    description: payload.description.trim(),
    evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
  });

  const rawData = response?.data || response;
  return adaptComplaint(rawData);
};

/**
 * Retrieve paginated list of complaints filed by the authenticated caller.
 *
 * @param {Object} [query={}] - Optional filters { page, limit, status, search }
 * @returns {Promise<{ complaints: Array, pagination: Object }>}
 */
export const getMyComplaints = async (query = {}) => {
  const response = await apiClient.get('/complaints', { params: query });
  const rawList = Array.isArray(response?.data) ? response.data : [];
  const complaints = rawList.map(adaptComplaint);

  const pagination = response?.pagination || {
    total: complaints.length,
    page: 1,
    limit: complaints.length || 10,
    totalPages: 1,
  };

  return { complaints, pagination };
};

/**
 * Retrieve details for a single complaint filed by or involving the caller.
 *
 * @param {string} id - Complaint identifier or reference number
 * @returns {Promise<Object>}
 */
export const getComplaintById = async (id) => {
  if (!id) {
    throw new Error('Complaint identifier is required');
  }

  const response = await apiClient.get(`/complaints/${id}`);
  const rawData = response?.data || response;
  return adaptComplaint(rawData);
};

export const complaintService = {
  submitComplaint,
  getMyComplaints,
  getComplaintById,
};

export default complaintService;
