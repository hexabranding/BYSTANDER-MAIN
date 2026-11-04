import { Router } from 'express';
import * as geoController from '../controllers/geoController.js';

const router = Router();

// Public Geocoding & Address Enrichment Endpoints
router.get('/reverse', geoController.reverseGeocode);
router.get('/forward', geoController.forwardGeocode);

export default router;
