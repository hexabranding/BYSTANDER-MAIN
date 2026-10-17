import mongoose from 'mongoose';
import { SosIncident, Booking, CustomerProfile, User } from '../models/index.js';
import { generateIncidentNumber } from '../models/SosIncident.js';
import { safeDispatchNotification } from './notificationService.js';

/**
 * Raise a high-priority SOS emergency incident for an authorized booking engagement.
 */
export const raiseSos = async (user, sosData) => {
  const { bookingId, summary, priority, location } = sosData;

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    const err = new Error('Invalid booking identifier');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // 1. Fetch booking to verify existence and participant links
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  // 2. Lifecycle precondition: Cannot raise an SOS for cancelled or rejected bookings
  if (booking.status === 'cancelled' || booking.status === 'rejected') {
    const err = new Error(
      `Cannot raise an SOS for a booking with status '${booking.status}'. SOS can only be raised for confirmed, in-progress, or active care engagements.`,
    );
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // 3. Object-level participant authorization check
  const isCustomer = booking.customer.toString() === user._id.toString();
  const isCaregiver = booking.caregiverUser.toString() === user._id.toString();
  const isAdmin = user.role === 'admin';

  if (!isCustomer && !isCaregiver && !isAdmin) {
    const err = new Error('You are not authorized to raise an SOS for this booking');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  // 4. Retrieve emergency contact from CustomerProfile if available
  const customerProfile = await CustomerProfile.findOne({ user: booking.customer });
  const registeredContact = customerProfile?.emergencyContact;

  const emergencyNotification = {
    status: 'not_configured',
    attempted: false,
    attemptedAt: null,
    contactName: registeredContact?.name || null,
    contactRelation: registeredContact?.relation || null,
    notes: registeredContact?.phone
      ? 'Emergency contact identified. Automated SMS/Telephony emergency dispatch provider is not configured in this environment.'
      : 'No emergency contact registered in customer profile. Automated dispatch is not configured.',
  };

  // 5. Build initial timeline event
  const initialTimeline = [
    {
      at: new Date(),
      action: 'SOS Incident Raised',
      by: user._id,
      byRole: user.role,
      notes: summary,
    },
  ];

  // 6. Safe incident creation with retry for duplicate incident numbers
  let incident = null;
  let attempts = 0;
  const maxRetries = 3;

  while (!incident && attempts < maxRetries) {
    attempts += 1;
    try {
      const incidentNumber = generateIncidentNumber();
      incident = await SosIncident.create({
        incidentNumber,
        booking: booking._id,
        raisedBy: user._id,
        raisedByRole: user.role,
        customer: booking.customer,
        caregiver: booking.caregiver,
        caregiverUser: booking.caregiverUser,
        priority: priority || 'Critical',
        status: 'Open',
        location: location || { isAvailable: false },
        summary,
        emergencyContactNotification: emergencyNotification,
        timeline: initialTimeline,
      });
    } catch (createErr) {
      if (createErr.code === 11000 && createErr.keyPattern?.incidentNumber && attempts < maxRetries) {
        // Duplicate key race on incidentNumber, retry with new random suffix
        continue;
      }
      throw createErr;
    }
  }

  // 7. Fail-safe notification to counterpart participant
  const notifyRecipient = isCustomer ? booking.caregiverUser : booking.customer;
  await safeDispatchNotification({
    recipient: notifyRecipient,
    type: 'sos_raised',
    title: '🚨 Emergency SOS Incident Raised',
    message: `Emergency SOS (${incident.incidentNumber}) was raised for booking #${booking._id.toString().slice(-6)}: ${summary.slice(0, 100)}`,
    metadata: {
      bookingId: booking._id,
      sosIncidentId: incident._id,
      incidentNumber: incident.incidentNumber,
      priority: incident.priority,
    },
    idempotencyKey: `sos:${incident._id}:${notifyRecipient}`,
  });

  return incident.populate([
    { path: 'customer', select: 'fullName email phone' },
    { path: 'caregiverUser', select: 'fullName email phone' },
    { path: 'booking', select: 'serviceName status startDateTime endDateTime location' },
  ]);
};

/**
 * Retrieve a list of SOS incidents scoped to the caller's authorized visibility.
 */
export const getSosIncidents = async (user, query = {}) => {
  const filter = {};

  // Object-level scoping: Customers and Caregivers only see incidents for their bookings
  if (user.role === 'customer') {
    filter.customer = user._id;
  } else if (user.role === 'caregiver') {
    filter.caregiverUser = user._id;
  } else if (user.role === 'admin') {
    // Admin operational queue filters
    if (query.status) {
      filter.status = query.status;
    }
    if (query.priority) {
      filter.priority = query.priority;
    }
    if (query.bookingId && mongoose.Types.ObjectId.isValid(query.bookingId)) {
      filter.booking = query.bookingId;
    }
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [incidents, total] = await Promise.all([
    SosIncident.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('customer', 'fullName email phone')
      .populate('caregiverUser', 'fullName email phone')
      .populate('assignedTo', 'fullName email')
      .populate('booking', 'serviceName status startDateTime endDateTime'),
    SosIncident.countDocuments(filter),
  ]);

  return {
    incidents,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Retrieve incident details and full audit timeline by identifier.
 */
export const getSosById = async (user, incidentId) => {
  if (!mongoose.Types.ObjectId.isValid(incidentId)) {
    const err = new Error('Invalid incident identifier');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const incident = await SosIncident.findById(incidentId)
    .populate('customer', 'fullName email phone')
    .populate('caregiverUser', 'fullName email phone')
    .populate('assignedTo', 'fullName email')
    .populate('booking', 'serviceName status startDateTime endDateTime location')
    .populate('timeline.by', 'fullName role');

  if (!incident) {
    const err = new Error('SOS incident not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  // Object-level authorization check
  const isCustomer = incident.customer._id.toString() === user._id.toString();
  const isCaregiver = incident.caregiverUser._id.toString() === user._id.toString();
  const isAdmin = user.role === 'admin';

  if (!isCustomer && !isCaregiver && !isAdmin) {
    const err = new Error('You are not authorized to view this SOS incident');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  return incident;
};

/**
 * Admin assigns an incident to an operations desk agent and transitions status.
 */
export const assignSos = async (user, incidentId, assignData) => {
  if (user.role !== 'admin') {
    const err = new Error('Only administrators can assign SOS incidents');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  if (!mongoose.Types.ObjectId.isValid(incidentId)) {
    const err = new Error('Invalid incident identifier');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const incident = await SosIncident.findById(incidentId);
  if (!incident) {
    const err = new Error('SOS incident not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  if (incident.status === 'Resolved' || incident.status === 'False Alarm') {
    const err = new Error(`Cannot reassign an incident that is already closed with status '${incident.status}'`);
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const assignedUser = await User.findById(assignData.assignedTo);
  if (!assignedUser) {
    const err = new Error('Assigned user not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  incident.assignedTo = assignedUser._id;
  incident.assignedAt = new Date();

  // Automatically transition Open incidents to Under Investigation
  if (incident.status === 'Open') {
    incident.status = 'Under Investigation';
  }

  // Append-only timeline entry
  incident.timeline.push({
    at: new Date(),
    action: 'Assigned to Operations Desk',
    by: user._id,
    byRole: 'admin',
    notes: assignData.notes || `Assigned to ${assignedUser.fullName}`,
  });

  await incident.save();

  return incident.populate([
    { path: 'assignedTo', select: 'fullName email' },
    { path: 'customer', select: 'fullName email phone' },
    { path: 'caregiverUser', select: 'fullName email phone' },
  ]);
};

/**
 * Append an operational note to the incident's audit timeline.
 */
export const addTimelineNote = async (user, incidentId, timelineData) => {
  if (!mongoose.Types.ObjectId.isValid(incidentId)) {
    const err = new Error('Invalid incident identifier');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const incident = await SosIncident.findById(incidentId);
  if (!incident) {
    const err = new Error('SOS incident not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  // Participant authorization
  const isCustomer = incident.customer.toString() === user._id.toString();
  const isCaregiver = incident.caregiverUser.toString() === user._id.toString();
  const isAdmin = user.role === 'admin';

  if (!isCustomer && !isCaregiver && !isAdmin) {
    const err = new Error('You are not authorized to update this SOS incident');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  if ((incident.status === 'Resolved' || incident.status === 'False Alarm') && !isAdmin) {
    const err = new Error('Cannot add notes to a closed SOS incident');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  incident.timeline.push({
    at: new Date(),
    action: timelineData.action || 'Operational Note Added',
    by: user._id,
    byRole: user.role,
    notes: timelineData.notes,
  });

  await incident.save();

  return incident;
};

/**
 * Admin resolves the incident or marks it as a false alarm.
 */
export const resolveSos = async (user, incidentId, resolveData) => {
  if (user.role !== 'admin') {
    const err = new Error('Only administrators can resolve SOS incidents');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  if (!mongoose.Types.ObjectId.isValid(incidentId)) {
    const err = new Error('Invalid incident identifier');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const incident = await SosIncident.findById(incidentId);
  if (!incident) {
    const err = new Error('SOS incident not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  if (incident.status === 'Resolved' || incident.status === 'False Alarm') {
    const err = new Error(`Incident is already closed with status '${incident.status}'`);
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  incident.status = resolveData.status;
  incident.resolution = {
    resolvedAt: new Date(),
    resolvedBy: user._id,
    resolutionNotes: resolveData.resolutionNotes,
    rootCause: resolveData.rootCause || null,
  };

  // Append-only timeline entry
  incident.timeline.push({
    at: new Date(),
    action: `Incident Closed as ${resolveData.status}`,
    by: user._id,
    byRole: 'admin',
    notes: resolveData.resolutionNotes,
  });

  await incident.save();

  return incident.populate([
    { path: 'resolution.resolvedBy', select: 'fullName email' },
    { path: 'assignedTo', select: 'fullName email' },
  ]);
};
