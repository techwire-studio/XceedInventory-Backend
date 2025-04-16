import prisma from '../config/db.js';
import generateProductId from '../utils/idGenerator.js';

export const addProduct = async (data) => {
    const {
        source,
        name,
        mainCategory,
        category,
        subCategory,
        datasheetLink,
        description,
        packageInfo,
        ...rest
    } = data;


    if (!mainCategory || mainCategory === "-") {
        throw new Error("mainCategory is required.");
    }
    if (!category || category === "-") {
        throw new Error("category is required.");
    }

    const actualSubCategory = subCategory && subCategory !== "-" ? subCategory : null;

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
            mainCategory: mainCategory || "-",
            category: category,
            subCategory: actualSubCategory,
        },
    });

    const categoryId = categoryRecord.id; // Get the ID of the category record

    let specifications = { ...rest };
    if (packageInfo) {
        specifications.package = packageInfo;
    }
    if (Object.keys(specifications).length === 0) {
        specifications = null;
    }

    return await prisma.product.create({
        data: {
            id: generateProductId(),
            source: source || null,
            name: name || "-",
            datasheetLink: datasheetLink || null,
            description: description || null,
            specifications: specifications,
            categoryId: categoryId,
        }
    });
};

