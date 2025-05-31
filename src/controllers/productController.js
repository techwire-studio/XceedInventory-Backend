import { addProduct } from '../services/productService.js';
import importCSV from '../services/csvImport.js';
import prisma from '../config/db.js';
import fs from 'fs';
import axios from 'axios';


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

        // Fetch products from local database
        const localProducts = await prisma.product.findMany({
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

        // Extract part numbers from local products
        const localPartNumbers = localProducts.map(product => product.id);

        // Fetch products from Waldom API
        const apiKey = 'a2d4c938-d2ea-4046-b327-b2198cee175c';
        const waldomUrl = `https://sandbox.waldomapac.com/api/v1/${apiKey}/InventoryAndPricing/${encodeURIComponent(query)}/0/0/20`;
        let apiProducts = [];
        
        try {
            const response = await axios.get(waldomUrl);
            console.log('Waldom API response:', response.data);
            if (response.data.products && Array.isArray(response.data.products)) {
                apiProducts = response.data.products
                    .filter(product => !localPartNumbers.includes(product.PartNumber))
                    .map(product => ({
                        id: product.PartNumber,
                        name: product.PartNumber || product.Description,
                        specifications: {
                            Manufacturer: product.ManufacturerName || '-',
                            LeadTime: product.LeadTime || '-',
                            MinOrderQuantity: product.MinOrderQuantity || '-',
                            StandardPackQuantity: product.StandardPackQuantity || '-',
                            TotalStockQuantity: product.TotalStockQuantity?.toString() || '0',
                            Rohs: product.Rohs || '-',
                            HTSCode: product.HTSCode || '-'
                        },
                        datasheetLink: product.DataSheetLink || null,
                        imageLink: product.ImageLink || null,
                        pricing: product.Pricing?.PriceBreaks.map(breakPoint => ({
                            quantity: breakPoint.PriceBreakQuantity,
                            price: breakPoint.Price
                        })) || []
                    }));
            }
        } catch (apiError) {
            console.error('Waldom API error:', apiError.message);
            // Continue with local products even if API fails
        }
        console.log('Api products fetched:', apiProducts.length);
        // Combine local and API products
        const combinedProducts = [...localProducts, ...apiProducts];

        // Count total matching products (local only for pagination consistency)
        const totalProducts = await prisma.product.count({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { id: query }
                ]
            }
        }) + apiProducts.length;

        // Calculate total pages
        const totalPages = Math.ceil(totalProducts / limit);

        // Apply pagination to combined products
        const paginatedProducts = combinedProducts.slice(skip, skip + limit);

        res.status(200).json({
            products: paginatedProducts,
            totalProducts,
            totalPages,
            currentPage: page
        });

    } catch (error) {
        res.status(500).json({ error: "Failed to search products", details: error.message });
    }
};

// export const getCategories = async (req, res) => {
//     try {
//         // Fetch all categories from the database
//         const categories = await prisma.categories.findMany({
//             select: {
//                 id: true,
//                 mainCategory: true,
//                 category: true,
//                 subCategory: true,
//                 _count: {
//                     select: {
//                         products: true,
//                     }
//                 }
//             },
//         });

//         // First-pass: Create the category structure with counts
//         const categoryStats = {};
//         const categoryMap = {};
//         const mainCategoryTotalProducts = {};

//         // Count categories, subcategories, and products
//         categories.forEach((cat) => {
//             const productCount = cat._count.products || 0;
//             const mainCat = cat.mainCategory;
//             const category = cat.category;

//             // Initialize main category stats if needed
//             if (!categoryStats[mainCat]) {
//                 categoryStats[mainCat] = {
//                     categoryCount: 0,
//                     categories: {},
//                     totalProducts: 0
//                 };
//                 categoryMap[mainCat] = {};
//                 mainCategoryTotalProducts[mainCat] = 0;
//             }

//             // Initialize category if needed and count subcategories
//             if (!categoryStats[mainCat].categories[category]) {
//                 categoryStats[mainCat].categories[category] = {
//                     subCategoryCount: 0,
//                     totalProducts: 0
//                 };
//                 categoryStats[mainCat].categoryCount++;
//                 categoryMap[mainCat][category] = [];
//             }

//             categoryStats[mainCat].categories[category].subCategoryCount++;
//             categoryStats[mainCat].categories[category].totalProducts += productCount;
//             mainCategoryTotalProducts[mainCat] += productCount;

//             // Store the category entry
//             categoryMap[mainCat][category].push({
//                 id: cat.id,
//                 subCategory: cat.subCategory || null,
//                 productCount
//             });
//         });

//         // Second-pass: Format according to special rules
//         const formattedCategories = [];

//         Object.keys(categoryMap).forEach(mainCategory => {
//             // Skip main categories with zero products
//             if (mainCategoryTotalProducts[mainCategory] === 0) {
//                 return;
//             }

//             const mainCategoryData = {
//                 mainCategory,
//                 categories: [],
//                 productCount: mainCategoryTotalProducts[mainCategory]
//             };

//             const categoriesInMain = categoryMap[mainCategory];
//             const stats = categoryStats[mainCategory];

//             // Case 1: Main category has only one category
//             if (stats.categoryCount === 1) {
//                 const singleCategoryName = Object.keys(categoriesInMain)[0];
//                 const subCategories = categoriesInMain[singleCategoryName];
//                 const categoryProductCount = stats.categories[singleCategoryName].totalProducts;

//                 // Add subcategories directly to main category
//                 if (subCategories.length > 1) {
//                     // Filter out subcategories with zero products
//                     mainCategoryData.categories = subCategories.filter(sub => sub.productCount > 0);
//                 } else if (subCategories.length === 1) {
//                     mainCategoryData.id = subCategories[0].id; // If only one subcategory
//                     mainCategoryData.productCount = subCategories[0].productCount;
//                     mainCategoryData.categories = null;
//                 }
//             }
//             // Normal case: Main category has multiple categories
//             else {
//                 Object.keys(categoriesInMain).forEach(categoryName => {
//                     const subCategories = categoriesInMain[categoryName];
//                     const categoryProductCount = stats.categories[categoryName].totalProducts;

//                     // Skip categories with zero products
//                     if (categoryProductCount === 0) {
//                         return;
//                     }

//                     const categoryData = {
//                         category: categoryName,
//                         productCount: categoryProductCount
//                     };

//                     // Case 2: Category has only one subcategory
//                     if (subCategories.length === 1) {
//                         categoryData.id = subCategories[0].id;
//                         categoryData.productCount = subCategories[0].productCount;
//                     } else {
//                         // Filter out subcategories with zero products
//                         categoryData.subCategories = subCategories.filter(sub => sub.productCount > 0);
//                     }

//                     mainCategoryData.categories.push(categoryData);
//                 });
//             }

//             formattedCategories.push(mainCategoryData);
//         });

//         res.status(200).json({
//             message: "Categories fetched successfully",
//             data: formattedCategories,
//         });
//     } catch (e) {
//         res.status(500).json({ error: "Failed to fetch categories", details: e.message });
//     }
// };
// export const getProductsByCategory = async (req, res) => {
//     try {
//         const { id } = req.params; // Category ID from the URL
//         const page = parseInt(req.query.page) || 1;
//         const limit = parseInt(req.query.limit) || 20;

//         if (!id) {
//             return res.status(400).json({ error: "Category ID is required" });
//         }
//         if (page < 1 || limit < 1) {
//             return res.status(400).json({ error: "Page and limit must be positive integers" });
//         }

//         const skip = (page - 1) * limit;

//         const totalProducts = await prisma.product.count({
//             where: { categoryId: id },
//         });

//         const totalPages = Math.ceil(totalProducts / limit);

//         if (page > totalPages && totalProducts > 0) {
//             return res.status(400).json({ error: "Page number exceeds total pages" });
//         }

//         // Fetch paginated products associated with the categoryId
//         const products = await prisma.product.findMany({
//             where: {
//                 categoryId: id,
//             },
//             select: {
//                 id: true,
//                 cpn: true,
//                 name: true,
//                 source: true,
//                 manufacturer: true,
//                 mfrPartNumber: true,
//                 stockQty: true,
//                 spq: true,
//                 moq: true,
//                 ltwks: true,
//                 remarks: true,
//                 datasheetLink: true,
//                 description: true,
//                 specifications: true,
//                 addedToCart: true,
//                 createdAt: true,
//                 category: {
//                     select: {
//                         mainCategory: true,
//                         category: true,
//                         subCategory: true,
//                     },
//                 },
//             },
//             skip,
//             take: limit,
//             orderBy: [
//                 { createdAt: "desc" },
//                 { id: "asc" },
//             ],
//         });

//         if (!products.length && totalProducts === 0) {
//             return res.status(200).json({
//                 message: "No products found for this category",
//                 products: [],
//                 totalProducts: 0,
//                 totalPages: 0,
//                 currentPage: page,
//             });
//         }

//         res.status(200).json({
//             message: "Products fetched successfully",
//             products,
//             totalProducts,
//             totalPages,
//             currentPage: page,
//         });
//     } catch (error) {
//         console.error("Error fetching products by category:", error);
//         res.status(500).json({
//             error: "Failed to fetch products by category",
//             details: error.message,
//         });
//     }
// };

export const getCategories = async (req, res) => {
    try {
        // Fetch all categories from the database
        const categories = await prisma.categories.findMany({
            select: {
                id: true,
                mainCategory: true,
                category: true,
                subCategory: true,
                _count: {
                    select: {
                        products: true,
                    }
                }
            },
        });

        // Build category structure
        const formattedCategories = [];

        const mainCategoryMap = {};

        categories.forEach(cat => {
            const productCount = cat._count.products || 0;
            const { mainCategory, category, subCategory, id } = cat;

            // Initialize mainCategory if not present
            if (!mainCategoryMap[mainCategory]) {
                mainCategoryMap[mainCategory] = {
                    mainCategory,
                    productCount: 0,
                    categories: {},
                };
            }

            // Initialize category under mainCategory
            if (!mainCategoryMap[mainCategory].categories[category]) {
                mainCategoryMap[mainCategory].categories[category] = {
                    category,
                    productCount: 0,
                    subCategories: [],
                };
            }

            // Update product counts
            mainCategoryMap[mainCategory].productCount += productCount;
            mainCategoryMap[mainCategory].categories[category].productCount += productCount;

            // Push subcategory
            mainCategoryMap[mainCategory].categories[category].subCategories.push({
                id,
                subCategory: subCategory || null,
                productCount,
            });
        });

        // Format into the desired output
        Object.values(mainCategoryMap).forEach(mainCatData => {
            const formattedMainCategory = {
                mainCategory: mainCatData.mainCategory,
                productCount: mainCatData.productCount,
                categories: [],
            };

            Object.values(mainCatData.categories).forEach(catData => {
                formattedMainCategory.categories.push({
                    category: catData.category,
                    productCount: catData.productCount,
                    subCategories: catData.subCategories,
                });
            });

            formattedCategories.push(formattedMainCategory);
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
        const query = req.query.query?.trim(); // Get search query

        if (!id) {
            return res.status(400).json({ error: "Category ID is required" });
        }
        if (page < 1 || limit < 1) {
            return res.status(400).json({ error: "Page and limit must be positive integers" });
        }

        const skip = (page - 1) * limit;

        const whereClause = {
            categoryId: id,
        };

        if (query) {
            let searchKey = null;
            let searchValue = null;
            if (query.includes(':')) {
                const parts = query.split(':', 2);
                if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
                    searchKey = parts[0].trim();
                    searchValue = parts[1].trim();
                    console.log(`Detected key-value search: Key='${searchKey}', Value='${searchValue}'`);
                }
            }

            if (searchKey !== null && searchValue !== null) {
                const numericValue = parseFloat(searchValue);
                const isNumeric = !isNaN(numericValue);

                whereClause.AND = [
                    {
                        OR: [
                            {
                                specifications: {
                                    path: [searchKey],
                                    equals: searchValue,
                                }
                            },
                            ...(isNumeric ? [{
                                specifications: {
                                    path: [searchKey],
                                    equals: numericValue
                                }
                            }] : [])
                        ]
                    }
                ];

            } else {
                // If not key:value format, search only the 'name' field
                whereClause.OR = [
                    { name: { contains: query, mode: 'insensitive' } },
                ];
            }
        }
        console.log("Executing count with WHERE:", JSON.stringify(whereClause, null, 2));
        const totalProducts = await prisma.product.count({
            where: whereClause,
        });

        const totalPages = Math.ceil(totalProducts / limit);

        if (page > totalPages && totalProducts > 0) {
            return res.status(400).json({ error: "Page number exceeds total pages for the current filter/search" });
        }

        console.log("Executing findMany with WHERE:", JSON.stringify(whereClause, null, 2));
        const products = await prisma.product.findMany({
            where: whereClause,
            select: {
                id: true, cpn: true, name: true, source: true, manufacturer: true,
                mfrPartNumber: true, stockQty: true, spq: true, moq: true,
                ltwks: true, remarks: true, datasheetLink: true, description: true,
                specifications: true, addedToCart: true, createdAt: true,
                category: {
                    select: { mainCategory: true, category: true, subCategory: true },
                },
            },
            skip,
            take: limit,
            orderBy: [{ createdAt: "desc" }, { id: "asc" },],
        });

        const message = totalProducts === 0
            ? (query ? "No products found matching your search in this category" : "No products found for this category")
            : "Products fetched successfully";

        res.status(200).json({
            message, products, totalProducts, totalPages, currentPage: page,
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

export const getProductsByMainCategory = async (req, res) => {
    try {
        const { mainCategory } = req.body;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const query = req.query.query?.trim(); // Get search query

        if (!mainCategory) {
            return res.status(400).json({ error: "Main category is required" });
        }
        if (page < 1 || limit < 1) {
            return res.status(400).json({ error: "Page and limit must be positive integers" });
        }

        let categories;
        if (mainCategory === "Schottky-Thyristor") {
            categories = await prisma.categories.findMany({
                where: {
                    mainCategory: { in: ["Schottky", "Thyristor"] }
                },
                select: {
                    id: true
                }
            });
        } else {
            categories = await prisma.categories.findMany({
                where: {
                    mainCategory: mainCategory
                },
                select: {
                    id: true
                }
            });
        }

        if (!categories.length) {
            return res.status(200).json({
                message: "No categories found for this main category",
                products: [],
                totalProducts: 0,
                totalPages: 0,
                currentPage: page
            });
        }

        // Get category IDs
        const categoryIds = categories.map(category => category.id);

        // Build where clause
        const whereClause = {
            categoryId: {
                in: categoryIds
            }
        };

        if (query) {
            let searchKey = null;
            let searchValue = null;
            if (query.includes(':')) {
                const parts = query.split(':', 2);
                if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
                    searchKey = parts[0].trim();
                    searchValue = parts[1].trim();
                    console.log(`Detected key-value search: Key='${searchKey}', Value='${searchValue}'`);
                }
            }

            if (searchKey !== null && searchValue !== null) {
                const numericValue = parseFloat(searchValue);
                const isNumeric = !isNaN(numericValue);

                whereClause.AND = [
                    {
                        OR: [
                            {
                                specifications: {
                                    path: [searchKey],
                                    equals: searchValue,
                                }
                            },
                            ...(isNumeric ? [{
                                specifications: {
                                    path: [searchKey],
                                    equals: numericValue
                                }
                            }] : [])
                        ]
                    }
                ];
            } else {
                whereClause.OR = [
                    { name: { contains: query, mode: 'insensitive' } },
                ];
            }
        }

        console.log("Executing count with WHERE:", JSON.stringify(whereClause, null, 2));
        const totalProducts = await prisma.product.count({
            where: whereClause,
        });

        const totalPages = Math.ceil(totalProducts / limit);
        const skip = (page - 1) * limit;

        if (page > totalPages && totalProducts > 0) {
            return res.status(400).json({ error: "Page number exceeds total pages for the current filter/search" });
        }

        console.log("Executing findMany with WHERE:", JSON.stringify(whereClause, null, 2));
        const products = await prisma.product.findMany({
            where: whereClause,
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

        const message = totalProducts === 0
            ? (query ? "No products found matching your search in this main category" : "No products found for this main category")
            : "Products fetched successfully";

        res.status(200).json({
            message,
            products,
            totalProducts,
            totalPages,
            currentPage: page
        });
    } catch (error) {
        console.error("Error fetching products by main category:", error);
        res.status(500).json({
            error: "Failed to fetch products by main category",
            details: error.message
        });
    }
};