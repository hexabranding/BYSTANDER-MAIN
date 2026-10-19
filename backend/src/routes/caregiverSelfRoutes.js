import { Router } from 'express';
import * as caregiverSelfController from '../controllers/caregiverSelfController.js';
import * as adminFinanceController from '../controllers/adminFinanceController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import {
  validateUpdateCaregiverProfile,
  validateCaregiverAvailability,
} from '../middleware/validateCaregiver.js';
import { validateCaregiverPayoutRequest } from '../middleware/validateAdminFinance.js';

const router = Router();

// Strict RBAC: All /api/caregiver endpoints require authentication and caregiver role
router.use(authenticate, authorizeRoles('caregiver'));

// Profile management
router.get('/profile', caregiverSelfController.getMyProfile);
router.patch('/profile', validateUpdateCaregiverProfile, caregiverSelfController.updateMyProfile);

// Availability management
router.get('/availability', caregiverSelfController.getMyAvailability);
router.put('/availability', validateCaregiverAvailability, caregiverSelfController.updateMyAvailability);

// Earnings & Payouts management
router.get('/earnings', adminFinanceController.getCaregiverEarnings);
router.post('/payouts/request', validateCaregiverPayoutRequest, adminFinanceController.requestCaregiverPayout);

export default router;
