import express from 'express';
import productRoutes from './routes/productRoutes.js';
import dotenv from 'dotenv';
import orderRoutes from "./routes/orderRoutes.js";
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('API is running...');
}
);

// Routes
app.use('/api/products', productRoutes);
app.use("/api/orders", orderRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
