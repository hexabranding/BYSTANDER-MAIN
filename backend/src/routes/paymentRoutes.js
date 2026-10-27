import { Router } from 'express';
import * as paymentController from '../controllers/paymentController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Public key retrieval (for initializing Razorpay Checkout on frontend)
router.get('/key', paymentController.getPublicKey);

// Authenticated customer/admin payment flows
router.post('/create-order', authenticate, paymentController.createOrder);
router.post('/verify', authenticate, paymentController.verifyPayment);
router.post('/release-escrow', authenticate, paymentController.releaseEscrow);

export default router;
