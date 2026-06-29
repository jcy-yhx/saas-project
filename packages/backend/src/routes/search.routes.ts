import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as ctrl from '../controllers/search.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.search);

export default router;
