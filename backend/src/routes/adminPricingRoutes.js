import express from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import {
  getAdminPricing,
  updateAdminPricing,
  simulateAdminQuote,
} from '../controllers/adminPricingController.js';

const router = express.Router();

// Strict RBAC: All administrative pricing endpoints require an active admin session
router.use(authenticate, authorizeRoles('admin'));

/**
 * @route   GET /api/admin/pricing
 * @desc    Retrieve all platform pricing rules, tiers, daily discounts, and service catalog rates
 * @access  Private (Admin only)
 */
router.get('/', getAdminPricing);

/**
 * @route   PUT /api/admin/pricing
 * @desc    Update platform pricing rules, review tiers, daily discounts, or service rates
 * @access  Private (Admin only)
 */
router.put('/', updateAdminPricing);

/**
 * @route   POST /api/admin/pricing/simulate
 * @desc    Simulate quote calculations for testing
 * @access  Private (Admin only)
 */
router.post('/simulate', simulateAdminQuote);

export default router;

