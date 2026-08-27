import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './controller';

const router = Router();
router.use(authenticate);
router.get('/permissions/catalog', authorize('users', 'read'), controller.catalog);
router.get('/permissions/matrix', authorize('users', 'read'), controller.matrix);
router.get('/', authorize('users', 'read'), controller.list);
router.post('/', authorize('users', 'write'), controller.create);
router.get('/:id', authorize('users', 'read'), controller.get);
router.patch('/:id', authorize('users', 'write'), controller.update);
router.patch('/:id/role', authorize('users', 'write'), controller.changeRole);
router.patch('/:id/status', authorize('users', 'write'), controller.setStatus);
router.post('/:id/reset-password', authorize('users', 'write'), controller.resetPassword);
router.put('/:id/permissions', authorize('users', 'write'), controller.setPermissions);
router.delete('/:id', authorize('users', 'write'), (req, res, next) => { req.body = { status: 'suspended' }; return controller.setStatus(req, res, next); });
export { router as usersRouter };
