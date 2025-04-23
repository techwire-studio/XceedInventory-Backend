import fs from 'fs';
import csv from 'csv-parser';
import prisma from '../config/db.js';
import generateProductId from '../utils/idGenerator.js';

// Helper function to parse integer fields, defaulting to null
const parseIntOrNull = (value) => {
  const trimmed = value?.trim();
  if (trimmed === undefined || trimmed === null || trimmed === '') {
    return null;
  }
  const parsed = parseInt(trimmed, 10);
  return isNaN(parsed) ? null : parsed;
};


async function importCSV(filePath, importMode) {
  console.time('Total CSV Import Time');

  const productsToProcess = [];
  const categoriesMap = new Map();
  const names = new Set();

  // Step 1: Parse CSV
  console.time('CSV Parsing Time');
  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath, { highWaterMark: 256 * 1024 })
      .pipe(csv({
        skipLines: 0,
        strict: false,
        mapHeaders: ({ header }) => header.trim() // Trim headers
      }))
      .on('data', (row) => {
        const product = {
          source: row['Source']?.trim() || null,
          mainCategory: row['Main Category']?.trim() || '-',
          category: row['Category']?.trim() || '-',
          subCategory: row['Sub-category']?.trim() || null,
          name: row['Product Name/Part No.']?.trim() || '-',
          datasheetLink: row['Datasheet Link (PDF)']?.trim() || null,
          description: row['Description']?.trim() || null,
          specifications: {},
          cpn: row['CPN']?.trim() || '-',
          manufacturer: row['Manufacturer']?.trim() || '-',
          mfrPartNumber: row['Mfr Part #']?.trim() || '-',
          stockQty: parseIntOrNull(row['Stock Qty']),
          spq: parseIntOrNull(row['SPQ']),
          moq: parseIntOrNull(row['MOQ']),
          ltwks: row['LTWKS']?.trim() || '-',
          remarks: row['Remarks']?.trim() || '-',
        };

        const standardFields = new Set([
          'Source', 'Main Category', 'Category', 'Sub-category',
          'Product Name/Part No.', 'Datasheet Link (PDF)', 'Description',
          'CPN', 'Manufacturer', 'Mfr Part #', 'Stock Qty', 'SPQ', 'MOQ',
          'LTWKS', 'Remarks'
        ]);

        for (const key in row) {
          if (!standardFields.has(key) && row[key]?.trim?.()) {
            product.specifications[key] = row[key].trim();
          }
        }
        if (Object.keys(product.specifications).length === 0) {
          product.specifications = null;
        }

        if (product.mainCategory === '-' || product.category === '-') return;

        const categoryKey = `${product.mainCategory}|${product.category}|${product.subCategory || ''}`;
        if (!categoriesMap.has(categoryKey)) {
          categoriesMap.set(categoryKey, {
            mainCategory: product.mainCategory,
            category: product.category,
            subCategory: product.subCategory
          });
        }

        productsToProcess.push({ ...product, categoryKey });
        if (product.name && product.name !== '-') {
          names.add(product.name);
        }
      })
      .on('end', () => {
        console.log(`Parsed ${productsToProcess.length} products, ${categoriesMap.size} categories`);
        resolve();
      })
      .on('error', reject);
  });
  console.timeEnd('CSV Parsing Time');

  // Step 2: Populate Categories (Handle null subCategory in where clause)
  console.time('Category Population Time');
  const categoryIds = new Map();
  const categoryEntries = [...categoriesMap.entries()];
  const batchSize = 50; // Kept original batch size

  for (let i = 0; i < categoryEntries.length; i += batchSize) {
    const batch = categoryEntries.slice(i, i + batchSize);
    await Promise.all(batch.map(async ([key, cat]) => {
      try {
        let category = await prisma.categories.findFirst({
          where: {
            mainCategory: cat.mainCategory,
            category: cat.category,
            subCategory: cat.subCategory
          }
        });

        if (!category) {
          category = await prisma.categories.create({
            data: {
              mainCategory: cat.mainCategory,
              category: cat.category,
              subCategory: cat.subCategory
            }
          });
        }
        categoryIds.set(key, category.id);
      } catch (error) {
        console.error(`Error processing category: ${key}`, error);
      }
    }));
  }
  console.log(`Upserted or found ${categoryIds.size} categories`);
  console.timeEnd('Category Population Time');


  // Step 3: Assign categoryId & cleanup temp fields
  console.time('Category ID Assignment Time');
  const validProductsForDb = [];
  productsToProcess.forEach(product => {
    const assignedCategoryId = categoryIds.get(product.categoryKey);
    if (assignedCategoryId) {
      product.categoryId = assignedCategoryId;
      delete product.mainCategory;
      delete product.category;
      delete product.subCategory;
      delete product.categoryKey;
      validProductsForDb.push(product);
    } else {
      console.warn(`Skipping product ${product.name} as category could not be resolved.`);
    }
  });
  console.timeEnd('Category ID Assignment Time');


  // Step 4: Fetch Existing Products (using 'name' as originally implemented)
  console.time('Database Fetch Time');
  const nameArray = [...names];
  const fetchBatchSize = 1000;
  const fetchPromises = [];
  for (let i = 0; i < nameArray.length; i += fetchBatchSize) {
    fetchPromises.push(prisma.product.findMany({
      where: { name: { in: nameArray.slice(i, i + fetchBatchSize) } },
      select: { id: true, name: true, specifications: true }
    }));
  }
  const existingProducts = (await Promise.all(fetchPromises)).flat();
  console.log(`Fetched ${existingProducts.length} existing products based on name`);
  console.timeEnd('Database Fetch Time');


  // Step 5: Process Products (using name + sorted spec key for matching)
  console.time('Product Processing Time');
  const existingMap = new Map();
  existingProducts.forEach(product => {
    const specKey = JSON.stringify(product.specifications || {}, Object.keys(product.specifications || {}).sort());
    const key = `${product.name}|${specKey}`;
    existingMap.set(key, product.id);
  });

  const toCreate = [];
  const toUpdate = [];

  validProductsForDb.forEach(product => {
    const specKey = JSON.stringify(product.specifications || {}, Object.keys(product.specifications || {}).sort());
    const key = `${product.name}|${specKey}`;
    const existingId = existingMap.get(key);

    const productData = {
      cpn: product.cpn,
      source: product.source,
      name: product.name,
      datasheetLink: product.datasheetLink,
      description: product.description,
      manufacturer: product.manufacturer,
      mfrPartNumber: product.mfrPartNumber,
      stockQty: product.stockQty,
      spq: product.spq,
      moq: product.moq,
      ltwks: product.ltwks,
      remarks: product.remarks,
      specifications: product.specifications,
      categoryId: product.categoryId,
    };


    if (existingId) {
      if (importMode === 'overwrite') {
        toUpdate.push({ where: { id: existingId }, data: productData });
      }
    } else {
      toCreate.push({ ...productData, id: generateProductId() });
    }
  });
  console.log(`To create: ${toCreate.length}, To update: ${toUpdate.length}`);
  console.timeEnd('Product Processing Time');

  // Step 6: Write to Database (Keep existing batching/transaction logic)
  console.time('Database Write Time');
  const writeBatchSize = 250;
  let createdCount = 0;
  let updatedCount = 0;

  if (toCreate.length > 0) {
    for (let i = 0; i < toCreate.length; i += writeBatchSize) {
      const batch = toCreate.slice(i, i + writeBatchSize);
      try {
        const createResult = await prisma.product.createMany({
          data: batch,
          skipDuplicates: true,
        });
        createdCount += createResult.count;
      } catch (error) {
        console.error(`Error during product creation batch (start index ${i}):`, error);
      }
    }
    console.log(`Created ${createdCount} products`);
  }


  // Update operations
  if (toUpdate.length > 0 && importMode === 'overwrite') {
    for (let i = 0; i < toUpdate.length; i += writeBatchSize) { // Iterate update batches
      const batch = toUpdate.slice(i, i + writeBatchSize);
      try {
        await prisma.$transaction(
          batch.map(update => prisma.product.update(update)),
          { isolationLevel: 'Serializable' }
        );
        updatedCount += batch.length;
      } catch (error) {
        console.error(`Error during product update batch (start index ${i}):`, error);
      }
      console.log(`Updated ${updatedCount}/${toUpdate.length} products...`); // Log progress
    }
    console.log(`Finished updating ${updatedCount} products.`);
  }
  console.timeEnd('Database Write Time');

  console.timeEnd('Total CSV Import Time');
  return true;
}

export default importCSV;