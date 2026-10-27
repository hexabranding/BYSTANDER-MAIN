import mongoose from 'mongoose';
import { Booking, Transaction, User } from '../models/index.js';
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  initiateRazorpayRefund,
  getPublicRazorpayKey,
} from '../utils/paymentGateway.js';
import { recordBookingTransaction } from '../services/adminFinanceService.js';
import { safeDispatchNotification } from '../services/notificationService.js';

/**
 * GET /api/payments/key
 * Returns public Razorpay key ID for client-side checkout modal
 */
export const getPublicKey = (req, res) => {
  return res.status(200).json({
    success: true,
    keyId: getPublicRazorpayKey(),
  });
};

/**
 * POST /api/payments/create-order
 * Initiates Razorpay test order for a booking engagement
 */
export const createOrder = async (req, res, next) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      const err = new Error('A valid booking identifier is required');
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }

    const booking = await Booking.findById(bookingId).populate('service', 'name baseHourlyRate');
    if (!booking) {
      const err = new Error('Booking engagement not found');
      err.statusCode = 404;
      err.name = 'NotFoundError';
      throw err;
    }

    // Authorization: only the booking's customer or Admin can create a payment order
    const isCustomer = String(booking.customer) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    if (!isCustomer && !isAdmin) {
      const err = new Error('You are not authorized to initiate payment for this booking');
      err.statusCode = 403;
      err.name = 'ForbiddenError';
      throw err;
    }

    if (booking.status === 'cancelled' || booking.status === 'rejected') {
      const err = new Error(`Cannot initiate payment for a ${booking.status} booking`);
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }

    if (booking.paymentStatus === 'escrow_held' || booking.paymentStatus === 'released') {
      return res.status(200).json({
        success: true,
        alreadyPaid: true,
        message: 'Payment for this booking is already secured in escrow',
        booking,
      });
    }

    const receipt = `BK-${String(booking._id).slice(-8).toUpperCase()}`;
    const order = await createRazorpayOrder({
      amount: booking.totalAmount,
      currency: booking.currency || 'INR',
      receipt,
      notes: {
        bookingId: String(booking._id),
        customerId: String(booking.customer),
        serviceName: booking.serviceName,
      },
    });

    booking.gatewayOrderId = order.id;
    booking.paymentStatus = 'pending';
    await booking.save();

    return res.status(200).json({
      success: true,
      order,
      booking: {
        id: booking._id,
        ref: receipt,
        totalAmount: booking.totalAmount,
        currency: booking.currency || 'INR',
        serviceName: booking.serviceName,
      },
      customer: {
        name: req.user.fullName || req.user.name || 'Customer',
        email: req.user.email,
        phone: req.user.phone || '',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments/verify
 * Cryptographically verifies Razorpay payment signature and locks funds in escrow
 */
export const verifyPayment = async (req, res, next) => {
  try {
    const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      const err = new Error('A valid booking identifier is required');
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }

    if (!razorpay_order_id || !razorpay_payment_id) {
      const err = new Error('Missing Razorpay payment verification parameters');
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }

    const isValid = verifyRazorpaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature || '',
    });

    if (!isValid) {
      const err = new Error('Invalid Razorpay cryptographic payment signature');
      err.statusCode = 400;
      err.name = 'PaymentVerificationError';
      throw err;
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      const err = new Error('Booking engagement not found');
      err.statusCode = 404;
      err.name = 'NotFoundError';
      throw err;
    }

    // Update booking payment tracking
    booking.paymentStatus = 'escrow_held';
    booking.gatewayOrderId = razorpay_order_id;
    booking.gatewayPaymentId = razorpay_payment_id;
    booking.paidAt = new Date();
    await booking.save();

    // Record or update financial ledger transaction with Razorpay metadata
    const tx = await recordBookingTransaction(booking, 'escrow_held');
    if (tx) {
      tx.gateway = 'razorpay';
      tx.gatewayOrderId = razorpay_order_id;
      tx.gatewayPaymentId = razorpay_payment_id;
      tx.gatewaySignature = razorpay_signature;
      tx.paymentMethod = 'Razorpay Test (UPI / Card)';
      tx.isSimulated = false;
      await tx.save();
    }

    // Dispatch safe in-app notifications
    safeDispatchNotification({
      recipient: booking.customer,
      type: 'payment_received',
      title: '💳 Payment Secured in Escrow',
      message: `Your payment of ₹${booking.totalAmount} is securely held in escrow for booking #${String(booking._id).slice(-6)}.`,
      metadata: { bookingId: booking._id, paymentId: razorpay_payment_id },
      idempotencyKey: `pay:escrow:${booking._id}:${razorpay_payment_id}`,
    });

    return res.status(200).json({
      success: true,
      message: 'Payment verified and secured in escrow',
      booking,
      transaction: tx,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments/release-escrow
 * Releases escrow funds upon confirmed shift completion
 */
export const releaseEscrow = async (req, res, next) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      const err = new Error('A valid booking identifier is required');
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      const err = new Error('Booking engagement not found');
      err.statusCode = 404;
      err.name = 'NotFoundError';
      throw err;
    }

    // Only Customer or Admin can release escrow
    const isCustomer = String(booking.customer) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    if (!isCustomer && !isAdmin) {
      const err = new Error('You are not authorized to release escrow for this booking');
      err.statusCode = 403;
      err.name = 'ForbiddenError';
      throw err;
    }

    booking.paymentStatus = 'released';
    await booking.save();

    const tx = await recordBookingTransaction(booking, 'released');

    return res.status(200).json({
      success: true,
      message: 'Escrow payment released to caretaker balance',
      booking,
      transaction: tx,
    });
  } catch (error) {
    next(error);
  }
};
