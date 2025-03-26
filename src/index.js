import express from 'express';
import productRoutes from './routes/productRoutes.js';
import dotenv from 'dotenv';
import orderRoutes from "./routes/orderRoutes.js";

dotenv.config();
app.use(cors());
const app = express();
app.use(express.json());

// Routes
app.use('/api/products', productRoutes);
app.use("/api/orders", orderRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
