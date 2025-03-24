import fs from 'fs';
import csv from 'csv-parser';
import prisma from '../config/db.js';
import generateProductId from '../utils/idGenerator.js';

function areSpecsEqual(specs1, specs2) {
    if (specs1 === specs2) return true;
    if (specs1 == null || specs2 == null) return false;

    const keys1 = Object.keys(specs1).sort();
    const keys2 = Object.keys(specs2).sort();
    if (keys1.length !== keys2.length) return false;

    for (let i = 0; i < keys1.length; i++) {
        const key = keys1[i];
        if (key !== keys2[i]) return false;
        if (specs1[key] !== specs2[key]) return false;
    }
    return true;
}

async function importCSV(filePath, importMode) {
    const productsToProcess = [];
    const names = new Set();

    // Read and parse CSV file
    await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                try {
                    const source = row['Source']?.trim() || null;
                    const mainCategory = row['Main Category']?.trim() || "-";
                    const category = row['Category']?.trim() || "-";
                    const subCategory = row['Sub-category']?.trim() || null;
                    const name = row['Product Name/Part No.']?.trim() || "-";
                    const datasheetLink = row['Datasheet Link (PDF)']?.trim() || null;
                    const description = row['Description']?.trim() || null;

                    const specifications = {};
                    for (const [key, value] of Object.entries(row)) {
                        if (![
                            'Source', 'Main Category', 'Category', 'Sub-category', 'Product Name/Part No.',
                            'Datasheet Link (PDF)', 'Description'
                        ].includes(key) && value?.trim() !== "") {
                            specifications[key] = value.trim();
                        }
                    }

                    productsToProcess.push({ source, mainCategory, category, subCategory, name, datasheetLink, description, specifications });
                    names.add(name);
                } catch (error) {
                    console.error("Error processing row:", error);
                }
            })
            .on('end', resolve)
            .on('error', reject);
    });

    // Fetch existing products
    const existingProducts = await prisma.product.findMany({
        where: { name: { in: [...names] } }
    });

    // Group existing products by name
    const existingMap = existingProducts.reduce((acc, product) => {
        acc[product.name] = acc[product.name] || [];
        acc[product.name].push(product);
        return acc;
    }, {});

    const toCreate = [];
    const toUpdate = [];

    for (const product of productsToProcess) {
        const existing = existingMap[product.name] || [];
        let duplicate = null;

        for (const item of existing) {
            if (areSpecsEqual(item.specifications, product.specifications)) {
                duplicate = item;
                break;
            }
        }

        if (duplicate) {
            if (importMode === 'overwrite') {
                const { id, ...updateData } = product;
                toUpdate.push({
                    where: { id: duplicate.id },
                    data: updateData
                });
            }
        } else {
            toCreate.push({ ...product, id: generateProductId() });
        }
    }

    console.time('CSV Import Time');
    try {
        // Perform updates
        if (toUpdate.length > 0 && importMode === 'overwrite') {
            await prisma.$transaction(
                toUpdate.map(update => prisma.product.update(update)),
                console.log(`Updated ${toUpdate.length} products`));
        }

        // Perform creates
        if (toCreate.length > 0) {
            await prisma.product.createMany({
                data: toCreate,
                skipDuplicates: true
            });
            console.log(`Created ${toCreate.length} products`);
        }

        console.timeEnd('CSV Import Time');
        return true;
    } catch (error) {
        console.error("Import failed:", error);
        throw error;
    }
}

export default importCSV;
