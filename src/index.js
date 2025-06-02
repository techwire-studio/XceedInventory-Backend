import express from 'express';
import productRoutes from './routes/productRoutes.js';
import dotenv from 'dotenv';
import orderRoutes from "./routes/orderRoutes.js";
import authRoutes from './routes/authRoutes.js';
import superAdminRoutes from './routes/superAdminRoutes.js';
import formRoutes from './routes/formRoutes.js';
import addressRoutes from './routes/addressRoutes.js';
import clientAuthRoutes from './routes/clientAuthRoutes.js';

import cookieParser from 'cookie-parser';
import cors from 'cors';

dotenv.config();
const app = express();

const allowedOrigins = [
  'https://xceedfrontendd.vercel.app',
  'http://localhost:5173',
  'https://xceedinventoryfrontend.vercel.app',
  'https://xceedelectronics.com',
  'https://inventory.xceedelectronics.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization']
}));

app.use(express.json());
app.use(cookieParser());

// Routes
app.get('/', (req, res) => {
  res.send('API is running...');
});

app.use('/api/products', productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/auth", authRoutes); // Admin auth routes
app.use('/api/admin', superAdminRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/client/auth', clientAuthRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`));