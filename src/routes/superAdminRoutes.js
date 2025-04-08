import express from 'express';
import { authenticateAdmin, authenticateSuperAdmin } from '../middleware/authMiddleware.js';
import { createAdmin } from '../controllers/adminController.js';

const router = express.Router();

router.post('/create-admin', authenticateAdmin, authenticateSuperAdmin, createAdmin);

export default router;
