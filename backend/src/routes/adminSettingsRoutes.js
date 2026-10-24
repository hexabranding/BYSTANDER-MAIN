import express from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { adminSettingsController } from '../controllers/adminSettingsController.js';

const router = express.Router();

// Strict RBAC: All administrative settings endpoints require an active admin session
router.use(authenticate, authorizeRoles('admin'));

/**
 * @route   GET /api/admin/settings
 * @desc    Retrieve platform settings, admin team roster, and security indicators
 * @access  Private (Admin only)
 */
router.get('/', adminSettingsController.getSettings);

/**
 * @route   PATCH /api/admin/settings
 * @desc    Update platform configuration (general, fees, notifications, policy)
 * @access  Private (Admin only)
 */
router.patch('/', adminSettingsController.updateSettings);

/**
 * @route   POST /api/admin/settings/team/invite
 * @desc    Invite / register a new administrator account in MongoDB
 * @access  Private (Admin only)
 */
router.post('/team/invite', adminSettingsController.inviteAdmin);

export default router;
