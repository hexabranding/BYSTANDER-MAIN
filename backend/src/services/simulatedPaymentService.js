import mongoose from 'mongoose';
import { Booking, SimulatedPayment } from '../models/index.js';
import { recordBookingTransaction } from './adminFinanceService.js';

/**
 * Check if payment simulation is permitted in the current runtime environment.
 * Strictly forbidden in production.
 */
export const assertSimulationAllowed = () => {
  if (process.env.NODE_ENV === 'production') {
    const err = new Error('Payment simulation is strictly forbidden in production environments.');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  const isTest = process.env.NODE_ENV === 'test';
  const isSimEnabled = process.env.ENABLE_PAYMENT_SIMULATION === 'true';

  if (!isTest && !isSimEnabled) {
    const err = new Error(
      'Payment simulation is disabled. Set ENABLE_PAYMENT_SIMULATION=true in development to enable simulated test payments.',
    );
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }
};

/**
 * Record a simulated payment for end-to-end integration testing.
 * Separate state from Booking model; never represents real monetary funds.
 */
export const simulatePayment = async (user, bookingId, simulationData = {}) => {
  assertSimulationAllowed();

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

  // Authorization: Only participating customer or Admin can simulate payment
  const isCustomer = booking.customer.toString() === user._id.toString();
  const isAdmin = user.role === 'admin';

  if (!isCustomer && !isAdmin) {
    const err = new Error('You are not authorized to simulate payment for this booking');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  // Lifecycle check: cannot pay for cancelled or rejected bookings
  if (booking.status === 'cancelled' || booking.status === 'rejected') {
    const err = new Error(`Cannot simulate payment on a ${booking.status} booking`);
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const requestedStatus = simulationData.status || 'SIMULATED_ESCROW_HELD';

  // Upsert simulated payment record in separate collection
  const simulatedRecord = await SimulatedPayment.findOneAndUpdate(
    { booking: booking._id },
    {
      $set: {
        customer: booking.customer,
        amount: booking.totalAmount,
        currency: booking.currency || 'INR',
        status: requestedStatus,
        simulatedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const ledgerStatusMap = {
    SIMULATED_ESCROW_PENDING: 'escrow_held',
    SIMULATED_ESCROW_HELD: 'escrow_held',
    SIMULATED_RELEASED_TO_CAREGIVER: 'released',
    SIMULATED_REFUNDED: 'refunded',
  };
  const targetLedgerStatus = ledgerStatusMap[requestedStatus] || 'escrow_held';
  await recordBookingTransaction(booking, targetLedgerStatus).catch((txErr) => {
    console.warn('[Ledger Warning] Could not record booking transaction from simulated payment:', txErr.message);
  });

  return {
    success: true,
    message: 'TEST-ONLY SIMULATED PAYMENT: No real monetary funds, escrow, or payouts executed.',
    simulatedPayment: simulatedRecord,
  };
};

/**
 * Retrieve simulated payment status for a booking.
 */
export const getSimulatedPayment = async (user, bookingId) => {
  assertSimulationAllowed();

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

  const isCustomer = booking.customer.toString() === user._id.toString();
  const isCaregiver = booking.caregiverUser.toString() === user._id.toString();
  const isAdmin = user.role === 'admin';

  if (!isCustomer && !isCaregiver && !isAdmin) {
    const err = new Error('You are not authorized to view simulated payment details for this booking');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  const simulatedRecord = await SimulatedPayment.findOne({ booking: booking._id });
  return {
    simulatedPayment: simulatedRecord || null,
  };
};
