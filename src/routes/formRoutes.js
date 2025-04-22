import express from 'express';
import { handleCareerApplication, handleContactInquiry } from '../controllers/formController.js'; // Adjust path as needed
import uploadResume from '../middleware/multerConfigForms.js'; // Adjust path as needed

const router = express.Router();

router.post(
    '/apply',
    uploadResume.single('resume'), 
    handleCareerApplication 
);

router.post(
    '/contact', 
    handleContactInquiry 
);

export default router;