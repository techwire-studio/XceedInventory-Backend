import prisma from '../config/db.js';
import generateProductId from '../utils/idGenerator.js';

export const addProduct = async (data) => {
    const { name, category, subCategory, datasheetLink, description, packageInfo, ...rest } = data;

    let specifications = { ...rest };
    if (packageInfo) {
        specifications.package = packageInfo;
    }

    return await prisma.product.create({
        data: {
            id: generateProductId(),
            name,
            category,
            subCategory,
            datasheetLink,
            description,
            specifications
        }
    });
};