import { Router } from 'express';
import * as customerController from '../controllers/customerController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { validateUpdateCustomerProfile } from '../middleware/validateCustomer.js';

const router = Router();

// Customer endpoints strictly require authentication and customer (or admin) role
router.use(authenticate, authorizeRoles('customer', 'admin'));

// 1. Get authenticated customer's profile
router.get('/profile', customerController.getMyProfile);
router.get('/', customerController.getMyProfile);

// 2. Update authenticated customer's profile details
router.patch('/profile', validateUpdateCustomerProfile, customerController.updateMyProfile);
router.patch('/', validateUpdateCustomerProfile, customerController.updateMyProfile);

export default router;
