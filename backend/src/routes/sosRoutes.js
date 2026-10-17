import { Router } from 'express';
import * as sosController from '../controllers/sosController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { sosLimiter } from '../middleware/rateLimiter.js';
import {
  validateRaiseSos,
  validateAssignSos,
  validateAddTimelineNote,
  validateResolveSos,
} from '../middleware/validateSos.js';

const router = Router();

// All SOS endpoints require authentication
router.use(authenticate);

// 1. Raise SOS emergency incident (Customer, Caregiver, or Admin)
router.post('/', sosLimiter, validateRaiseSos, sosController.raiseSos);

// 2. List incidents (Scoped to caller's bookings or admin operational queue)
router.get('/', sosController.getSosIncidents);

// 3. Incident details and audit timeline (Participant or Admin)
router.get('/:id', sosController.getSosById);

// 4. Admin assignment and triage
router.patch('/:id/assign', authorizeRoles('admin'), validateAssignSos, sosController.assignSos);

// 5. Append operational timeline event (Participant or Admin)
router.post('/:id/timeline', validateAddTimelineNote, sosController.addTimelineNote);

// 6. Admin resolution or false-alarm closure
router.patch('/:id/resolve', authorizeRoles('admin'), validateResolveSos, sosController.resolveSos);

export default router;
