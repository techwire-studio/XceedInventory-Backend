import express from 'express';
import productRoutes from './routes/productRoutes.js';
import dotenv from 'dotenv';
import orderRoutes from "./routes/orderRoutes.js";
import authRoutes from './routes/authRoutes.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import superAdminRoutes from './routes/superAdminRoutes.js'

dotenv.config();
const app = express();

const allowedOrigins = [process.env.FRONTEND_URL, 'http://localhost:5173']; // Add localhost for local dev

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization']
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
app.use('/api/admin', superAdminRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));