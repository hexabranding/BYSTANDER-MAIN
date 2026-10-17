import mongoose from 'mongoose';
import { Booking } from '../models/index.js';
import { generateNumericOtp, hashOtp, verifyOtpHash } from '../utils/otpUtils.js';

const OTP_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const OTP_COOLDOWN_MS = 60 * 1000;    // 60 seconds

/**
 * Customer requests a 6-digit Check-In OTP for a confirmed booking.
 * Returned in plaintext ONLY to the authenticated customer.
 */
export const requestCheckInOtp = async (user, bookingId) => {
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

  // Object-Level Authorization: Only the Customer or Admin can generate / view the OTP
  const isCustomer = booking.customer.toString() === user._id.toString();
  const isAdmin = user.role === 'admin';

  if (!isCustomer && !isAdmin) {
    const err = new Error('Only the customer who booked this service can request the check-in OTP');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  // Precondition: Booking must be in 'confirmed' status
  if (booking.status !== 'confirmed') {
    const err = new Error(
      `Cannot request check-in OTP for booking with status '${booking.status}'. Booking must be confirmed by the caregiver first.`,
    );
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // Cooldown rate limiting: 60 seconds between successive OTP generation requests
  const now = Date.now();
  if (booking.checkInOtp?.lastRequestedAt) {
    const elapsed = now - new Date(booking.checkInOtp.lastRequestedAt).getTime();
    if (elapsed < OTP_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000);
      const err = new Error(`Please wait ${waitSeconds} second(s) before requesting a new check-in OTP.`);
      err.statusCode = 429;
      err.name = 'TooManyRequestsError';
      throw err;
    }
  }

  // Generate cryptographically secure 6-digit OTP
  const plaintextOtp = generateNumericOtp();
  const salt = `${booking._id}:${booking.customer}`;
  const otpHash = hashOtp(plaintextOtp, salt);
  const expiresAt = new Date(now + OTP_EXPIRY_MS);

  // Store hashed OTP and reset attempts
  booking.checkInOtp = {
    otpHash,
    expiresAt,
    attempts: 0,
    maxAttempts: 5,
    consumedAt: null,
    lastRequestedAt: new Date(now),
  };
  await booking.save();

  return {
    message: 'Check-in OTP generated successfully. Share this code with your caregiver upon arrival.',
    otp: plaintextOtp,
    expiresAt,
    maxAttempts: 5,
  };
};

/**
 * Assigned Caregiver submits the customer's Check-In OTP to clock in.
 * Transitions booking from 'confirmed' to 'in_progress'.
 */
export const verifyCheckIn = async (user, bookingId, checkInData = {}) => {
  const { otp, selfieUrl, location, notes } = checkInData;

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  // Read booking explicitly requesting the hidden otpHash field
  const booking = await Booking.findById(bookingId).select('+checkInOtp.otpHash');
  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  // Object-Level Authorization: Only the assigned Caregiver or Admin can verify check-in
  const isCaregiver = booking.caregiverUser.toString() === user._id.toString();
  const isAdmin = user.role === 'admin';

  if (!isCaregiver && !isAdmin) {
    const err = new Error('Only the assigned caregiver can verify arrival and perform check-in');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  // Precondition: Booking must be in 'confirmed' status
  if (booking.status !== 'confirmed') {
    const err = new Error(
      `Cannot perform check-in on booking with status '${booking.status}'. Booking must be confirmed.`,
    );
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // Verify OTP record exists and is not already consumed
  if (!booking.checkInOtp?.otpHash || booking.checkInOtp.consumedAt) {
    const err = new Error(
      'No active check-in OTP found or OTP has already been used. Please ask the customer to generate a check-in code.',
    );
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // Verify expiration
  if (new Date(booking.checkInOtp.expiresAt).getTime() < Date.now()) {
    const err = new Error('Check-in OTP has expired. Please ask the customer to generate a fresh OTP.');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // Verify attempt bounds (max 5 failed attempts) in memory first
  const maxAttempts = booking.checkInOtp?.maxAttempts || 5;
  if (booking.checkInOtp?.attempts >= maxAttempts) {
    const err = new Error(
      'Maximum verification attempts exceeded for this OTP. Please ask the customer to generate a new check-in OTP.',
    );
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // Verify OTP using constant-time comparison
  const salt = `${booking._id}:${booking.customer}`;
  const isValid = verifyOtpHash(otp, booking.checkInOtp.otpHash, salt);

  if (!isValid) {
    // Atomically increment failed attempts ONLY IF attempts < maxAttempts AND not consumed
    const failedBookingUpdate = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        'checkInOtp.attempts': { $lt: maxAttempts },
        'checkInOtp.consumedAt': null,
      },
      {
        $inc: { 'checkInOtp.attempts': 1 },
      },
      { returnDocument: 'after' },
    );

    if (!failedBookingUpdate) {
      // Either attempts was already >= maxAttempts or OTP was consumed
      const freshBooking = await Booking.findById(booking._id);
      if (freshBooking && freshBooking.checkInOtp?.attempts >= maxAttempts) {
        const err = new Error(
          'Maximum verification attempts exceeded for this OTP. Please ask the customer to generate a new check-in OTP.',
        );
        err.statusCode = 400;
        err.name = 'ValidationError';
        throw err;
      }
      const err = new Error(
        'No active check-in OTP found or OTP has already been used. Please ask the customer to generate a check-in code.',
      );
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }

    const currentAttempts = failedBookingUpdate.checkInOtp.attempts;
    const remaining = Math.max(0, maxAttempts - currentAttempts);

    const err = new Error(
      remaining > 0
        ? `Invalid check-in OTP. ${remaining} attempt(s) remaining.`
        : 'Invalid check-in OTP. Maximum verification attempts reached. Customer must generate a new OTP.',
    );
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // Atomically transition status to 'in_progress' and consume OTP
  // Must condition on attempts < maxAttempts to prevent transitioning if max attempts was reached concurrently
  const now = new Date();
  const updatedBooking = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      status: 'confirmed',
      'checkInOtp.consumedAt': null,
      'checkInOtp.attempts': { $lt: maxAttempts },
    },
    {
      $set: {
        status: 'in_progress',
        'checkInOtp.consumedAt': now,
        'checkIn.at': now,
        'checkIn.verifiedBy': user._id,
        'checkIn.selfieUrl': selfieUrl || null,
        'checkIn.location': location || null,
        'checkIn.notes': notes || null,
      },
    },
    { returnDocument: 'after' },
  );

  if (!updatedBooking) {
    const freshBooking = await Booking.findById(booking._id);
    if (freshBooking && freshBooking.checkInOtp?.attempts >= maxAttempts) {
      const err = new Error(
        'Maximum verification attempts exceeded for this OTP. Please ask the customer to generate a new check-in OTP.',
      );
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }
    const err = new Error('Check-in transition failed due to a concurrent status update. Please refresh.');
    err.statusCode = 409;
    err.name = 'ConflictError';
    throw err;
  }

  return updatedBooking.populate([
    { path: 'customer', select: 'fullName email phone' },
    { path: 'service', select: 'name slug category baseHourlyRate' },
  ]);
};

/**
 * Customer requests a 6-digit Check-Out OTP for an in-progress booking.
 * Returned in plaintext ONLY to the authenticated customer.
 */
export const requestCheckOutOtp = async (user, bookingId) => {
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

  // Object-Level Authorization: Only the Customer or Admin can generate / view the OTP
  const isCustomer = booking.customer.toString() === user._id.toString();
  const isAdmin = user.role === 'admin';

  if (!isCustomer && !isAdmin) {
    const err = new Error('Only the customer who booked this service can request the check-out OTP');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  // Precondition: Booking must be in 'in_progress' status
  if (booking.status !== 'in_progress') {
    const err = new Error(
      `Cannot request check-out OTP for booking with status '${booking.status}'. Shift must be actively in progress.`,
    );
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // Cooldown rate limiting: 60 seconds
  const now = Date.now();
  if (booking.checkOutOtp?.lastRequestedAt) {
    const elapsed = now - new Date(booking.checkOutOtp.lastRequestedAt).getTime();
    if (elapsed < OTP_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000);
      const err = new Error(`Please wait ${waitSeconds} second(s) before requesting a new check-out OTP.`);
      err.statusCode = 429;
      err.name = 'TooManyRequestsError';
      throw err;
    }
  }

  const plaintextOtp = generateNumericOtp();
  const salt = `${booking._id}:${booking.customer}`;
  const otpHash = hashOtp(plaintextOtp, salt);
  const expiresAt = new Date(now + OTP_EXPIRY_MS);

  booking.checkOutOtp = {
    otpHash,
    expiresAt,
    attempts: 0,
    maxAttempts: 5,
    consumedAt: null,
    lastRequestedAt: new Date(now),
  };
  await booking.save();

  return {
    message: 'Check-out OTP generated successfully. Share this code with your caregiver at shift completion.',
    otp: plaintextOtp,
    expiresAt,
    maxAttempts: 5,
  };
};

/**
 * Assigned Caregiver submits the customer's Check-Out OTP to clock out.
 * Transitions booking from 'in_progress' to 'completed'.
 */
export const verifyCheckOut = async (user, bookingId, checkOutData = {}) => {
  const { otp, selfieUrl, location, notes } = checkOutData;

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  const booking = await Booking.findById(bookingId).select('+checkOutOtp.otpHash');
  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  // Object-Level Authorization: Only the assigned Caregiver or Admin can verify check-out
  const isCaregiver = booking.caregiverUser.toString() === user._id.toString();
  const isAdmin = user.role === 'admin';

  if (!isCaregiver && !isAdmin) {
    const err = new Error('Only the assigned caregiver can verify shift completion and check out');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  // Precondition: Booking must be in 'in_progress' status
  if (booking.status !== 'in_progress') {
    const err = new Error(
      `Cannot perform check-out on booking with status '${booking.status}'. Shift must be in progress.`,
    );
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  if (!booking.checkOutOtp?.otpHash || booking.checkOutOtp.consumedAt) {
    const err = new Error(
      'No active check-out OTP found or OTP has already been used. Please ask the customer to generate a check-out code.',
    );
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  if (new Date(booking.checkOutOtp.expiresAt).getTime() < Date.now()) {
    const err = new Error('Check-out OTP has expired. Please ask the customer to generate a fresh OTP.');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const maxAttempts = booking.checkOutOtp?.maxAttempts || 5;
  if (booking.checkOutOtp?.attempts >= maxAttempts) {
    const err = new Error(
      'Maximum verification attempts exceeded for this OTP. Please ask the customer to generate a new check-out OTP.',
    );
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const salt = `${booking._id}:${booking.customer}`;
  const isValid = verifyOtpHash(otp, booking.checkOutOtp.otpHash, salt);

  if (!isValid) {
    // Atomically increment failed attempts ONLY IF attempts < maxAttempts AND not consumed
    const failedBookingUpdate = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        'checkOutOtp.attempts': { $lt: maxAttempts },
        'checkOutOtp.consumedAt': null,
      },
      {
        $inc: { 'checkOutOtp.attempts': 1 },
      },
      { returnDocument: 'after' },
    );

    if (!failedBookingUpdate) {
      // Either attempts was already >= maxAttempts or OTP was consumed
      const freshBooking = await Booking.findById(booking._id);
      if (freshBooking && freshBooking.checkOutOtp?.attempts >= maxAttempts) {
        const err = new Error(
          'Maximum verification attempts exceeded for this OTP. Please ask the customer to generate a new check-out OTP.',
        );
        err.statusCode = 400;
        err.name = 'ValidationError';
        throw err;
      }
      const err = new Error(
        'No active check-out OTP found or OTP has already been used. Please ask the customer to generate a check-out code.',
      );
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }

    const currentAttempts = failedBookingUpdate.checkOutOtp.attempts;
    const remaining = Math.max(0, maxAttempts - currentAttempts);

    const err = new Error(
      remaining > 0
        ? `Invalid check-out OTP. ${remaining} attempt(s) remaining.`
        : 'Invalid check-out OTP. Maximum verification attempts reached. Customer must generate a new OTP.',
    );
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // Atomically transition status to 'completed' and consume OTP
  // Must condition on attempts < maxAttempts to prevent transitioning if max attempts was reached concurrently
  const now = new Date();
  const updatedBooking = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      status: 'in_progress',
      'checkOutOtp.consumedAt': null,
      'checkOutOtp.attempts': { $lt: maxAttempts },
    },
    {
      $set: {
        status: 'completed',
        'checkOutOtp.consumedAt': now,
        'checkOut.at': now,
        'checkOut.verifiedBy': user._id,
        'checkOut.selfieUrl': selfieUrl || null,
        'checkOut.location': location || null,
        'checkOut.notes': notes || null,
      },
    },
    { returnDocument: 'after' },
  );

  if (!updatedBooking) {
    const freshBooking = await Booking.findById(booking._id);
    if (freshBooking && freshBooking.checkOutOtp?.attempts >= maxAttempts) {
      const err = new Error(
        'Maximum verification attempts exceeded for this OTP. Please ask the customer to generate a new check-out OTP.',
      );
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }
    const err = new Error('Check-out transition failed due to a concurrent status update. Please refresh.');
    err.statusCode = 409;
    err.name = 'ConflictError';
    throw err;
  }

  return updatedBooking.populate([
    { path: 'customer', select: 'fullName email phone' },
    { path: 'service', select: 'name slug category baseHourlyRate' },
  ]);
};
