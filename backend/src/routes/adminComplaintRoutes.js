import { Router } from 'express';
import * as complaintController from '../controllers/complaintController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import {
  validateComplaintQuery,
  validateComplaintIdParam,
  validateUpdateComplaintStatus,
  validateAddComplaintNote,
} from '../middleware/validateComplaint.js';

const router = Router();

// Administrative complaint endpoints strictly enforce admin authorization
router.use(authenticate, authorizeRoles('admin'));

// 1. Paginated complaint list with triage statistics and filters
router.get('/', validateComplaintQuery, complaintController.getAdminComplaints);

// 2. Retrieve complaint details with internal investigation notes and timeline
router.get('/:id', validateComplaintIdParam, complaintController.getAdminComplaintById);

// 3. Update complaint status with mandatory resolution details on resolve/dismiss
router.patch(
  '/:id/status',
  validateComplaintIdParam,
  validateUpdateComplaintStatus,
  complaintController.updateComplaintStatus,
);

// 4. Append internal investigation note
router.post(
  '/:id/notes',
  validateComplaintIdParam,
  validateAddComplaintNote,
  complaintController.addInternalNote,
);

export default router;
