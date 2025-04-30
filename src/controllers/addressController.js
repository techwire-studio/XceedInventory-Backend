import prisma from "../config/db.js";



export const getAllFromAddresses = async (req, res) => {
    try {
        const addresses = await prisma.fromAddress.findMany({
            orderBy: {
                addressLabel: 'asc' 
            }
        });
        res.status(200).json(addresses);
    } catch (error) {
        console.error("Error fetching from addresses:", error);
        res.status(500).json({ error: "Failed to fetch addresses", details: error.message });
    }
};


export const createFromAddress = async (req, res) => {
    const { addressLabel, addressDetails } = req.body;

    // --- Validation ---
    if (!addressLabel || typeof addressLabel !== 'string' || addressLabel.trim() === '') {
        return res.status(400).json({ error: "Address label is required and must be a non-empty string." });
    }
    if (!addressDetails || typeof addressDetails !== 'object' || addressDetails === null || Object.keys(addressDetails).length === 0) {
        return res.status(400).json({ error: "Address details are required and must be a non-empty JSON object." });
    }

    try {
        const newAddress = await prisma.fromAddress.create({
            data: {
                addressLabel: addressLabel.trim(),
                addressDetails: addressDetails
            }
        });
        res.status(201).json({ message: "Address created successfully", address: newAddress });
    } catch (error) {
        if (error.code === 'P2002' && error.meta?.target?.includes('addressLabel')) {
            return res.status(409).json({ error: `An address with the label "${addressLabel}" already exists.` });
        }
        console.error("Error creating from address:", error);
        res.status(500).json({ error: "Failed to create address", details: error.message });
    }
};

export const updateFromAddress = async (req, res) => {
    const { id } = req.params;
    const { addressLabel, addressDetails } = req.body;
    const updateData = {};

    // --- Validation ---
    if (!id) {
        return res.status(400).json({ error: "Address ID is required." });
    }
    if (addressLabel !== undefined) {
        if (typeof addressLabel !== 'string' || addressLabel.trim() === '') {
            return res.status(400).json({ error: "Address label must be a non-empty string if provided." });
        }
        updateData.addressLabel = addressLabel.trim();
    }
    if (addressDetails !== undefined) {
        if (typeof addressDetails !== 'object' || addressDetails === null || Object.keys(addressDetails).length === 0) {
            return res.status(400).json({ error: "Address details must be a non-empty JSON object if provided." });
        }
        updateData.addressDetails = addressDetails;
    }

    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No fields provided for update." });
    }

    try {
        const updatedAddress = await prisma.fromAddress.update({
            where: { id: id },
            data: updateData
        });
        res.status(200).json({ message: "Address updated successfully", address: updatedAddress });
    } catch (error) {
        // Handle potential unique constraint violation on addressLabel update
        if (error.code === 'P2002' && error.meta?.target?.includes('addressLabel')) {
            return res.status(409).json({ error: `An address with the label "${addressLabel}" already exists.` });
        }
        // Handle case where the address to update is not found
        if (error.code === 'P2025') {
            return res.status(404).json({ error: `Address with ID ${id} not found.` });
        }
        console.error("Error updating from address:", error);
        res.status(500).json({ error: "Failed to update address", details: error.message });
    }
};

export const deleteFromAddress = async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: "Address ID is required." });
    }

    try {
        const ordersUsingAddress = await prisma.order.count({
            where: { fromAddressId: id }
        });

        if (ordersUsingAddress > 0) {
            return res.status(400).json({
                error: `Cannot delete address: It is currently assigned to ${ordersUsingAddress} order(s).`
            });
        }

        await prisma.fromAddress.delete({
            where: { id: id }
        });

        res.status(200).json({ message: "Address deleted successfully." });

    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: `Address with ID ${id} not found.` });
        }
        console.error("Error deleting from address:", error);
        res.status(500).json({ error: "Failed to delete address", details: error.message });
    }
};