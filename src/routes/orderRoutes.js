import express from "express";
import rateLimit from "express-rate-limit";
import {
    createOrder,
    getOrders,
    updateOrderStatus,
    updateOrderDetails,
    getCompletedOrders
} from "../controllers/orderController.js";
import { authenticateAdmin } from "../middleware/authMiddleware.js";
import { authenticateClient } from "../middleware/authenticateClient.js";

const orderLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10,
    message: { error: "Too many order requests. Please try again later." },
    headers: false,
});

const router = express.Router();

// Apply client authentication and rate limiting to the create order route
// @route   POST /api/orders
// @desc    Create a new order (client must be logged in)
// @access  Private (Client)
router.post("/", authenticateClient, orderLimiter, createOrder);

// Admin-only routes for managing orders
// @route   GET /api/orders
// @desc    Get all orders (admin only)
// @access  Private (Admin)
router.get("/", authenticateAdmin, getOrders);

// @route   PATCH /api/orders/:orderId/status
// @desc    Update order status (admin only)
// @access  Private (Admin)
router.patch("/:orderId/status", authenticateAdmin, updateOrderStatus);

// @route   PATCH /api/orders/:orderId/details
// @desc    Update order details (admin only)
// @access  Private (Admin)
router.patch("/:orderId/details", authenticateAdmin, orderLimiter, updateOrderDetails);


// @route   GET /api/orders/completed
// @desc    Get completed orders (admin only)
// @access  Private (Admin)
router.get('/completed', authenticateAdmin, getCompletedOrders);

export default router;