import express from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { validateReportGeneration } from '../middleware/validateReview.js';
import { adminAnalyticsController } from '../controllers/adminAnalyticsController.js';

const router = express.Router();

// Strict RBAC: All administrative analytics and ratings endpoints require an active admin session
router.use(authenticate, authorizeRoles('admin'));

/**
 * @route   GET /api/admin/metrics
 * @desc    Retrieve aggregated platform KPI metrics and trend series
 * @access  Private (Admin only)
 */
router.get('/metrics', adminAnalyticsController.getMetrics);

/**
 * @route   GET /api/admin/ratings
 * @desc    Retrieve caregiver ratings directory and star distribution breakdown
 * @access  Private (Admin only)
 */
router.get('/ratings', adminAnalyticsController.getRatings);

/**
 * @route   GET /api/admin/ratings/:caregiverId/reviews
 * @desc    Retrieve individual caregiver review history
 * @access  Private (Admin only)
 */
router.get('/ratings/:caregiverId/reviews', adminAnalyticsController.getCaregiverReviewsAdmin);

/**
 * @route   POST /api/admin/reports/generate
 * @desc    Generate an operational report and export CSV data
 * @access  Private (Admin only)
 */
router.post('/reports/generate', validateReportGeneration, adminAnalyticsController.generateReport);

export default router;
