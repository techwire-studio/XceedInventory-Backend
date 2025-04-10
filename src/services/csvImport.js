import fs from 'fs';
import csv from 'csv-parser';
import prisma from '../config/db.js';
import generateProductId from '../utils/idGenerator.js';

async function importCSV(filePath, importMode) {
  console.time('Total CSV Import Time');

  const productsToProcess = [];
  const categoriesMap = new Map();
  const names = new Set();

  // Step 1: Parse CSV
  console.time('CSV Parsing Time');
  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath, { highWaterMark: 256 * 1024 })
      .pipe(csv({ skipLines: 0, strict: false }))
      .on('data', (row) => {
        const product = {
          source: row['Source']?.trim() || null,
          mainCategory: row['Main Category']?.trim() || '-',
          category: row['Category']?.trim() || '-',
          subCategory: row['Sub-category']?.trim() || null,
          name: row['Product Name/Part No.']?.trim() || '-',
          datasheetLink: row['Datasheet Link (PDF)']?.trim() || null,
          description: row['Description']?.trim() || null,
          specifications: {}
        };

        const standardFields = new Set([
          'Source', 'Main Category', 'Category', 'Sub-category',
          'Product Name/Part No.', 'Datasheet Link (PDF)', 'Description'
        ]);

        for (const key in row) {
          if (!standardFields.has(key) && row[key]?.trim?.()) {
            product.specifications[key] = row[key].trim();
          }
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
        names.add(product.name);
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
// Replace the category upsert code with this approach
const categoryIds = new Map();
const categoryEntries = [...categoriesMap.entries()];
const batchSize = 50;

for (let i = 0; i < categoryEntries.length; i += batchSize) {
  const batch = categoryEntries.slice(i, i + batchSize);
  await Promise.all(batch.map(async ([key, cat]) => {
    // First try to find the category
    let category = await prisma.categories.findFirst({
      where: {
        mainCategory: cat.mainCategory,
        category: cat.category,
        subCategory: cat.subCategory
      }
    });
    
    // If it doesn't exist, create it
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
  }));
}
  console.log(`Upserted ${categoryIds.size} categories`);
  console.timeEnd('Category Population Time');

  // Step 3: Assign categoryId
  console.time('Category ID Assignment Time');
  productsToProcess.forEach(product => {
    product.categoryId = categoryIds.get(product.categoryKey);
    delete product.mainCategory;
    delete product.category;
    delete product.subCategory;
    delete product.categoryKey;
  });
  console.timeEnd('Category ID Assignment Time');

  // Step 4: Fetch Existing Products
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
  console.log(`Fetched ${existingProducts.length} existing products`);
  console.timeEnd('Database Fetch Time');

  // Step 5: Process Products
  console.time('Product Processing Time');
  const existingMap = new Map();
  existingProducts.forEach(product => {
    const key = `${product.name}|${JSON.stringify(product.specifications, Object.keys(product.specifications).sort())}`;
    existingMap.set(key, product.id);
  });

  const toCreate = [];
  const toUpdate = [];

  productsToProcess.forEach(product => {
    const specKey = JSON.stringify(product.specifications, Object.keys(product.specifications).sort());
    const key = `${product.name}|${specKey}`;
    const existingId = existingMap.get(key);

    if (existingId) {
      if (importMode === 'overwrite') {
        toUpdate.push({ where: { id: existingId }, data: product });
      }
    } else {
      toCreate.push({ ...product, id: generateProductId() });
    }
  });
  console.log(`To create: ${toCreate.length}, To update: ${toUpdate.length}`);
  console.timeEnd('Product Processing Time');

// Step 6: Write to Database
console.time('Database Write Time');
const writeBatchSize = 250; // Reduced batch size

// Create operations can be done in parallel batches
if (toCreate.length > 0) {
  const createBatches = [];
  for (let i = 0; i < toCreate.length; i += writeBatchSize) {
    createBatches.push(prisma.product.createMany({
      data: toCreate.slice(i, i + writeBatchSize),
      skipDuplicates: true,
    }));
  }
  const createResults = await Promise.all(createBatches);
  console.log(`Created ${createResults.reduce((sum, r) => sum + r.count, 0)} products`);
}

// For updates, process batches sequentially to avoid deadlocks
if (toUpdate.length > 0 && importMode === 'overwrite') {
  let updatedCount = 0;
  
  for (let i = 0; i < toUpdate.length; i += writeBatchSize) {
    const batch = toUpdate.slice(i, i + writeBatchSize);
    // Process each batch in a sequential transaction
    await prisma.$transaction(
      batch.map(update => prisma.product.update(update)),
      { isolationLevel: 'Serializable' } // Add isolation level
    );
    
    updatedCount += batch.length;
    console.log(`Updated ${updatedCount}/${toUpdate.length} products`);
  }
}
console.timeEnd('Database Write Time');

  console.timeEnd('Total CSV Import Time');
  return true;
}

export default importCSV;