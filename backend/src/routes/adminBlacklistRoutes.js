import { Router } from 'express';
import * as adminBlacklistController from '../controllers/adminBlacklistController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';

const router = Router();

// Administrative security: Enforce authentication and admin authorization
router.use(authenticate, authorizeRoles('admin'));

// 1. List blacklist entries with filters & stats
router.get('/', adminBlacklistController.getBlacklist);

// 2. Search registered candidates for quick blacklisting
router.get('/candidates', adminBlacklistController.getCandidates);

// 3. Add account to blacklist
router.post('/', adminBlacklistController.addToBlacklist);

// 4. Remove account from blacklist
router.delete('/:id', adminBlacklistController.removeFromBlacklist);

export default router;
