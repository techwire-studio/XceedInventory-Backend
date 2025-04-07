import express from 'express';
import productRoutes from './routes/productRoutes.js';
import dotenv from 'dotenv';
import orderRoutes from "./routes/orderRoutes.js";
import authRoutes from './routes/authRoutes.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';

dotenv.config();
const app = express();

app.use(cors({
  origin: 'http://localhost:5173', // or whatever your frontend URL is
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Accept']
}));
app.use(express.json());
app.use(cookieParser());
// Routes
app.get('/', (req, res) => {
  res.send('API is running...');
}
);
app.use('/api/products', productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/auth", authRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));