import express from 'express';
import productRoutes from './routes/productRoutes.js';
import dotenv from 'dotenv';
import orderRoutes from "./routes/orderRoutes.js";
<<<<<<< Updated upstream
=======
import authRoutes from './routes/authRoutes.js';
import cookieParser from 'cookie-parser';
>>>>>>> Stashed changes
import cors from 'cors';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
<<<<<<< Updated upstream

app.get('/', (req, res) => {
  res.send('API is running...');
}
);

=======
app.use(cookieParser());
>>>>>>> Stashed changes
// Routes
app.use('/api/products', productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/auth", authRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
