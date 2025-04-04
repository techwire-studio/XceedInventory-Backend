import { addProduct } from '../services/productService.js';
import importCSV from '../services/csvImport.js';
import prisma from '../config/db.js';
export const createProduct = async (req, res) => {
    try {
        const product = await addProduct(req.body);
        console.log("Product added successfully");
        res.status(201).json({ message: 'Product added successfully', product });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add product', details: error.message });
    }
};

export const uploadCSV = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    const importMode = req.body.importMode === "overwrite" ? "overwrite" : "skip";

    try {
        await importCSV(req.file.path, importMode);
        // Delete file after successful import
        fs.unlink(req.file.path, (err) => {
            if (err) console.error("Error deleting file:", err);
        });
        res.json({ message: `CSV imported successfully in ${importMode} mode!` });
    } catch (error) {
        res.status(500).json({ error: "Import failed", details: error.message });
    }
};

// export const getAllProducts = async (req, res) => {
//     try {
//         const products = await prisma.product.findMany();
//         res.status(200).json(products);
//     } catch (error) {
//         res.status(500).json({ error: "Failed to fetch products", details: error.message });
//     }
// };
export const getAllProducts = async (req, res) => {
    try {
        // Get page number and limit from query params, default: page 1, limit 20
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        // Fetch paginated products sorted by `createdAt` (newest first), and break ties using `id`
        const products = await prisma.product.findMany({
            skip,
            take: limit,
            orderBy: [
                { createdAt: 'desc' },
                { id: 'asc' }
            ]
        });
        // Get total product count
        const totalProducts = await prisma.product.count();

        // Calculate total pages
        const totalPages = Math.ceil(totalProducts / limit);

        if (page > totalPages && totalProducts > 0) {
            return res.status(400).json({ error: "Page number exceeds total pages" });
        }

        res.status(200).json({
            products,
            totalProducts,
            totalPages,
            currentPage: page
        });

    } catch (error) {
        res.status(500).json({ error: "Failed to fetch products", details: error.message });
    }
};

export const searchProducts = async (req, res) => {
    try {
        const { query } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        if (!query) {
            return res.status(400).json({ error: "Query parameter is required" });
        }

        // Count total matching products
        const totalProducts = await prisma.product.count({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { id: query }
                ]
            }
        });

        // Calculate total pages
        const totalPages = Math.ceil(totalProducts / limit);

        // Prevent fetching non-existent pages
        if (page > totalPages && totalProducts > 0) {
            return res.status(400).json({ error: "Page number exceeds total pages" });
        }

        // Fetch products
        const products = await prisma.product.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { id: query }
                ]
            },
            skip,
            take: limit,
            orderBy: [
                { createdAt: 'desc' },
                { id: 'asc' }
            ]
        });

        res.status(200).json({
            products,
            totalProducts,
            totalPages,
            currentPage: page
        });

    } catch (error) {
        res.status(500).json({ error: "Failed to search products", details: error.message });
    }
};
