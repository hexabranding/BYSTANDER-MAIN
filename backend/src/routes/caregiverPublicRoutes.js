import { Router } from 'express';
import * as caregiverPublicController from '../controllers/caregiverPublicController.js';

const router = Router();

// Public verified caregiver profile detail
router.get('/:id', caregiverPublicController.getPublicProfile);

export default router;
