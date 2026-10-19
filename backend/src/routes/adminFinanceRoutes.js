import express from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import {
  validatePaymentQuery,
  validateTransactionIdParam,
  validatePayoutQuery,
  validatePayoutIdParam,
  validateUpdatePayoutStatus,
} from '../middleware/validateAdminFinance.js';
import * as adminFinanceController from '../controllers/adminFinanceController.js';

const router = express.Router();

// Strict RBAC: All administrative finance endpoints require an active admin session
router.use(authenticate, authorizeRoles('admin'));

/**
 * @route   GET /api/admin/payments
 * @desc    Retrieve paginated platform transactions with aggregate stats
 * @access  Private (Admin only)
 */
router.get('/payments', validatePaymentQuery, adminFinanceController.getPayments);

/**
 * @route   GET /api/admin/payments/:id
 * @desc    Retrieve single transaction audit dossier
 * @access  Private (Admin only)
 */
router.get('/payments/:id', validateTransactionIdParam, adminFinanceController.getPaymentById);

/**
 * @route   GET /api/admin/commissions
 * @desc    Retrieve paginated commissions with accrual and settlement metrics
 * @access  Private (Admin only)
 */
router.get('/commissions', validatePaymentQuery, adminFinanceController.getCommissions);

/**
 * @route   POST /api/admin/commissions/reconcile
 * @desc    Reconcile accrued commissions for completed care engagements
 * @access  Private (Admin only)
 */
router.post('/commissions/reconcile', adminFinanceController.reconcileCommissions);

/**
 * @route   GET /api/admin/payouts
 * @desc    Retrieve paginated caregiver payouts with status metrics
 * @access  Private (Admin only)
 */
router.get('/payouts', validatePayoutQuery, adminFinanceController.getPayouts);

/**
 * @route   PATCH /api/admin/payouts/:id/status
 * @desc    Transition caregiver payout status (pending -> processing -> settled)
 * @access  Private (Admin only)
 */
router.patch(
  '/payouts/:id/status',
  validatePayoutIdParam,
  validateUpdatePayoutStatus,
  adminFinanceController.updatePayoutStatus,
);

export default router;
