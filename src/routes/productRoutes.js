import express from 'express';
import multer from 'multer';
import { createProduct } from '../controllers/productController.js';
import { uploadCSV } from '../controllers/productController.js';
import { getAllProducts } from '../controllers/productController.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/add-product', createProduct);
router.post('/upload', upload.single('file'), uploadCSV);
router.get('/all-products', getAllProducts);

export default router;
