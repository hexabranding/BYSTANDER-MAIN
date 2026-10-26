import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { validateCreateReview, validateReplyReview } from '../middleware/validateReview.js';
import { reviewController } from '../controllers/reviewController.js';

const router = express.Router();

/**
 * @route   POST /api/reviews
 * @desc    Submit a review for a completed booking engagement (Customer or Caregiver)
 * @access  Private (Participants of booking)
 */
router.post('/', authenticate, validateCreateReview, reviewController.createReview);

/**
 * @route   GET /api/reviews/my
 * @desc    Retrieve reviews submitted by or received by the authenticated user
 * @access  Private (Customer or Caregiver)
 */
router.get('/my', authenticate, reviewController.getMyReviews);

/**
 * @route   GET /api/reviews/caregiver/:caregiverId
 * @desc    Retrieve public reviews for a caregiver profile
 * @access  Public
 */
router.get('/caregiver/:caregiverId', reviewController.getCaregiverReviews);

/**
 * @route   GET /api/reviews/customer/:customerId
 * @desc    Retrieve reviews left by caregivers for a customer
 * @access  Public
 */
router.get('/customer/:customerId', reviewController.getCustomerReviews);

/**
 * @route   POST /api/reviews/:id/reply
 * @desc    Caregiver replies to a customer review
 * @access  Private (Caregiver participant or Admin)
 */
router.post('/:id/reply', authenticate, validateReplyReview, reviewController.addCaregiverReply);

export default router;
