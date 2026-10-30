import { Router } from 'express';
import * as bookingController from '../controllers/bookingController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import {
  validateCreateBooking,
  validateCancelBooking,
  validateRejectBooking,
  validateSelectCaregiver,
} from '../middleware/validateBooking.js';
import { validateVerifyOtp } from '../middleware/validateOtp.js';

const router = Router();

// All booking endpoints require authentication
router.use(authenticate);

// 1. Customer-only booking creation
router.post('/', authorizeRoles('customer'), validateCreateBooking, bookingController.createBooking);

// 2. Participant/Admin listing
router.get('/', bookingController.getBookings);

// 3. Participant/Admin detail view
router.get('/:id', bookingController.getBookingById);

// 4. Caregiver acceptance (targeted confirmation or broadcast application)
router.patch('/:id/accept', authorizeRoles('caregiver'), bookingController.acceptBooking);

// 4b. Customer chooses a caregiver from applicants
router.patch(
  '/:id/select-caregiver',
  authorizeRoles('customer', 'admin'),
  validateSelectCaregiver,
  bookingController.selectCaregiver,
);

// 4c. Customer re-broadcasts pending/expired broadcast booking
router.patch(
  '/:id/rebroadcast',
  authorizeRoles('customer', 'admin'),
  bookingController.rebroadcastBooking,
);

// 5. Caregiver rejection of pending request
router.patch(
  '/:id/reject',
  authorizeRoles('caregiver', 'admin'),
  validateRejectBooking,
  bookingController.rejectBooking,
);

// 6. Participant/Admin cancellation
router.patch('/:id/cancel', validateCancelBooking, bookingController.cancelBooking);

// 6. Shift Check-In: Customer requests OTP (Customer/Admin only)
router.post('/:id/checkin/otp', authorizeRoles('customer', 'admin'), bookingController.requestCheckInOtp);

// 7. Shift Check-In: Caregiver submits OTP (Caregiver/Admin only)
router.post(
  '/:id/checkin/verify',
  authorizeRoles('caregiver', 'admin'),
  validateVerifyOtp,
  bookingController.verifyCheckIn,
);

// 8. Shift Check-Out: Customer requests OTP (Customer/Admin only)
router.post('/:id/checkout/otp', authorizeRoles('customer', 'admin'), bookingController.requestCheckOutOtp);

// 9. Shift Check-Out: Caregiver submits OTP (Caregiver/Admin only)
router.post(
  '/:id/checkout/verify',
  authorizeRoles('caregiver', 'admin'),
  validateVerifyOtp,
  bookingController.verifyCheckOut,
);

export default router;
