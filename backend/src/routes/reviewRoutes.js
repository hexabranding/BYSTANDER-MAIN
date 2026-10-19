import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { validateCreateReview, validateReplyReview } from '../middleware/validateReview.js';
import { reviewController } from '../controllers/reviewController.js';

const router = express.Router();

/**
 * @route   POST /api/reviews
 * @desc    Submit a review for a completed booking engagement
 * @access  Private (Customer only)
 */
router.post('/', authenticate, validateCreateReview, reviewController.createReview);

/**
 * @route   GET /api/reviews/caregiver/:caregiverId
 * @desc    Retrieve public reviews for a caregiver profile
 * @access  Public
 */
router.get('/caregiver/:caregiverId', reviewController.getCaregiverReviews);

/**
 * @route   POST /api/reviews/:id/reply
 * @desc    Caregiver replies to a customer review
 * @access  Private (Caregiver participant or Admin)
 */
router.post('/:id/reply', authenticate, validateReplyReview, reviewController.addCaregiverReply);

export default router;
