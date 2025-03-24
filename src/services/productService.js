import prisma from '../config/db.js';
import generateProductId from '../utils/idGenerator.js';

export const addProduct = async (data) => {
    const { source, name, mainCategory, category, subCategory, datasheetLink, description, packageInfo, ...rest } = data;

    let specifications = { ...rest };
    if (packageInfo) {
        specifications.package = packageInfo;
    }

    return await prisma.product.create({
        data: {
            id: generateProductId(),
            source: source || null,
            name: name || "-",
            mainCategory: mainCategory || "-",
            category: category || "-",
            subCategory: subCategory || null,
            datasheetLink: datasheetLink || null,
            description: description || null,
            specifications: specifications
        }
    });
};

