import * as bookingService from '../services/bookingService.js';
import * as otpService from '../services/otpService.js';

/**
 * POST /api/bookings
 * Authenticated customer creates a new booking request.
 */
export const createBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.createBooking(req.user._id, req.bookingData);

    res.status(201).json({
      success: true,
      message: 'Booking request created successfully',
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/bookings
 * Authenticated user lists bookings with object-level authorization and pagination.
 */
export const getBookings = async (req, res, next) => {
  try {
    const result = await bookingService.getBookings(req.user, req.query);

    res.status(200).json({
      success: true,
      data: result.bookings,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/bookings/:id
 * Authorized participant or admin retrieves a booking record.
 */
export const getBookingById = async (req, res, next) => {
  try {
    const booking = await bookingService.getBookingById(req.user, req.params.id);

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/bookings/:id/accept
 * Assigned caregiver accepts a pending booking request.
 */
export const acceptBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.acceptBooking(req.user, req.params.id);

    res.status(200).json({
      success: true,
      message: 'Booking request accepted successfully',
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/bookings/:id/reject
 * Assigned caregiver or admin rejects/declines a pending booking request.
 */
export const rejectBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.rejectBooking(
      req.user,
      req.params.id,
      req.rejectionReason,
    );

    res.status(200).json({
      success: true,
      message: 'Booking request rejected successfully',
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/bookings/:id/cancel
 * Authorized participant or admin cancels a booking engagement.
 */
export const cancelBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.cancelBooking(
      req.user,
      req.params.id,
      req.cancellationReason,
    );

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/bookings/:id/checkin/otp
 * Customer generates 6-digit Check-In OTP.
 */
export const requestCheckInOtp = async (req, res, next) => {
  try {
    const result = await otpService.requestCheckInOtp(req.user, req.params.id);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/bookings/:id/checkin/verify
 * Caregiver submits Check-In OTP to transition booking to 'in_progress'.
 */
export const verifyCheckIn = async (req, res, next) => {
  try {
    const booking = await otpService.verifyCheckIn(req.user, req.params.id, req.otpData);

    res.status(200).json({
      success: true,
      message: 'Check-in verified successfully. Shift is now in progress.',
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/bookings/:id/checkout/otp
 * Customer generates 6-digit Check-Out OTP.
 */
export const requestCheckOutOtp = async (req, res, next) => {
  try {
    const result = await otpService.requestCheckOutOtp(req.user, req.params.id);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/bookings/:id/checkout/verify
 * Caregiver submits Check-Out OTP to transition booking to 'completed'.
 */
export const verifyCheckOut = async (req, res, next) => {
  try {
    const booking = await otpService.verifyCheckOut(req.user, req.params.id, req.otpData);

    res.status(200).json({
      success: true,
      message: 'Check-out verified successfully. Shift is marked completed.',
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};
