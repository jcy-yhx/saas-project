import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as ctrl from '../controllers/notification.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.list);
router.get('/unread-count', ctrl.unreadCount);
router.patch('/:id/read', ctrl.markRead);
router.patch('/read-all', ctrl.markAllRead);

export default router;
