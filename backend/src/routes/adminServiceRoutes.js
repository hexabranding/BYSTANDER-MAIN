import { Router } from 'express';
import * as serviceController from '../controllers/serviceController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import {
  validateCreateService,
  validateUpdateService,
  validateUpdateServiceStatus,
} from '../middleware/validateService.js';

const router = Router();

// Apply authentication and admin authorization across all /api/admin/services routes
router.use(authenticate, authorizeRoles('admin'));

// 1. Create new service
router.post('/', validateCreateService, serviceController.createService);

// 2. Update service fields
router.patch('/:id', validateUpdateService, serviceController.updateService);

// 3. Toggle/update service active status (deactivation pattern)
router.patch('/:id/status', validateUpdateServiceStatus, serviceController.updateServiceStatus);

export default router;
