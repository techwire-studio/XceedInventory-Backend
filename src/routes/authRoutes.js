import express from 'express';
import { adminLogin, adminLogout } from '../controllers/authController.js';

const router = express.Router();

router.post("/login", adminLogin);
router.post("/logout", adminLogout);

export default router;
