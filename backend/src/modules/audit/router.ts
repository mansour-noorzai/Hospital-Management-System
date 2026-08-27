import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { listAuditLogs } from './controller';

const router = Router();
router.get('/', authenticate, authorize('users', 'read'), listAuditLogs);
export { router as auditRouter };
