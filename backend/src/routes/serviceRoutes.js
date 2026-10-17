import { Router } from 'express';
import * as serviceController from '../controllers/serviceController.js';

const router = Router();

// Public Service Catalog Endpoints
router.get('/', serviceController.listServices);
router.get('/:id', serviceController.getService);

export default router;
