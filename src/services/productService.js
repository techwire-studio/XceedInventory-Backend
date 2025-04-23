import prisma from '../config/db.js';
import generateProductId from '../utils/idGenerator.js';

// Helper function to parse integer fields, defaulting to null
const parseIntOrNull = (value) => {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
};

export const addProduct = async (data) => {
    const {
        source,
        name,
        cpn,
        mainCategory,
        category,
        subCategory,
        datasheetLink,
        description,
        manufacturer,
        mfrPartNumber,
        stockQty,
        spq,
        moq,
        ltwks,
        remarks,
        ...rest
    } = data;

    if (!mainCategory) {
        throw new Error("mainCategory is required.");
    }
    if (!category) {
        throw new Error("category is required.");
    }
    const actualSubCategory = (subCategory === undefined || subCategory === null || subCategory === "-") ? null : subCategory;
    const categoryRecord = await prisma.categories.upsert({
        where: {
            mainCategory_category_subCategory: {
                mainCategory: mainCategory,
                category: category,
                subCategory: actualSubCategory,
            }
        },
        update: {},
        create: {
            mainCategory: mainCategory,
            category: category,
            subCategory: actualSubCategory,
        },
    });
    const categoryId = categoryRecord.id;

    const cpnValue = (cpn === undefined || cpn === null || cpn === '') ? "-" : cpn;
    const manufacturerValue = (manufacturer === undefined || manufacturer === null || manufacturer === '') ? "-" : manufacturer;
    const mfrPartNumberValue = (mfrPartNumber === undefined || mfrPartNumber === null || mfrPartNumber === '') ? "-" : mfrPartNumber;
    const stockQtyValue = parseIntOrNull(stockQty);
    const spqValue = parseIntOrNull(spq);
    const moqValue = parseIntOrNull(moq);
    const ltwksValue = (ltwks === undefined || ltwks === null || ltwks === '') ? "-" : ltwks;
    const remarksValue = (remarks === undefined || remarks === null || remarks === '') ? "-" : remarks;

    let specifications = { ...rest };
    if (Object.keys(specifications).length === 0) {
        specifications = null;
    }
    return await prisma.product.create({
        data: {
            id: generateProductId(),
            cpn: cpnValue,
            source: (source === undefined || source === null || source === '') ? null : source,
            name: (name === undefined || name === null || name === '') ? "-" : name,
            datasheetLink: (datasheetLink === undefined || datasheetLink === null || datasheetLink === '') ? null : datasheetLink,
            description: (description === undefined || description === null || description === '') ? null : description,
            manufacturer: manufacturerValue,
            mfrPartNumber: mfrPartNumberValue,
            stockQty: stockQtyValue,
            spq: spqValue,
            moq: moqValue,
            ltwks: ltwksValue,
            remarks: remarksValue,
            specifications: specifications,
            categoryId: categoryId,
        }
    });
};