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
    const clientId = req.client?.id;

    if (!clientId) {
        console.error("Error in createOrder: Client ID missing from request after authentication.");
        return res.status(403).json({ error: "User authentication issue. Client ID not found." });
    }

    try {
        const { firstName, lastName, phoneNumber, products, email } = req.body;

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
                throw new Error(`Product name mismatch for ID ${p.productId}. Expected: ${matchingProduct.name}, Got: ${p.productName}`);
            }
            return { ...p, productName: matchingProduct.name || p.productName };
        });

        const newOrder = await prisma.order.create({
            data: {
                orderId: `${Math.floor(1000 + Math.random() * 9000)}`,
                firstName: firstName.trim(),
                lastName: lastName ? lastName.trim() : null,
                phoneNumber: phoneNumber.trim(),
                email: email.trim().toLowerCase(),
                products: updatedProducts,
                status: 'Pending',
                clientId: clientId,
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
                console.log("No admins found in the database to notify for new order.");
            }
        } catch (emailError) {
            console.error("Failed to send new order notification email to admins:", emailError);
        }

        res.status(201).json({ message: "Order placed successfully. Awaiting payment.", order: newOrder });

    } catch (error) {
        console.error("Error creating order:", error);
        if (error.message.startsWith('Product name mismatch')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message || 'Server error while placing the order.' });
    }
};
// Update Order Status
export const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        // Validate input status
        const validStatuses = ["Pending", "Ready to dispatch", "Completed", "Cancelled"];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid status update. Must be one of: ${validStatuses.join(', ')}` });
        }

        // Fetch the current order details needed for validation
        const existingOrder = await prisma.order.findUnique({
            where: { orderId },
            select: { // Select fields needed for validation
                status: true,
                shippingAddress: true,
                billingAddress: true,
                fromAddressId: true
            }
        });

        if (!existingOrder) {
            return res.status(404).json({ error: "Order not found." });
        }

        // --- Validation Logic ---
        if (existingOrder.status === "Pending" && status === "Completed") {
            return res.status(400).json({ error: "Cannot directly move status from Pending to Completed." });
        }
        if (existingOrder.status === "Completed" || existingOrder.status === "Cancelled") {
            return res.status(400).json({ error: `Cannot change status from ${existingOrder.status}.` });
        }

        // Check requirements for "Ready to dispatch"
        if (status === "Ready to dispatch") {
            if (!existingOrder.shippingAddress) {
                return res.status(400).json({ error: "Cannot set status to 'Ready to dispatch': Shipping address is missing." });
            }
            if (!existingOrder.billingAddress) {
                return res.status(400).json({ error: "Cannot set status to 'Ready to dispatch': Billing address is missing." });
            }
            if (!existingOrder.fromAddressId) {
                return res.status(400).json({ error: "Cannot set status to 'Ready to dispatch': 'From' address is missing." });
            }
        }

        const updatedOrder = await prisma.order.update({
            where: { orderId },
            data: { status },
        });

        backupOrderToFirebase(updatedOrder);

        res.status(200).json({ message: "Order status updated successfully", order: updatedOrder });
    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({ error: "Failed to update order status", details: error.message });
    }
};

export const updateOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;
        const {
            firstName, lastName, email, phoneNumber,
            trackingId, invoiceNumber, message,
            shippingAddress, billingAddress, totalAmount,
            products,
            fromAddressId
        } = req.body;

        const existingOrder = await prisma.order.findUnique({
            where: { orderId },
            select: {
                products: true,
            }
        });

        if (!existingOrder) {
            return res.status(404).json({ error: "Order not found." });
        }

        if (firstName !== undefined && (typeof firstName !== 'string' || !/^[A-Za-z]+$/.test(firstName.trim()))) {
            return res.status(400).json({ error: 'First name must contain only alphabets.' });
        }
        if (lastName !== undefined && (typeof lastName !== 'string' || !/^[A-Za-z]+$/.test(lastName.trim()))) {
            return res.status(400).json({ error: 'Last name must contain only alphabets.' });
        }
        if (phoneNumber !== undefined && !/^(\+\d+ )?\d{10}$/.test(phoneNumber)) {
            return res.status(400).json({ error: 'Phone number must be 10 digits, optionally preceded by a country code and space.' });
        }
        if (email !== undefined && email !== null && email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Email must be a valid format or null/empty to clear.' });
        }
        if (trackingId !== undefined && trackingId !== null && (typeof trackingId !== 'string' || trackingId.trim() === '')) {
            return res.status(400).json({ error: 'Tracking ID must be a non-empty string if provided or null to clear.' });
        }
        if (invoiceNumber !== undefined && invoiceNumber !== null && (typeof invoiceNumber !== 'string' || invoiceNumber.trim() === '')) {
            return res.status(400).json({ error: 'Invoice number must be a non-empty string if provided or null to clear.' });
        }
        if (message !== undefined && message !== null && typeof message !== 'string') {
            return res.status(400).json({ error: 'Message must be a string or null to clear.' });
        }
        if (shippingAddress !== undefined && shippingAddress !== null && (typeof shippingAddress !== 'object')) {
            return res.status(400).json({ error: 'Shipping address must be an object or null to clear.' });
        }
        if (billingAddress !== undefined && billingAddress !== null && (typeof billingAddress !== 'object')) {
            return res.status(400).json({ error: 'Billing address must be an object or null to clear.' });
        }
        if (totalAmount !== undefined && totalAmount !== null && (isNaN(Number(totalAmount)) || Number(totalAmount) < 0)) {
            return res.status(400).json({ error: 'Total amount must be a non-negative number or null to clear.' });
        }

        let validFromAddressId = undefined;
        if (fromAddressId !== undefined) {
            if (fromAddressId === null || fromAddressId === '') {
                validFromAddressId = null;
            } else if (typeof fromAddressId !== 'string') {
                return res.status(400).json({ error: 'From Address ID must be a string.' });
            } else {
                // Check if the provided fromAddressId actually exists in the FromAddress table
                const addressExists = await prisma.fromAddress.findUnique({
                    where: { id: fromAddressId },
                    select: { id: true }
                });
                if (!addressExists) {
                    return res.status(400).json({ error: `From Address with ID ${fromAddressId} not found.` });
                }
                validFromAddressId = fromAddressId;
            }
        }

        let mergedProducts = existingOrder.products || [];
        if (products !== undefined) {
            if (!Array.isArray(products)) {
                return res.status(400).json({ error: 'Products must be an array if provided.' });
            }

            for (const product of products) {
                if (!product.productId || typeof product.productId !== 'string' || product.productId.trim() === '') {
                    return res.status(400).json({ error: 'Each product in the array must have a valid productId.' });
                }
            }

            if (products.length > 0) {
                const productIds = products.map(p => p.productId);
                const existingDbProducts = await prisma.product.findMany({
                    where: { id: { in: productIds } },
                    select: { id: true, name: true }
                });
                const existingProductMap = new Map(existingDbProducts.map(p => [p.id, p]));

                const missingProducts = productIds.filter(id => !existingProductMap.has(id));
                if (missingProducts.length > 0) {
                    return res.status(400).json({ error: 'Some product IDs do not exist.', missingProducts });
                }

                const validatedProducts = products.map(p => {
                    const matchingProduct = existingProductMap.get(p.productId);
                    return {
                        ...p,
                        productName: matchingProduct?.name || p.productName || 'N/A'
                    };
                });

                mergedProducts = validatedProducts;

            } else {
                mergedProducts = [];
            }
        }

        const updateData = {};
        if (firstName !== undefined) updateData.firstName = firstName.trim();
        if (lastName !== undefined) updateData.lastName = lastName.trim();
        if (email !== undefined) updateData.email = email ? email.trim().toLowerCase() : null;
        if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber.trim();
        if (trackingId !== undefined) updateData.trackingId = trackingId ? trackingId.trim() : null;
        if (invoiceNumber !== undefined) updateData.invoiceNumber = invoiceNumber ? invoiceNumber.trim() : null;
        if (message !== undefined) updateData.message = message;
        if (shippingAddress !== undefined) updateData.shippingAddress = shippingAddress;
        if (billingAddress !== undefined) updateData.billingAddress = billingAddress;
        if (totalAmount !== undefined) updateData.totalAmount = totalAmount === null ? null : Number(totalAmount);
        if (products !== undefined) updateData.products = mergedProducts;
        if (fromAddressId !== undefined) updateData.fromAddressId = validFromAddressId; // Assign validated ID or null

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: "No valid fields provided for update." });
        }


        const updatedOrder = await prisma.order.update({
            where: { orderId },
            data: updateData
        });

        backupOrderToFirebase(updatedOrder);

        res.status(200).json({ message: "Order updated successfully", order: updatedOrder });

    } catch (error) {
        console.error("Error updating order details:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: "Order not found." });
        }
        if (error.code === 'P2003' && error.meta?.field_name?.includes('fromAddressId')) {
            return res.status(400).json({ error: 'Invalid From Address ID provided.' });
        }
        res.status(500).json({ error: "Failed to update order details", details: error.message });
    }
};

// Fetch Orders with fromAddress populated
export const getOrders = async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                fromAddress: true, // Populates the related FromAddress object
            },
        });
        res.json(orders);
    } catch (error) {
        console.error("Error fetching orders:", error);
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