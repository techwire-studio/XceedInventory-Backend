import express from 'express';
import { adminLogin, adminLogout, verifyToken } from '../controllers/authController.js';

const router = express.Router();

router.post("/login", adminLogin);
router.post("/logout", adminLogout);
router.post("/verify", verifyToken)

export default router;
