import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireWorkspaceMembership } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { createCommentSchema, updateCommentSchema } from '@taskflow/shared';
import * as ctrl from '../controllers/comment.controller.js';

const router = Router({ mergeParams: true });
router.use(authenticate);

// POST/GET /api/tasks/:taskId/comments
router.post('/', requireWorkspaceMembership, validate(createCommentSchema), ctrl.create);
router.get('/', requireWorkspaceMembership, ctrl.list);

// PATCH/DELETE /api/comments/:commentId
router.patch('/:commentId', validate(updateCommentSchema), ctrl.update);
router.delete('/:commentId', ctrl.remove);

export default router;
