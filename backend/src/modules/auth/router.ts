import { Router } from 'express';
import * as AuthController from './controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.post('/logout-all', authenticate, AuthController.logoutAll);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);
router.get('/me', authenticate, AuthController.getMe);
router.patch('/me', authenticate, AuthController.updateMe);
router.patch('/preferences', authenticate, AuthController.updatePreferences);
router.post('/change-password', authenticate, AuthController.changePassword);

export { router as authRouter };
