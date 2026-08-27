import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './controller';

const router = Router();
router.get('/public', controller.getPublicHospital);
router.get('/branding', authenticate, controller.getCurrentBranding);
router.get('/', authenticate, authorize('settings', 'read'), controller.getHospital);
router.patch('/', authenticate, authorize('settings', 'write'), controller.updateHospital);
export { router as hospitalRouter };
