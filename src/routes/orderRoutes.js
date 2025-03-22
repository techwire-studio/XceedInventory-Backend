import express from "express";
import rateLimit from "express-rate-limit";
import {
    createOrder,
    getOrders,
    updateOrderStatus,
    updateOrderDetails
} from "../controllers/orderController.js";

const orderLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // Limit each IP to 10 order creation requests per windowMs
    message: { error: "Too many order requests. Please try again later." },
    headers: false,
});

const router = express.Router();

router.post("/", orderLimiter, createOrder);
router.get("/", getOrders);
router.patch("/:orderId/status", updateOrderStatus);
router.patch("/:orderId/details", orderLimiter, updateOrderDetails);

export default router;
