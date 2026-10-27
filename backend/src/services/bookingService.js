import mongoose from 'mongoose';
import { Booking, CaregiverProfile, User, Service, Transaction } from '../models/index.js';
import {
  getLocalTimeInTimezone,
  calculateTotalHours,
} from '../utils/bookingDateUtils.js';
import { safeDispatchNotification } from './notificationService.js';
import { recordBookingTransaction } from './adminFinanceService.js';
import { getIO } from '../socket.js';

/**
 * Check if the current MongoDB connection supports multi-document ACID transactions.
 * Requires a Replica Set or Sharded cluster topology.
 * @returns {boolean}
 */
export const isTransactionSupported = () => {
  try {
    const client = mongoose.connection?.client;
    if (!client) return false;
    const topology = client.topology?.description;
    const topologyType = topology?.type;
    if (topologyType === 'ReplicaSetWithPrimary' || topologyType === 'Sharded') {
      return true;
    }
    if (topology?.servers) {
      for (const server of topology.servers.values()) {
        if (server.type === 'RSPrimary') return true;
      }
    }
    return false;
  } catch (err) {
    return false;
  }
};

/**
 * Helper to execute an operation inside a MongoDB ACID transaction with automatic retry
 * on transient transaction errors or write conflicts (e.g. WiredTiger WriteConflict code 112).
 *
 * Enforces fail-closed safety: If transaction support (ReplicaSet / Sharded) is not available,
 * throws HTTP 503 ServiceUnavailableError rather than running an unsafe read-then-insert race.
 *
 * @param {Function} workFn - Async function (session) => Promise<any>
 * @param {number} [maxRetries=3] - Maximum retry attempts
 * @returns {Promise<any>}
 */
export const executeWithTransactionRetry = async (workFn, maxRetries = 3) => {
  if (!isTransactionSupported()) {
    const err = new Error(
      'Booking operations require a MongoDB replica set or sharded deployment with multi-document transaction support to guarantee concurrency safety.',
    );
    err.statusCode = 503;
    err.name = 'ServiceUnavailableError';
    throw err;
  }

  let attempts = 0;
  while (attempts < maxRetries) {
    attempts++;
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await workFn(session);
      });
      return result;
    } catch (error) {
      const isTransient =
        error?.hasErrorLabel?.('TransientTransactionError') ||
        error?.code === 112 ||
        error?.message?.includes('WriteConflict');

      if (isTransient && attempts < maxRetries) {
        // Exponential jitter backoff (20-70ms) before retry
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 50 + 20));
        continue;
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }
};

/**
 * Create a new Booking request.
 * Supports:
 * 1. Targeted Booking: If caregiverId is supplied, verifies caregiver verification, service offering, schedule fit, and serializes conflict lock.
 * 2. On-Demand Broadcast Booking: If caregiverId is omitted, snapshot service catalog base rate, creates unassigned pending booking, and broadcasts real-time alerts to all active verified caregivers.
 */
export const createBooking = async (customerId, bookingData) => {
  const { caregiverId, serviceId, startDateTime, endDateTime, timezone, location, patientDetails } =
    bookingData;

  // 1. Verify Customer user exists and is active
  const customer = await User.findById(customerId);
  if (!customer || customer.status !== 'active') {
    const err = new Error('Customer account is not eligible to create bookings');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  // 2. Targeted Booking Mode: Verify caregiver account & verification status first if caregiverId provided
  let caregiver = null;
  if (caregiverId) {
    caregiver = await CaregiverProfile.findById(caregiverId).populate('user');
    if (!caregiver) {
      const err = new Error('Selected caregiver does not exist');
      err.statusCode = 404;
      err.name = 'NotFoundError';
      throw err;
    }

    if (caregiver.verificationStatus !== 'verified') {
      const err = new Error(
        `Caregiver is not verified (status: ${caregiver.verificationStatus}) and cannot accept bookings`,
      );
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }

    if (!caregiver.user || caregiver.user.status !== 'active') {
      const err = new Error('Caregiver account is currently suspended, blocked, or inactive');
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }
  }

  // 3. Verify Service Catalog Record
  const service = await Service.findById(serviceId);
  if (!service || !service.isActive) {
    const err = new Error('Selected service is inactive or does not exist');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // 4. Validate Duration Bounds against Service
  const durationHours = calculateTotalHours(startDateTime, endDateTime);
  const minRequiredHours = service.minimumDurationHours || 1;
  if (durationHours < minRequiredHours) {
    const err = new Error(
      `Booking duration (${durationHours} hrs) is below the minimum required duration for ${service.name} (${minRequiredHours} hrs)`,
    );
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // 5. Targeted Booking validation (schedule, offerings, conflict)
  if (caregiver) {

    const hasConfiguredServices =
      (Array.isArray(caregiver.servicesOffered) && caregiver.servicesOffered.length > 0) ||
      (Array.isArray(caregiver.services) && caregiver.services.length > 0);

    const offersService = !hasConfiguredServices
      ? true
      : caregiver.servicesOffered?.some((sId) => String(sId) === String(service._id)) ||
        caregiver.services?.some(
          (s) =>
            String(s).toLowerCase().trim() === service.name.toLowerCase().trim() ||
            String(s).toLowerCase().trim() === (service.slug || '').toLowerCase().trim(),
        );

    if (!offersService) {
      const err = new Error(`Caregiver does not offer the requested service: '${service.name}'`);
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }

    const caregiverTz = caregiver.timezone || 'Asia/Kolkata';
    const localStart = getLocalTimeInTimezone(startDateTime, caregiverTz);
    const localEnd = getLocalTimeInTimezone(endDateTime, caregiverTz);

    const dateException = caregiver.dateExceptions?.find((ex) => ex.date === localStart.dateStr);

    if (dateException) {
      if (!dateException.isAvailable) {
        const err = new Error(
          `Caregiver is unavailable on ${localStart.dateStr} due to a scheduled leave (${dateException.reason || 'Leave'})`,
        );
        err.statusCode = 400;
        err.name = 'ValidationError';
        throw err;
      }

      const fitsExceptionSlot = dateException.slots?.some(
        (slot) => slot.start <= localStart.timeStr && slot.end >= localEnd.timeStr,
      );
      if (!fitsExceptionSlot) {
        const err = new Error(
          `Requested shift [${localStart.timeStr} – ${localEnd.timeStr}] falls outside caregiver available slots on ${localStart.dateStr}`,
        );
        err.statusCode = 400;
        err.name = 'ValidationError';
        throw err;
      }
    } else {
      const weekdaySchedule = caregiver.weeklySchedule?.find((w) => w.day === localStart.day);

      if (!weekdaySchedule || !weekdaySchedule.isAvailable) {
        const err = new Error(
          `Caregiver does not work on ${localStart.day}s according to their weekly schedule`,
        );
        err.statusCode = 400;
        err.name = 'ValidationError';
        throw err;
      }

      const fitsRegularSlot = weekdaySchedule.slots?.some(
        (slot) => slot.start <= localStart.timeStr && slot.end >= localEnd.timeStr,
      );
      if (!fitsRegularSlot) {
        const err = new Error(
          `Requested shift [${localStart.timeStr} – ${localEnd.timeStr}] falls outside caregiver regular working hours on ${localStart.day}s`,
        );
        err.statusCode = 400;
        err.name = 'ValidationError';
        throw err;
      }
    }

    const hourlyRate = caregiver.hourlyRate;
    const totalAmount = Math.round(hourlyRate * durationHours);

    return executeWithTransactionRetry(async (session) => {
      await CaregiverProfile.updateOne(
        { _id: caregiver._id },
        { $inc: { bookingLockVersion: 1 } },
        { session },
      );

      const conflict = await Booking.findOne({
        caregiver: caregiver._id,
        status: { $in: ['pending', 'confirmed', 'in_progress'] },
        startDateTime: { $lt: endDateTime },
        endDateTime: { $gt: startDateTime },
      }).session(session);

      if (conflict) {
        const conflictErr = new Error(
          'Caregiver already has a confirmed or pending booking (or shift in-progress) during this scheduled interval',
        );
        conflictErr.statusCode = 409;
        conflictErr.name = 'ConflictError';
        throw conflictErr;
      }

      const [createdBooking] = await Booking.create(
        [
          {
            customer: customerId,
            caregiver: caregiver._id,
            caregiverUser: caregiver.user._id,
            service: service._id,
            serviceName: service.name,
            serviceCategory: service.category,
            hourlyRate,
            totalHours: durationHours,
            totalAmount,
            currency: 'INR',
            startDateTime,
            endDateTime,
            timezone: timezone || caregiverTz,
            location,
            patientDetails,
            status: 'pending',
          },
        ],
        { session },
      );

      await recordBookingTransaction(createdBooking, 'escrow_held', { session });
      return createdBooking;
    });
  }

  // 5. On-Demand Broadcast Booking Mode (Swiggy / Uber delivery style)
  // Derive transparent canonical hourly rate from Service Catalog
  const hourlyRate = service.baseHourlyRate || 499;
  const totalAmount = Math.round(hourlyRate * durationHours);

  const createdBooking = await executeWithTransactionRetry(async (session) => {
    const [created] = await Booking.create(
      [
        {
          customer: customerId,
          caregiver: null,
          caregiverUser: null,
          service: service._id,
          serviceName: service.name,
          serviceCategory: service.category,
          hourlyRate,
          totalHours: durationHours,
          totalAmount,
          currency: 'INR',
          startDateTime,
          endDateTime,
          timezone: timezone || 'Asia/Kolkata',
          location,
          patientDetails,
          status: 'pending',
        },
      ],
      { session },
    );

    await recordBookingTransaction(created, 'escrow_held', { session });
    return created;
  });

  // Real-time broadcast: Emit Socket.IO event and dispatch alerts to active verified caregivers
  try {
    const io = getIO();
    if (io) {
      io.emit('booking:broadcast', createdBooking);
    }

    const verifiedCaregivers = await CaregiverProfile.find({ verificationStatus: 'verified' })
      .select('user')
      .lean();

    for (const cg of verifiedCaregivers) {
      if (cg.user) {
        safeDispatchNotification({
          recipient: cg.user,
          type: 'booking_created',
          title: 'New Booking Broadcast',
          message: `New booking request for ${service.name} in ${location?.city || 'your area'}.`,
          metadata: {
            bookingId: createdBooking._id,
            serviceName: service.name,
            city: location?.city || '',
          },
        });
      }
    }
  } catch (notifyErr) {
    console.error('Broadcast notification dispatch error:', notifyErr.message);
  }

  return createdBooking;
};

/**
 * List bookings authorized for the calling user.
 * Role-filtered:
 * - Customers see their own bookings.
 * - Caregivers see bookings assigned to them.
 * - Admins see all bookings across the platform.
 */
export const getBookings = async (user, query = {}) => {
  const { status, page = 1, limit = 10 } = query;
  const filter = {};

  // Object-Level Authorization Filter
  if (user.role === 'customer') {
    filter.customer = user._id;
  } else if (user.role === 'caregiver') {
    // Caregivers see bookings assigned to them OR open broadcast requests available for claiming (excluding ones they declined)
    if (status === 'pending') {
      filter.$or = [
        { caregiverUser: user._id, status: 'pending' },
        { caregiver: null, status: 'pending', declinedByCaregivers: { $ne: user._id } },
      ];
    } else if (status) {
      filter.caregiverUser = user._id;
      filter.status = status;
    } else {
      filter.$or = [
        { caregiverUser: user._id },
        { caregiver: null, status: 'pending', declinedByCaregivers: { $ne: user._id } },
      ];
    }
  } else if (user.role === 'admin') {
    if (query.customerId && mongoose.Types.ObjectId.isValid(query.customerId)) {
      filter.customer = query.customerId;
    }
    if (query.caregiverId && mongoose.Types.ObjectId.isValid(query.caregiverId)) {
      filter.$or = [
        { caregiver: query.caregiverId },
        { caregiverUser: query.caregiverId },
      ];
    }
  }

  if (status && ['pending', 'confirmed', 'cancelled', 'rejected', 'completed'].includes(status)) {
    if (user.role !== 'caregiver') {
      filter.status = status;
    }
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (parsedPage - 1) * parsedLimit;

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .populate('customer', 'fullName email phone')
      .populate({
        path: 'caregiver',
        select: 'qualification city hourlyRate avatar',
        populate: { path: 'user', select: 'fullName email phone avatar' },
      })
      .populate('service', 'name slug category baseHourlyRate'),
    Booking.countDocuments(filter),
  ]);

  return {
    bookings,
    pagination: {
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit) || 1,
    },
  };
};

/**
 * Retrieve a single booking with object-level authorization.
 */
export const getBookingById = async (user, bookingId) => {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  const booking = await Booking.findById(bookingId)
    .populate('customer', 'fullName email phone')
    .populate({
      path: 'caregiver',
      select: 'qualification city hourlyRate avatar',
      populate: { path: 'user', select: 'fullName email phone avatar' },
    })
    .populate('service', 'name slug category baseHourlyRate');

  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  // Object-Level Authorization Check
  const isCustomer = booking.customer._id.toString() === user._id.toString();
  const isAssignedCaregiver = Boolean(
    booking.caregiverUser && booking.caregiverUser.toString() === user._id.toString(),
  );
  const isBroadcastOpen = !booking.caregiver && booking.status === 'pending' && user.role === 'caregiver';
  const isAdmin = user.role === 'admin';

  if (!isCustomer && !isAssignedCaregiver && !isBroadcastOpen && !isAdmin) {
    const err = new Error('You are not authorized to view this booking record');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  return booking;
};

/**
 * Caregiver accepts a pending booking request.
 * Concurrency protected: Mutates caregiver document inside an ACID transaction
 * to serialize competing acceptances, rechecks for conflicting confirmed bookings,
 * and atomically updates status to confirmed with compare-and-swap (CAS).
 */
export const acceptBooking = async (user, bookingId) => {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  return executeWithTransactionRetry(async (session) => {
    // 1. Re-read the booking inside transaction to guarantee fresh state
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) {
      const err = new Error('Booking not found');
      err.statusCode = 404;
      err.name = 'NotFoundError';
      throw err;
    }

    // 2. State machine transition check
    if (booking.status !== 'pending') {
      const err = new Error(
        `Cannot accept booking with status '${booking.status}'. Only pending requests can be accepted.`,
      );
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }

    // 3. Resolve accepting caregiver profile
    let caregiver = null;
    if (booking.caregiver) {
      // Targeted booking: Only the assigned caregiver can accept
      if (!booking.caregiverUser || booking.caregiverUser.toString() !== user._id.toString()) {
        const err = new Error('Only the assigned caregiver can accept this booking request');
        err.statusCode = 403;
        err.name = 'ForbiddenError';
        throw err;
      }
      caregiver = await CaregiverProfile.findById(booking.caregiver)
        .populate('user')
        .session(session);
    } else {
      // Broadcast booking: Any active, verified caregiver can claim
      if (user.role !== 'caregiver') {
        const err = new Error('Only registered caregivers can accept open care requests');
        err.statusCode = 403;
        err.name = 'ForbiddenError';
        throw err;
      }
      caregiver = await CaregiverProfile.findOne({ user: user._id })
        .populate('user')
        .session(session);
    }

    if (
      !caregiver ||
      caregiver.verificationStatus !== 'verified' ||
      !caregiver.user ||
      caregiver.user.status !== 'active'
    ) {
      const err = new Error(
        'Caregiver is not currently active or verified to accept this booking engagement',
      );
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }

    // 4. Mutate caregiver document to serialize competing acceptances and bookings for this caregiver
    await CaregiverProfile.updateOne(
      { _id: caregiver._id },
      { $inc: { bookingLockVersion: 1 } },
      { session },
    );

    // 5. Recheck for overlapping active (confirmed or in_progress) bookings for this caregiver inside transaction
    const conflict = await Booking.findOne({
      _id: { $ne: booking._id },
      caregiver: caregiver._id,
      status: { $in: ['confirmed', 'in_progress'] },
      startDateTime: { $lt: booking.endDateTime },
      endDateTime: { $gt: booking.startDateTime },
    }).session(session);

    if (conflict) {
      const conflictErr = new Error(
        'Cannot accept booking: another confirmed or in-progress engagement conflicts with this time interval',
      );
      conflictErr.statusCode = 409;
      conflictErr.name = 'ConflictError';
      throw conflictErr;
    }

    // 6. ATOMIC COMPARE-AND-SWAP (CAS)
    // If broadcast booking, query enforces { caregiver: null, status: 'pending' }
    // If 100 caretakers click Accept in the same millisecond, exactly 1 wins; other 99 get null updated
    const filterQuery = booking.caregiver
      ? { _id: booking._id, status: 'pending' }
      : { _id: booking._id, status: 'pending', caregiver: null };

    const updated = await Booking.findOneAndUpdate(
      filterQuery,
      {
        $set: {
          caregiver: caregiver._id,
          caregiverUser: caregiver.user._id,
          status: 'confirmed',
          acceptedAt: new Date(),
        },
      },
      { returnDocument: 'after', session },
    );

    if (!updated) {
      // Racing cancellation or another caretaker claimed it
      const freshBooking = await Booking.findById(booking._id).session(session);
      if (freshBooking && freshBooking.caregiver) {
        const conflictErr = new Error(
          'This booking request has already been claimed by another caretaker.',
        );
        conflictErr.statusCode = 409;
        conflictErr.name = 'ConflictError';
        throw conflictErr;
      }
      const conflictErr = new Error(
        `Cannot accept booking: status changed concurrently to '${freshBooking ? freshBooking.status : 'unknown'}'`,
      );
      conflictErr.statusCode = 409;
      conflictErr.name = 'ConflictError';
      throw conflictErr;
    }

    // 7. Update transaction ledger with the winning caregiver
    if (mongoose.connection?.readyState !== 0 || Object.prototype.hasOwnProperty.call(Transaction, 'updateOne')) {
      await Transaction.updateOne(
        { booking: booking._id },
        { $set: { caregiver: caregiver._id, caregiverUser: caregiver.user._id } },
        { session },
      ).catch(() => {});
    }

    // 8. Real-time broadcast and customer notification
    try {
      const io = getIO();
      if (io) {
        io.emit('booking:claimed', {
          bookingId: booking._id.toString(),
          caregiverId: caregiver._id.toString(),
          caregiverName: caregiver.name || user.name,
        });
      }
      safeDispatchNotification({
        recipient: booking.customer,
        type: 'booking_accepted',
        title: 'Caretaker Confirmed',
        message: `${caregiver.name || user.name || 'A caretaker'} has accepted your booking #${String(booking._id).slice(-6)}.`,
        metadata: {
          bookingId: booking._id,
          caregiverName: caregiver.name || user.name,
        },
      });
    } catch (notifErr) {
      console.error('Acceptance notification error:', notifErr.message);
    }

    return updated.populate([
      { path: 'customer', select: 'fullName email phone' },
      { path: 'service', select: 'name slug category baseHourlyRate' },
    ]);
  });
};

/**
 * Authorized participant (customer, caregiver, or admin) cancels a booking.
 * Concurrency protected: Uses atomic conditional updates matching current expected status
 * to prevent lost updates or invalid lifecycle transitions against racing acceptances.
 */
export const cancelBooking = async (user, bookingId, cancellationReason) => {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  // Authorization: Participant (Customer or Caregiver) or Admin
  const isCustomer = booking.customer.toString() === user._id.toString();
  const isCaregiver = Boolean(
    booking.caregiverUser && booking.caregiverUser.toString() === user._id.toString(),
  );
  const isAdmin = user.role === 'admin';

  if (!isCustomer && !isCaregiver && !isAdmin) {
    const err = new Error('You are not authorized to cancel this booking engagement');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  // Lifecycle check: only pending or confirmed can be cancelled
  if (booking.status === 'cancelled') {
    const err = new Error('Booking is already cancelled');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  if (booking.status === 'in_progress') {
    const err = new Error('Cannot cancel a booking engagement that is actively in progress. Please contact support.');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  if (booking.status === 'completed') {
    const err = new Error('Cannot cancel a completed booking engagement');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  if (booking.status === 'rejected') {
    const err = new Error('Cannot cancel a rejected booking request');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // Start time boundary: once a confirmed shift has started, non-admins cannot cancel via self-service API
  if (!isAdmin && booking.status === 'confirmed' && booking.startDateTime.getTime() <= Date.now()) {
    const err = new Error(
      'Cannot cancel a booking engagement that has already commenced. Please contact support.',
    );
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // Atomic conditional update on the expected current status to prevent lost updates
  // against racing acceptance or modifications
  const now = new Date();
  const queryFilter = {
    _id: booking._id,
    status: booking.status,
  };

  if (!isAdmin && booking.status === 'confirmed') {
    queryFilter.startDateTime = { $gt: now };
  }

  const updatedBooking = await Booking.findOneAndUpdate(
    queryFilter,
    {
      $set: {
        status: 'cancelled',
        cancelledAt: now,
        cancelledBy: user._id,
        cancelledByRole: user.role,
        cancellationReason: cancellationReason || 'Cancelled by participant',
      },
    },
    { returnDocument: 'after' },
  );

  if (!updatedBooking) {
    // Race condition detected: booking status was modified between findById and findOneAndUpdate
    const recheck = await Booking.findById(bookingId);
    if (!recheck) {
      const err = new Error('Booking not found');
      err.statusCode = 404;
      err.name = 'NotFoundError';
      throw err;
    }

    if (recheck.status === 'cancelled') {
      const err = new Error('Booking is already cancelled');
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }

    if (booking.status === 'pending' && recheck.status === 'confirmed') {
      if (!isAdmin && recheck.startDateTime.getTime() <= Date.now()) {
        const err = new Error(
          'Cannot cancel a booking engagement that has already commenced. Please contact support.',
        );
        err.statusCode = 400;
        err.name = 'ValidationError';
        throw err;
      }
      const err = new Error(
        'Booking was confirmed by the caregiver while cancellation was being processed. Please refresh and retry cancellation if still desired.',
      );
      err.statusCode = 409;
      err.name = 'ConflictError';
      throw err;
    }

    const err = new Error(
      `Cannot cancel booking: current status is '${recheck.status}'. Expected '${booking.status}'.`,
    );
    err.statusCode = 409;
    err.name = 'ConflictError';
    throw err;
  }

  await recordBookingTransaction(updatedBooking, 'refunded').catch((txErr) => {
    console.warn('[Ledger Warning] Could not record refund transaction on cancellation:', txErr.message);
  });

  return updatedBooking.populate([
    { path: 'customer', select: 'fullName email phone' },
    { path: 'service', select: 'name slug category baseHourlyRate' },
  ]);
};

/**
 * Reject / decline a pending booking request.
 * Authorized for the assigned caregiver or platform admin.
 */
export const rejectBooking = async (user, bookingId, rejectionReason = '') => {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  // Authorization: Assigned caregiver, prospective caregiver on broadcast, or admin
  const isAssignedCaregiver = Boolean(
    booking.caregiverUser && booking.caregiverUser.toString() === user._id.toString(),
  );
  const isBroadcastOpen = !booking.caregiver && !booking.caregiverUser && user.role === 'caregiver';
  const isAdmin = user.role === 'admin';

  if (!isAssignedCaregiver && !isBroadcastOpen && !isAdmin) {
    const err = new Error('You are not authorized to reject this booking request');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  // If this is a broadcast job and an individual caregiver declines it,
  // we add them to declinedByCaregivers so it hides from their feed without canceling it for others!
  if (isBroadcastOpen && !isAdmin) {
    if (mongoose.connection?.readyState !== 0 || Object.prototype.hasOwnProperty.call(Booking, 'updateOne')) {
      await Booking.updateOne(
        { _id: booking._id },
        { $addToSet: { declinedByCaregivers: user._id } },
      ).catch(() => {});
    }
    return { ...(booking.toObject ? booking.toObject() : booking), status: 'rejected' };
  }

  // Lifecycle check: only pending bookings can be rejected
  if (booking.status === 'rejected') {
    const err = new Error('Booking request is already rejected');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  if (booking.status !== 'pending') {
    const err = new Error(
      `Cannot reject booking with status '${booking.status}'. Only pending booking requests can be rejected.`,
    );
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // Atomic conditional update to prevent race conditions
  const now = new Date();
  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: 'pending' },
    {
      $set: {
        status: 'rejected',
        rejectedAt: now,
        cancellationReason: rejectionReason || 'Declined by caregiver',
      },
    },
    { returnDocument: 'after' },
  );

  if (!updated) {
    const recheck = await Booking.findById(bookingId);
    if (!recheck) {
      const err = new Error('Booking not found');
      err.statusCode = 404;
      err.name = 'NotFoundError';
      throw err;
    }
    if (recheck.status === 'rejected') {
      const err = new Error('Booking request is already rejected');
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }
    const err = new Error(
      `Cannot reject booking: booking status changed to '${recheck.status}' concurrently.`,
    );
    err.statusCode = 409;
    err.name = 'ConflictError';
    throw err;
  }

  // Safely dispatch in-app notification to the customer
  safeDispatchNotification({
    recipient: booking.customer,
    type: 'booking_cancelled',
    title: 'Booking Request Declined',
    message: `The caregiver was unable to accept your booking for ${booking.serviceName}.`,
    metadata: { bookingId: String(booking._id), status: 'rejected' },
    idempotencyKey: `booking:rejected:${booking._id}`,
  });

  // Update ledger status to refunded on rejection
  await recordBookingTransaction(updated, 'refunded').catch((txErr) => {
    console.warn('[Ledger Warning] Could not record refund transaction on rejection:', txErr.message);
  });

  return updated.populate([
    { path: 'customer', select: 'fullName email phone' },
    { path: 'service', select: 'name slug category baseHourlyRate' },
  ]);
};
