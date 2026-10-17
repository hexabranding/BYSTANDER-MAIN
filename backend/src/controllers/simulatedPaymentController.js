import * as simulatedPaymentService from '../services/simulatedPaymentService.js';

/**
 * POST /api/test/payments/:bookingId/simulate
 * Record a simulated payment event for development & automated testing.
 * Gated strictly to non-production environments.
 */
export const simulatePayment = async (req, res, next) => {
  try {
    const result = await simulatedPaymentService.simulatePayment(
      req.user,
      req.params.bookingId,
      req.body,
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/test/payments/:bookingId
 * Query simulated payment status for a booking.
 */
export const getSimulatedPayment = async (req, res, next) => {
  try {
    const result = await simulatedPaymentService.getSimulatedPayment(
      req.user,
      req.params.bookingId,
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
