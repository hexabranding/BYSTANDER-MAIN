import { Router } from 'express';
import * as adminUserController from '../controllers/adminUserController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import {
  validateUserQuery,
  validateCaregiverUserQuery,
  validateUserIdParam,
  validateUpdateUserStatus,
} from '../middleware/validateAdminUser.js';

const router = Router();

// Administrative endpoints: Strictly enforce authentication and admin authorization
router.use(authenticate, authorizeRoles('admin'));

// 1. List registered customers (with pagination, search, status filter, live booking summary)
router.get('/customers', validateUserQuery, adminUserController.getCustomers);

// 2. List registered caregivers (with pagination, search, sorting, status and verification filters)
router.get('/caregivers', validateCaregiverUserQuery, adminUserController.getCaregivers);

// 3. Retrieve single user details and status audit trail
router.get('/:id', validateUserIdParam, adminUserController.getUserById);

// 4. Update user account status (active, suspended, blocked) with mandatory reason and audit record
router.patch(
  '/:id/status',
  validateUserIdParam,
  validateUpdateUserStatus,
  adminUserController.updateUserStatus,
);

export default router;
