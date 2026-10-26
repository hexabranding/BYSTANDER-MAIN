import { Router } from 'express';
import * as ambulanceController from '../controllers/ambulanceController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';

const router = Router();

// Public / User Emergency Lookup
router.get('/', ambulanceController.listPublic);
router.post('/register', ambulanceController.register);
router.post('/:id/call', ambulanceController.recordCall);

// Ambulance Driver Self-Service (Role: ambulance)
router.get('/me', authenticate, authorizeRoles('ambulance'), ambulanceController.getMe);
router.patch('/me', authenticate, authorizeRoles('ambulance'), ambulanceController.updateMe);
router.patch(
  '/me/availability',
  authenticate,
  authorizeRoles('ambulance'),
  ambulanceController.toggleAvailability
);

// Admin Management (Role: admin)
router.get('/admin', authenticate, authorizeRoles('admin'), ambulanceController.adminList);
router.patch(
  '/admin/:id/verify',
  authenticate,
  authorizeRoles('admin'),
  ambulanceController.adminVerify
);

export default router;
