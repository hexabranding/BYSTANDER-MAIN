import { Router } from 'express';
import * as simulatedPaymentController from '../controllers/simulatedPaymentController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Simulated payment routes require authentication
router.use(authenticate);

// 1. Simulate payment event (held in escrow, released, etc.)
router.post('/:bookingId/simulate', simulatedPaymentController.simulatePayment);

// 2. Retrieve simulated payment record
router.get('/:bookingId', simulatedPaymentController.getSimulatedPayment);

export default router;
