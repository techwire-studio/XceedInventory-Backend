import { addProduct } from '../services/productService.js';
import importCSV from '../services/csvImport.js';
import prisma from '../config/db.js';
import fs from 'fs';


const parseIntOrNull = (value) => {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
};

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
            if (err) {
                console.error("Error deleting file:", err);
            } else {
                console.log(`Successfully deleted file: ${req.file.path}`);
            }
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

        // Fetch paginated products
        const products = await prisma.product.findMany({
            skip,
            take: limit,
            orderBy: [
                { createdAt: 'desc' },
                { id: 'asc' }
            ],
            include: {
                category: {
                    select: {
                        mainCategory: true,
                        category: true,
                        subCategory: true
                    }
                }
            }
        });

        // Get total product count
        const totalProducts = await prisma.product.count();

        // Calculate total pages
        const totalPages = Math.ceil(totalProducts / limit);

        // Handle invalid page number request
        if (page > totalPages && totalProducts > 0) {
            return res.status(400).json({ error: "Page number exceeds total pages" });
        }

        // Send the response
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

export const getCategories = async (req, res) => {
    try {
        // Fetch all categories from the database
        const categories = await prisma.categories.findMany({
            select: {
                id: true,
                mainCategory: true,
                category: true,
                subCategory: true,
            },
        });

        // First-pass: Create the category structure with counts
        const categoryStats = {};
        const categoryMap = {};

        // Count categories and subcategories
        categories.forEach((cat) => {
            // Initialize main category stats if needed
            if (!categoryStats[cat.mainCategory]) {
                categoryStats[cat.mainCategory] = {
                    categoryCount: 0,
                    categories: {}
                };
                categoryMap[cat.mainCategory] = {};
            }

            // Initialize category if needed and count subcategories
            if (!categoryStats[cat.mainCategory].categories[cat.category]) {
                categoryStats[cat.mainCategory].categories[cat.category] = {
                    subCategoryCount: 0
                };
                categoryStats[cat.mainCategory].categoryCount++;
                categoryMap[cat.mainCategory][cat.category] = [];
            }

            categoryStats[cat.mainCategory].categories[cat.category].subCategoryCount++;

            // Store the category entry
            categoryMap[cat.mainCategory][cat.category].push({
                id: cat.id,
                subCategory: cat.subCategory || null,
            });
        });

        // Second-pass: Format according to special rules
        const formattedCategories = [];

        Object.keys(categoryMap).forEach(mainCategory => {
            const mainCategoryData = {
                mainCategory,
                categories: []
            };

            const categoriesInMain = categoryMap[mainCategory];
            const stats = categoryStats[mainCategory];

            // Case 1: Main category has only one category
            if (stats.categoryCount === 1) {
                const singleCategoryName = Object.keys(categoriesInMain)[0];
                const subCategories = categoriesInMain[singleCategoryName];

                // Add subcategories directly to main category
                if (subCategories.length > 1) {
                    mainCategoryData.categories = subCategories;
                } else if (subCategories.length == 1) {
                    mainCategoryData.id = subCategories[0].id; // If only one subcategory
                    mainCategoryData.categories = null;
                }
            }
            // Normal case: Main category has multiple categories
            else {
                Object.keys(categoriesInMain).forEach(categoryName => {
                    const subCategories = categoriesInMain[categoryName];
                    const categoryData = { category: categoryName };

                    // Case 2: Category has only one subcategory
                    if (subCategories.length === 1) {
                        categoryData.id = subCategories[0].id;
                    } else {
                        categoryData.subCategories = subCategories;
                    }

                    mainCategoryData.categories.push(categoryData);
                });
            }

            formattedCategories.push(mainCategoryData);
        });

        res.status(200).json({
            message: "Categories fetched successfully",
            data: formattedCategories,
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch categories", details: e.message });
    }
};
export const getProductsByCategory = async (req, res) => {
    try {
        const { id } = req.params; // Category ID from the URL
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        if (!id) {
            return res.status(400).json({ error: "Category ID is required" });
        }
        if (page < 1 || limit < 1) {
            return res.status(400).json({ error: "Page and limit must be positive integers" });
        }

        const skip = (page - 1) * limit;

        const totalProducts = await prisma.product.count({
            where: { categoryId: id },
        });

        const totalPages = Math.ceil(totalProducts / limit);

        if (page > totalPages && totalProducts > 0) {
            return res.status(400).json({ error: "Page number exceeds total pages" });
        }

        // Fetch paginated products associated with the categoryId
        const products = await prisma.product.findMany({
            where: {
                categoryId: id,
            },
            select: {
                id: true,
                cpn: true,
                name: true,
                source: true,
                manufacturer: true,
                mfrPartNumber: true,
                stockQty: true,
                spq: true,
                moq: true,
                ltwks: true,
                remarks: true,
                datasheetLink: true,
                description: true,
                specifications: true,
                addedToCart: true,
                createdAt: true,
                category: {
                    select: {
                        mainCategory: true,
                        category: true,
                        subCategory: true,
                    },
                },
            },
            skip,
            take: limit,
            orderBy: [
                { createdAt: "desc" },
                { id: "asc" },
            ],
        });

        if (!products.length && totalProducts === 0) {
            return res.status(200).json({
                message: "No products found for this category",
                products: [],
                totalProducts: 0,
                totalPages: 0,
                currentPage: page,
            });
        }

        res.status(200).json({
            message: "Products fetched successfully",
            products,
            totalProducts,
            totalPages,
            currentPage: page,
        });
    } catch (error) {
        console.error("Error fetching products by category:", error);
        res.status(500).json({
            error: "Failed to fetch products by category",
            details: error.message,
        });
    }
};


export const deleteProduct = async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: "Product ID is required." });
    }

    try {
        // Attempt to delete the product
        await prisma.product.delete({
            where: { id: id },
        });

        res.status(200).json({ message: `Product with ID ${id} deleted successfully.` });

    } catch (error) {
        // Handle case where the product doesn't exist
        if (error.code === 'P2025') {
            return res.status(404).json({ error: `Product with ID ${id} not found.` });
        }
        // Handle other potential database or unexpected errors
        console.error("Error deleting product:", error);
        res.status(500).json({ error: 'Failed to delete product', details: error.message });
    }
};


export const updateProduct = async (req, res) => {
    const { id } = req.params;
    const data = req.body;

    if (!id) {
        return res.status(400).json({ error: "Product ID is required." });
    }
    const {
        source,
        name,
        mainCategory,
        category,
        subCategory,
        datasheetLink,
        description,
        addedToCart,
        cpn,
        manufacturer,
        mfrPartNumber,
        stockQty,
        spq,
        moq,
        ltwks,
        remarks,
        ...specificationsData
    } = data;

    try {
        const updateData = {};

        if (mainCategory !== undefined || category !== undefined || subCategory !== undefined) {
            const effectiveMainCategory = mainCategory;
            const effectiveCategory = category;

            if (effectiveMainCategory !== "-" && (!effectiveMainCategory || typeof effectiveMainCategory !== 'string' || effectiveMainCategory.trim() === '')) {
                return res.status(400).json({ error: "mainCategory must be a non-empty string or '-' if updating category information." });
            }
            if (effectiveCategory !== "-" && (!effectiveCategory || typeof effectiveCategory !== 'string' || effectiveCategory.trim() === '')) {
                return res.status(400).json({ error: "category must be a non-empty string or '-' if updating category information." });
            }

            const mainCatForDb = effectiveMainCategory;
            const catForDb = effectiveCategory;
            const actualSubCategory = (subCategory === undefined || subCategory === null || subCategory === "-") ? null : subCategory;


            const categoryRecord = await prisma.categories.upsert({
                where: {
                    mainCategory_category_subCategory: {
                        mainCategory: mainCatForDb,
                        category: catForDb,
                        subCategory: actualSubCategory,
                    }
                },
                update: {},
                create: {
                    mainCategory: mainCatForDb,
                    category: catForDb,
                    subCategory: actualSubCategory,
                },
            });
            updateData.categoryId = categoryRecord.id;
        }

        if (cpn !== undefined) updateData.cpn = (cpn === null || cpn === '') ? "-" : cpn;
        if (source !== undefined) updateData.source = source === "-" ? "-" : (source || null);
        if (name !== undefined) updateData.name = (name === null || name === '') ? "-" : name;
        if (datasheetLink !== undefined) updateData.datasheetLink = datasheetLink === "-" ? "-" : (datasheetLink || null);
        if (description !== undefined) updateData.description = description === "-" ? "-" : (description || null);
        if (manufacturer !== undefined) updateData.manufacturer = (manufacturer === null || manufacturer === '') ? "-" : manufacturer;
        if (mfrPartNumber !== undefined) updateData.mfrPartNumber = (mfrPartNumber === null || mfrPartNumber === '') ? "-" : mfrPartNumber;
        if (stockQty !== undefined) updateData.stockQty = parseIntOrNull(stockQty);
        if (spq !== undefined) updateData.spq = parseIntOrNull(spq);
        if (moq !== undefined) updateData.moq = parseIntOrNull(moq);
        if (ltwks !== undefined) updateData.ltwks = (ltwks === null || ltwks === '') ? "-" : ltwks;
        if (remarks !== undefined) updateData.remarks = (remarks === null || remarks === '') ? "-" : remarks;
        if (addedToCart !== undefined && typeof addedToCart === 'boolean') {
            updateData.addedToCart = addedToCart;
        }

        if (Object.keys(specificationsData).length > 0) {
            updateData.specifications = specificationsData;
        } else if (data.hasOwnProperty('specifications') && data.specifications === null) {
            updateData.specifications = null;
        }


        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: "No valid fields provided for update. Nothing changed." });
        }

        const updatedProduct = await prisma.product.update({
            where: { id: id },
            data: updateData,
            include: {
                category: {
                    select: {
                        mainCategory: true,
                        category: true,
                        subCategory: true
                    }
                }
            }
        });

        res.status(200).json({ message: `Product with ID ${id} updated successfully.`, product: updatedProduct });

    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: `Product with ID ${id} not found.` });
        }
        console.error("Error updating product:", error);
        res.status(500).json({ error: 'Failed to update product', details: error.message });
    }
};