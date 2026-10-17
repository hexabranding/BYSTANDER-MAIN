import { Router } from 'express';
import * as caregiverPublicController from '../controllers/caregiverPublicController.js';
import { validateGetCaregivers } from '../middleware/validateCaregiver.js';

const router = Router();

// 1. Public verified caregiver search & directory listing
router.get('/', validateGetCaregivers, caregiverPublicController.getPublicCaregivers);

// 2. Public verified caregiver profile detail
router.get('/:id', caregiverPublicController.getPublicProfile);

export default router;
