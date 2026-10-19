import { Router } from 'express';
import * as adminModerationController from '../controllers/adminModerationController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { validateModerationQuery } from '../middleware/validateAdminUser.js';

const router = Router();

// Administrative endpoints: Strictly enforce authentication and admin authorization
router.use(authenticate, authorizeRoles('admin'));

// Moderation queue: Paginated flagged messages (with privacy safeguards)
router.get('/', validateModerationQuery, adminModerationController.getFlaggedMessages);
router.get('/flagged', validateModerationQuery, adminModerationController.getFlaggedMessages);

export default router;
