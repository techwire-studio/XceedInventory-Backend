import prisma from "../config/db.js";
import firestore from "../config/firebase.js";
import { v4 as uuidv4 } from "uuid";

// Helper function to back up order data to Firebase
const backupOrderToFirebase = async (order) => {
    try {
        await firestore.collection("orders").doc(order.orderId).set(order);
        console.log(`Order ${order.orderId} backed up to Firebase.`);
    } catch (error) {
        console.error(`Firebase backup failed for order ${order.orderId}:`, error);
    }
};

// Create Order
export const createOrder = async (req, res) => {
    try {
        const { firstName, lastName, phoneNumber, products, email } = req.body;

        if (!firstName || !lastName || !phoneNumber || !products || products.length === 0) {
            return res.status(400).json({ error: 'First name, last name, phone number, and products are required.' });
        }

        // Extract product IDs from request
        const productIds = products.map(p => p.productId);

        // Fetch products from DB
        const existingProducts = await prisma.product.findMany({
            where: { id: { in: productIds } }
        });

        // Check if all product IDs exist
        const existingProductIds = existingProducts.map(p => p.id);
        const missingProducts = productIds.filter(id => !existingProductIds.includes(id));
        console.log(products)
        if (missingProducts.length > 0) {
            return res.status(400).json({ error: 'Some product IDs do not exist:', missingProducts });
        }

        // Validate product names
        const updatedProducts = products.map((p) => {
            const matchingProduct = existingProducts.find(prod => prod.id === p.productId);
            if (!matchingProduct) return p;

            if (p.productName && p.productName !== matchingProduct.name) {
                throw new Error(`Product name mismatch for ID ${p.productId}. Expected: ${matchingProduct.name}`);
            }

            return { ...p, productName: matchingProduct.name };
        });

        // Create order in PostgreSQL
        const newOrder = await prisma.order.create({
            data: {
                orderId: `${Math.floor(1000 + Math.random() * 9000)}`,
                firstName,
                lastName,
                phoneNumber,
                email,
                products: updatedProducts,
                status: 'Pending'
            }
        });

        // Backup to Firebase (async, does not affect PostgreSQL operation)
        backupOrderToFirebase(newOrder);

        res.status(201).json(newOrder);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Server error while placing the order.' });
    }
};

// Update Order Status
export const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        if (!["Pending", "Ready to dispatch", "Completed", "Cancelled"].includes(status)) {
            return res.status(400).json({ error: "Invalid status update." });
        }

        const existingOrder = await prisma.order.findUnique({ where: { orderId } });

        if (!existingOrder) {
            return res.status(404).json({ error: "Order not found." });
        }

        // Enforce status transitions
        if (existingOrder.status === "Pending" && status === "Completed") {
            return res.status(400).json({ error: "Cannot directly move from Pending to Completed." });
        }

        // Update order in PostgreSQL
        const updatedOrder = await prisma.order.update({
            where: { orderId },
            data: { status },
        });

        // Backup updated order to Firebase
        backupOrderToFirebase(updatedOrder);

        res.json(updatedOrder);
    } catch (error) {
        res.status(500).json({ error: "Failed to update order status." });
    }
};

// Update Order Details
export const updateOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;
        const {
            firstName, lastName, email, phoneNumber,
            trackingId, invoiceNumber, message,
            shippingAddress, billingAddress, totalAmount,
            products
        } = req.body;

        const existingOrder = await prisma.order.findUnique({ where: { orderId } });

        if (!existingOrder) {
            return res.status(404).json({ error: "Order not found." });
        }

        // Ensure products are only updated (not added)
        if (products) {
            const existingProductIds = existingOrder.products.map(p => p.productId);
            const updatedProductIds = products.map(p => p.productId);

            // Prevent adding new products
            const newProducts = updatedProductIds.filter(id => !existingProductIds.includes(id));
            if (newProducts.length > 0) {
                return res.status(400).json({ error: "Adding new products is not allowed." });
            }
        }

        // Update order in PostgreSQL
        const updatedOrder = await prisma.order.update({
            where: { orderId },
            data: {
                firstName,
                lastName,
                email,
                phoneNumber,
                trackingId,
                invoiceNumber,
                message,
                shippingAddress,
                billingAddress: billingAddress?.sameAsShipping ? shippingAddress : billingAddress,
                totalAmount,
                products
            },
        });

        // Backup updated order to Firebase
        backupOrderToFirebase(updatedOrder);

        res.json(updatedOrder);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update order details." });
    }
};

// Fetch Orders
export const getOrders = async (req, res) => {
    try {
        const orders = await prisma.order.findMany({ orderBy: { createdAt: "desc" } });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch orders." });
    }
};

// Fetch the completed orders
export const getCompletedOrders = async (req, res) => {
    try {
        const completedOrders = await prisma.order.findMany({
            where: { status: "Completed" },
            orderBy: { createdAt: "desc"}
        })
        res.json(completedOrders);
    }catch(error){
        res.json(500).json({error: "Failed to fetch completed orders."})
    }
}