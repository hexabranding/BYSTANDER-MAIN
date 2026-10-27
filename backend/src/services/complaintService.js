import mongoose from 'mongoose';
import { Complaint, generateComplaintNumber } from '../models/Complaint.js';
import { Booking } from '../models/Booking.js';
import { User } from '../models/User.js';
import { safeDispatchNotification } from './notificationService.js';

/**
 * Sanitizes complaint document for customer/caregiver views.
 * Strictly strips internal investigation notes and private administrative metadata.
 */
const sanitizePublicComplaint = (complaint) => {
  if (!complaint) return null;
  const obj = complaint.toObject ? complaint.toObject() : { ...complaint };
  delete obj.internalNotes;
  delete obj.__v;
  return obj;
};

/**
 * Submit a formal complaint as an authenticated customer or caregiver.
 * Strictly derives complainant identity from the authenticated session.
 *
 * @param {Object} user - Authenticated User document
 * @param {Object} data - Validated complaint payload { bookingId, category, priority, subject, description, evidence }
 * @returns {Promise<Object>} Created and sanitized complaint
 */
export const createComplaint = async (user, data) => {
  const { bookingId, category, priority = 'Medium', subject, description, evidence = [] } = data;

  let respondent = null;
  let respondentRole = 'platform';
  let bookingDoc = null;

  // 1. If linked to a booking, enforce participant authorization and derive respondent
  if (bookingId) {
    bookingDoc = await Booking.findById(bookingId);
    if (!bookingDoc) {
      const err = new Error('Booking engagement not found');
      err.statusCode = 404;
      err.name = 'NotFoundError';
      throw err;
    }

    const isCustomer = bookingDoc.customer.toString() === user._id.toString();
    const isCaregiver = bookingDoc.caregiverUser.toString() === user._id.toString();

    if (!isCustomer && !isCaregiver) {
      const err = new Error('You are not an authorized participant for this booking engagement');
      err.statusCode = 403;
      err.name = 'ForbiddenError';
      throw err;
    }

    if (isCustomer) {
      respondent = bookingDoc.caregiverUser;
      respondentRole = 'caregiver';
    } else {
      respondent = bookingDoc.customer;
      respondentRole = 'customer';
    }
  }

  // 2. Initial audit timeline entry
  const initialTimeline = [
    {
      at: new Date(),
      action: 'Complaint submitted',
      by: user._id,
      byRole: user.role,
      notes: `Complaint filed under category '${category}' with priority '${priority}'`,
    },
  ];

  // 3. Safe complaint creation with retry for duplicate complaint numbers
  let complaint = null;
  let attempts = 0;
  const maxRetries = 3;

  while (!complaint && attempts < maxRetries) {
    attempts += 1;
    try {
      const complaintNumber = generateComplaintNumber();
      complaint = await Complaint.create({
        complaintNumber,
        booking: bookingDoc ? bookingDoc._id : null,
        complainant: user._id,
        complainantRole: user.role,
        respondent,
        respondentRole,
        category,
        priority,
        status: 'submitted',
        subject,
        description,
        evidence,
        internalNotes: [],
        timeline: initialTimeline,
      });
    } catch (createErr) {
      if (createErr.code === 11000) {
        if (attempts < maxRetries) {
          continue;
        }
        const controlledErr = new Error('Failed to generate a unique complaint reference after multiple attempts. Please try again.');
        controlledErr.statusCode = 500;
        controlledErr.name = 'DuplicateKeyError';
        throw controlledErr;
      }
      throw createErr;
    }
  }

  if (!complaint) {
    const controlledErr = new Error('Failed to generate a unique complaint reference after multiple attempts. Please try again.');
    controlledErr.statusCode = 500;
    controlledErr.name = 'DuplicateKeyError';
    throw controlledErr;
  }

  // 4. Fail-safe in-app notification dispatch to complainant
  await safeDispatchNotification({
    recipient: user._id,
    type: 'complaint_update',
    title: 'Complaint Registered',
    message: `Your complaint (${complaint.complaintNumber}) has been recorded and queued for investigation.`,
    metadata: { complaintId: complaint._id, complaintNumber: complaint.complaintNumber },
  });

  return sanitizePublicComplaint(complaint);
};

/**
 * Retrieve paginated list of complaints filed by the authenticated user.
 * Strictly scopes query to { complainant: user._id } and strips internal notes.
 *
 * @param {Object} user - Authenticated user
 * @param {Object} query - { page, limit, status, search }
 * @returns {Promise<{ complaints: Array, pagination: Object }>}
 */
export const getMyComplaints = async (user, query = {}) => {
  const { page = 1, limit = 10, status, search } = query;

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (parsedPage - 1) * parsedLimit;

  // Strict ownership constraint: users only see their own complaints
  const filter = { complainant: user._id };

  if (status && status !== 'All' && status !== '') {
    filter.status = status.trim().toLowerCase().replace(/\s+/g, '_');
  }

  if (search && search.trim().length > 0) {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { complaintNumber: searchRegex },
      { subject: searchRegex },
      { category: searchRegex },
    ];
  }

  const [rawComplaints, total] = await Promise.all([
    Complaint.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .select('-internalNotes') // Security: never expose internal notes to non-admin
      .populate('booking', 'bookingNumber serviceName date status')
      .populate('respondent', 'fullName role'),
    Complaint.countDocuments(filter),
  ]);

  const complaints = rawComplaints.map(sanitizePublicComplaint);

  return {
    complaints,
    pagination: {
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit) || 1,
    },
  };
};

/**
 * Helper to build lookup query supporting either MongoDB ObjectId (via findById) or CSPRNG complaintNumber
 */
const findComplaintRecord = (complaintId) => {
  const isObjectId = Boolean(complaintId && mongoose.Types.ObjectId.isValid(complaintId));
  const isComplaintNumber = Boolean(complaintId && typeof complaintId === 'string' && /^CP-\d{8}-\d{5}$/i.test(complaintId.trim()));
  if (!isObjectId && !isComplaintNumber) {
    const err = new Error('Invalid complaint identifier format');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }
  return isObjectId
    ? Complaint.findById(complaintId)
    : Complaint.findOne({ complaintNumber: complaintId.trim().toUpperCase() });
};

/**
 * Retrieve individual complaint details for authenticated complainant or respondent.
 * Strictly forbids unauthorized strangers and strips internal notes for non-admin callers.
 *
 * @param {Object} user - Authenticated user
 * @param {string} complaintId - Complaint ObjectId or complaint number
 * @returns {Promise<Object>}
 */
export const getComplaintById = async (user, complaintId) => {
  const complaint = await findComplaintRecord(complaintId)
    .populate('booking', 'bookingNumber serviceName date status')
    .populate('complainant', 'fullName role')
    .populate('respondent', 'fullName role');

  if (!complaint) {
    const err = new Error('Complaint record not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  const isComplainant = complaint.complainant._id.toString() === user._id.toString();
  const isRespondent = complaint.respondent && complaint.respondent._id.toString() === user._id.toString();
  const isAdmin = user.role === 'admin';

  if (!isComplainant && !isRespondent && !isAdmin) {
    const err = new Error('You do not have permission to view this complaint dossier');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  if (!isAdmin) {
    return sanitizePublicComplaint(complaint);
  }

  return complaint;
};

/**
 * Retrieve paginated administrative queue of all complaints with triage statistics.
 *
 * @param {Object} query - { page, limit, status, priority, category, search }
 * @returns {Promise<{ complaints: Array, pagination: Object, stats: Object }>}
 */
export const getAdminComplaints = async (query = {}) => {
  const { page = 1, limit = 10, status, priority, category, search } = query;

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (parsedPage - 1) * parsedLimit;

  const filter = {};

  if (status && status !== 'All' && status !== '') {
    filter.status = status.trim().toLowerCase().replace(/\s+/g, '_');
  }

  if (priority && priority !== 'All' && priority !== '') {
    filter.priority = priority.trim();
  }

  if (category && category !== 'All' && category !== '') {
    filter.category = category.trim();
  }

  if (search && search.trim().length > 0) {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { complaintNumber: searchRegex },
      { subject: searchRegex },
      { description: searchRegex },
    ];
  }

  const [complaints, total, openCount, underReviewCount, resolvedCount, highPriorityCount] = await Promise.all([
    Complaint.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .populate('complainant', 'fullName email role status')
      .populate('respondent', 'fullName email role status')
      .populate('booking', 'bookingNumber serviceName status totalAmount date'),
    Complaint.countDocuments(filter),
    Complaint.countDocuments({ status: 'submitted' }),
    Complaint.countDocuments({ status: { $in: ['under_review', 'action_taken'] } }),
    Complaint.countDocuments({ status: 'resolved' }),
    Complaint.countDocuments({ priority: { $in: ['High', 'Critical'] }, status: { $ne: 'resolved' } }),
  ]);

  return {
    complaints,
    pagination: {
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit) || 1,
    },
    stats: {
      total,
      open: openCount,
      underReview: underReviewCount,
      resolved: resolvedCount,
      highPriority: highPriorityCount,
    },
  };
};

/**
 * Retrieve single administrative complaint record with complete internal notes and timeline.
 *
 * @param {string} complaintId
 * @returns {Promise<Object>}
 */
export const getAdminComplaintById = async (complaintId) => {
  const complaint = await findComplaintRecord(complaintId)
    .populate('complainant', 'fullName email phone role status')
    .populate('respondent', 'fullName email phone role status')
    .populate('booking', 'bookingNumber serviceName status totalAmount date startTime hours')
    .populate('internalNotes.by', 'fullName email')
    .populate('resolution.resolvedBy', 'fullName email');

  if (!complaint) {
    const err = new Error('Complaint dossier not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  return complaint;
};

/**
 * Administrative transition of complaint status with resolution audit logging.
 *
 * @param {string} complaintId
 * @param {Object} payload - { status, resolutionDetails, notes }
 * @param {Object} adminUser - Authenticated admin
 * @returns {Promise<Object>}
 */
export const updateComplaintStatus = async (complaintId, payload, adminUser) => {
  const { status: newStatus, resolutionDetails, notes } = payload;
  const complaint = await findComplaintRecord(complaintId);
  if (!complaint) {
    const err = new Error('Complaint dossier not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  const previousStatus = complaint.status;

  if (previousStatus === newStatus) {
    const err = new Error(`Complaint is already in '${newStatus}' status`);
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  if (['resolved', 'dismissed'].includes(previousStatus) && newStatus === 'submitted') {
    const err = new Error(`Cannot reset a closed '${previousStatus}' complaint back to 'submitted'`);
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // Build updates
  complaint.status = newStatus;

  const timelineNote = notes || resolutionDetails || `Status updated from ${previousStatus} to ${newStatus}`;
  complaint.timeline.push({
    at: new Date(),
    action: `Status changed to ${newStatus}`,
    by: adminUser._id,
    byRole: 'admin',
    notes: timelineNote,
  });

  if (['resolved', 'dismissed'].includes(newStatus)) {
    complaint.resolution = {
      resolvedAt: new Date(),
      resolvedBy: adminUser._id,
      resolutionDetails: resolutionDetails ? resolutionDetails.trim() : null,
    };
  }

  await complaint.save();

  // Send update notification to complainant
  await safeDispatchNotification({
    recipient: complaint.complainant,
    type: 'complaint_update',
    title: 'Complaint Update',
    message: `Your complaint (${complaint.complaintNumber}) is now marked as '${newStatus}'.`,
    metadata: { complaintId: complaint._id, status: newStatus },
  });

  return complaint;
};

/**
 * Append an internal administrative investigation note.
 *
 * @param {string} complaintId
 * @param {Object} payload - { note }
 * @param {Object} adminUser
 * @returns {Promise<Object>}
 */
export const addInternalNote = async (complaintId, payload, adminUser) => {
  const { note } = payload;
  const complaint = await findComplaintRecord(complaintId);
  if (!complaint) {
    const err = new Error('Complaint dossier not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  const trimmedNote = note.trim();
  complaint.internalNotes.push({
    note: trimmedNote,
    by: adminUser._id,
    byName: adminUser.fullName,
    at: new Date(),
  });

  complaint.timeline.push({
    at: new Date(),
    action: 'Internal investigation note added',
    by: adminUser._id,
    byRole: 'admin',
    notes: `Note recorded by ${adminUser.fullName}`,
  });

  await complaint.save();
  return complaint;
};

export const complaintService = {
  createComplaint,
  getMyComplaints,
  getComplaintById,
  getAdminComplaints,
  getAdminComplaintById,
  updateComplaintStatus,
  addInternalNote,
};

export default complaintService;
