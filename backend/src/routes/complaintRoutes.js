import { Router } from 'express';
import * as complaintController from '../controllers/complaintController.js';
import { authenticate } from '../middleware/auth.js';
import {
  validateSubmitComplaint,
  validateComplaintQuery,
  validateComplaintIdParam,
} from '../middleware/validateComplaint.js';

const router = Router();

// Customer and caregiver complaint workflows require authenticated session
router.use(authenticate);

// 1. Submit a new complaint (complainant derived strictly from req.user)
router.post('/', validateSubmitComplaint, complaintController.createComplaint);

// 2. List caller's own complaints
router.get('/', validateComplaintQuery, complaintController.getMyComplaints);

// 3. Retrieve single complaint details (authorized complainant or respondent only)
router.get('/:id', validateComplaintIdParam, complaintController.getComplaintById);

export default router;
