import { Router } from 'express';
import * as hospitalController from '../controllers/hospitalController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';

const router = Router();

// Apply authentication and admin authorization across admin hospital routes
router.use(authenticate, authorizeRoles('admin'));

// 1. List partner hospitals with filtering & stats
router.get('/', hospitalController.getHospitals);

// 2. Get single hospital details
router.get('/:id', hospitalController.getHospitalById);

// 3. Add new partner hospital
router.post('/', hospitalController.createHospital);

// 4. Update hospital
router.put('/:id', hospitalController.updateHospital);

// 5. Toggle or update hospital contract status (Active / On Hold)
router.patch('/:id/contract-status', hospitalController.toggleHospitalContract);

// 6. Delete hospital
router.delete('/:id', hospitalController.deleteHospital);

export default router;
