// routes/addressRoutes.js
import express from 'express';
import {
    getAllFromAddresses,
    createFromAddress,
    updateFromAddress,
    deleteFromAddress
} from '../controllers/addressController.js'; 
import { authenticateAdmin } from "../middleware/authMiddleware.js"; 

const router = express.Router();

// All address routes require admin authentication
router.use(authenticateAdmin);

// Routes for 'FromAddress'
router.get('/from', getAllFromAddresses);
router.post('/from', createFromAddress);
router.put('/from/:id', updateFromAddress);
router.delete('/from/:id', deleteFromAddress);

export default router;