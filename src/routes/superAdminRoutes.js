import express from 'express';
import { authenticateAdmin, authenticateSuperAdmin } from '../middleware/authMiddleware.js';
import { createAdmin, deleteAdmin, getAllAdmins } from '../controllers/adminController.js';

const router = express.Router();

// Route to create a new admin
router.post('/create-admin', authenticateAdmin, authenticateSuperAdmin, createAdmin);
// Route to delete an admin
router.delete('/delete-admin/:id', authenticateAdmin, authenticateSuperAdmin, deleteAdmin);
// Route to get all non-super admins
router.get('/admins', authenticateAdmin, authenticateSuperAdmin, getAllAdmins);

export default router;