import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import {
  validateCustomerRegistration,
  validateCaregiverRegistration,
  validateLogin,
} from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// 1. Customer Registration
router.post(
  '/register/customer',
  authLimiter,
  validateCustomerRegistration,
  authController.registerCustomer,
);

// 2. Caregiver Registration
router.post(
  '/register/caregiver',
  authLimiter,
  validateCaregiverRegistration,
  authController.registerCaregiver,
);

// 3. User Login
router.post('/login', authLimiter, validateLogin, authController.login);

// 4. Current User Safe Profile (Requires Authentication)
router.get('/me', authenticate, authController.getMe);

// 5. User Logout
router.post('/logout', authController.logout);

// 6. Urgent Guest Access (Email + OTP)
router.post('/guest/request-otp', authLimiter, authController.requestGuestOtp);
router.post('/guest/verify-otp', authLimiter, authController.verifyGuestOtp);

// 7. Set/Update Password (Requires Authentication)
router.post('/set-password', authenticate, authController.setPassword);

export default router;
