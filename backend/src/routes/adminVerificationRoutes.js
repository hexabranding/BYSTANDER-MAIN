import { Router } from 'express';
import * as adminVerificationController from '../controllers/adminVerificationController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import {
  validateVerificationQuery,
  validateCaregiverIdParam,
  validateDocumentIdParam,
  validateUpdateDocumentStatus,
  validateUpdateCaregiverVerificationStatus,
} from '../middleware/validateAdminVerification.js';

const router = Router();

// Administrative endpoints: Strictly enforce authentication and admin authorization
router.use(authenticate, authorizeRoles('admin'));

// 1. List caregivers & documents awaiting review (with optional status filter, search, & pagination)
router.get('/', validateVerificationQuery, adminVerificationController.getVerifications);

// 2. Review individual document (approve / reject / under review)
router.patch(
  '/documents/:documentId',
  validateDocumentIdParam,
  validateUpdateDocumentStatus,
  adminVerificationController.updateDocumentStatus,
);

// 3. Retrieve authorized document metadata and application details for a caregiver
router.get('/:id', validateCaregiverIdParam, adminVerificationController.getVerificationById);

// 4. Update overall caregiver verification status under approved business rules
router.patch(
  '/:id/status',
  validateCaregiverIdParam,
  validateUpdateCaregiverVerificationStatus,
  adminVerificationController.updateCaregiverVerificationStatus,
);

export default router;
