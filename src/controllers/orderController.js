import prisma from "../config/db.js";
import { db as firestore } from "../config/firebase.js";
import { v4 as uuidv4 } from "uuid";
import { sendOrderNotificationToAdmins } from '../utils/mailer.js';
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

        // ---------------------
        // Input Validations
        // ---------------------
        if (!firstName || typeof firstName !== 'string' || !/^[A-Za-z]+$/.test(firstName.trim())) {
            return res.status(400).json({ error: 'First name is required and must contain only alphabets.' });
        }

        if (lastName && (typeof lastName !== 'string' || !/^[A-Za-z]+$/.test(lastName.trim()))) {
            return res.status(400).json({ error: 'Last name must contain only alphabets if provided.' });
        }

        if (!phoneNumber || !/^(\+\d+ )?\d{10}$/.test(phoneNumber)) {
            return res.status(400).json({ error: 'Phone number must be 10 digits, optionally preceded by a country code and space.' });
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Invalid email format.' });
        }

        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ error: 'Products must be a non-empty array.' });
        }

        const productIds = products.map(p => p.productId);

        if (productIds.some(id => typeof id !== 'string' || id.trim() === '')) {
            return res.status(400).json({ error: 'Each product must have a valid productId.' });
        }

        // ---------------------
        // Product Validation
        // ---------------------
        const existingProducts = await prisma.product.findMany({
            where: { id: { in: productIds } }
        });

        const existingProductIds = existingProducts.map(p => p.id);
        const missingProducts = productIds.filter(id => !existingProductIds.includes(id));

        if (missingProducts.length > 0) {
            return res.status(400).json({
                error: 'Some product IDs do not exist.',
                missingProducts
            });
        }

        const updatedProducts = products.map((p) => {
            const matchingProduct = existingProducts.find(prod => prod.id === p.productId);
            if (!matchingProduct) return p;

            if (p.productName && p.productName !== matchingProduct.name) {
                throw new Error(`Product name mismatch for ID ${p.productId}. Expected: ${matchingProduct.name}`);
            }

            return { ...p, productName: matchingProduct.name };
        });

        // ---------------------
        // Create Order
        // ---------------------
        const newOrder = await prisma.order.create({
            data: {
                orderId: `${Math.floor(1000 + Math.random() * 9000)}`,
                firstName,
                lastName: lastName || null,
                phoneNumber,
                email,
                products: updatedProducts,
                status: 'Pending'
            }
        });

        backupOrderToFirebase(newOrder);
        try {
            const adminsToNotify = await prisma.admin.findMany({
                select: { email: true }
            });
            const adminEmails = adminsToNotify.map(admin => admin.email);
            if (adminEmails.length > 0) {
                const customerName = `${newOrder.firstName} ${newOrder.lastName || ''}`.trim();
                sendOrderNotificationToAdmins({
                    recipients: adminEmails,
                    orderId: newOrder.orderId,
                    customerName: customerName
                });
            } else {
                console.log("No admins found in the database to notify.");
            }
        } catch (emailError) {
            console.error("Failed to send order notification email to admins:", emailError);
        }
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

        // ---------------------
        // Input Validations
        // ---------------------
        if (firstName !== undefined && (typeof firstName !== 'string' || !/^[A-Za-z]+$/.test(firstName.trim()))) {
            return res.status(400).json({ error: 'First name must contain only alphabets.' });
        }

        if (lastName !== undefined && (typeof lastName !== 'string' || !/^[A-Za-z]+$/.test(lastName.trim()))) {
            return res.status(400).json({ error: 'Last name must contain only alphabets.' });
        }

        if (phoneNumber !== undefined && !/^(\+\d+ )?\d{10}$/.test(phoneNumber)) {
            return res.status(400).json({ error: 'Phone number must be 10 digits, optionally preceded by a country code and space.' });
        }

        if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Email must be a valid format.' });
        }

        if (trackingId !== null && trackingId !== undefined && (typeof trackingId !== 'string' || trackingId.trim() === '')) {
            return res.status(400).json({ error: 'Tracking ID must be a non-empty string if provided.' });
        }

        if (invoiceNumber !== undefined && (typeof invoiceNumber !== 'string' || invoiceNumber.trim() === '')) {
            return res.status(400).json({ error: 'Invoice number must be a non-empty string if provided.' });
        }

        if (message !== undefined && typeof message !== 'string') {
            return res.status(400).json({ error: 'Message must be a string if provided.' });
        }

        if (shippingAddress !== undefined && (typeof shippingAddress !== 'object' || shippingAddress === null)) {
            return res.status(400).json({ error: 'Shipping address must be an object if provided.' });
        }

        if (billingAddress !== undefined && (typeof billingAddress !== 'object' || billingAddress === null)) {
            return res.status(400).json({ error: 'Billing address must be an object if provided.' });
        }

        if (totalAmount !== undefined && (isNaN(Number(totalAmount)) || Number(totalAmount) < 0)) {
            return res.status(400).json({ error: 'Total amount must be a non-negative number if provided.' });
        }
        if (products !== null && products !== undefined && !Array.isArray(products)) {
            return res.status(400).json({ error: 'Products must be an array if provided.' });
        }
        const existingOrder = await prisma.order.findUnique({
            where: { orderId },
            select: {
                products: true
            }
        });

        if (!existingOrder) {
            return res.status(404).json({ error: "Order not found." });
        }

        let mergedProducts = existingOrder.products;

        if (products !== undefined) {
            if (!Array.isArray(products)) {
                return res.status(400).json({ error: 'Products must be an array if provided.' });
            }

            for (const product of products) {
                if (!product.productId || typeof product.productId !== 'string' || product.productId.trim() === '') {
                    return res.status(400).json({ error: 'Each product must have a valid productId.' });
                }
            }

            if (products.length > 0) {
                const productIds = products.map(p => p.productId);
                const existingProducts = await prisma.product.findMany({
                    where: { id: { in: productIds } }
                });

                const existingProductIds = existingProducts.map(p => p.id);
                const missingProducts = productIds.filter(id => !existingProductIds.includes(id));

                if (missingProducts.length > 0) {
                    return res.status(400).json({
                        error: 'Some product IDs do not exist.',
                        missingProducts
                    });
                }

                // Validate or fetch product names
                const validatedProducts = products.map((p) => {
                    const matchingProduct = existingProducts.find(prod => prod.id === p.productId);
                    if (!matchingProduct) return p;

                    if (p.productName && p.productName !== matchingProduct.name) {
                        throw new Error(`Product name mismatch for ID ${p.productId}. Expected: ${matchingProduct.name}`);
                    }

                    return { ...p, productName: matchingProduct.name };
                });

                // Merge with existing order products
                const existingMap = new Map();
                mergedProducts.forEach(p => existingMap.set(p.productId, p));

                for (const newProduct of validatedProducts) {
                    if (existingMap.has(newProduct.productId)) {
                        const updated = {
                            ...existingMap.get(newProduct.productId),
                            ...newProduct
                        };
                        existingMap.set(newProduct.productId, updated);
                    } else {
                        existingMap.set(newProduct.productId, newProduct);
                    }
                }

                mergedProducts = Array.from(existingMap.values());
            }
        }

        const updateData = {};
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (email !== undefined) updateData.email = email;
        if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
        if (trackingId !== undefined) updateData.trackingId = trackingId;
        if (invoiceNumber !== undefined) updateData.invoiceNumber = invoiceNumber;
        if (message !== undefined) updateData.message = message;
        if (shippingAddress !== undefined) updateData.shippingAddress = shippingAddress;
        if (billingAddress !== undefined) updateData.billingAddress = billingAddress;
        if (totalAmount !== undefined) updateData.totalAmount = totalAmount;
        if (products !== undefined) updateData.products = mergedProducts;

        const updatedOrder = await prisma.order.update({
            where: { orderId },
            data: updateData
        });

        backupOrderToFirebase(updatedOrder);

        res.status(200).json({ message: "Order updated successfully", order: updatedOrder });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update order", details: error.message });
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
            orderBy: { createdAt: "desc" }
        })
        res.json(completedOrders);
    } catch (error) {
        res.json(500).json({ error: "Failed to fetch completed orders." })
    }
}