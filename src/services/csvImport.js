import fs from 'fs';
import csv from 'csv-parser';
import prisma from '../config/db.js';
import generateProductId from '../utils/idGenerator.js';
import os from 'os';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { fileURLToPath } from 'url';

const specsHashCache = new WeakMap();

function getSpecsHash(specs) {
  if (!specs) return '';
  if (specsHashCache.has(specs)) return specsHashCache.get(specs);
  
  const sortedKeys = Object.keys(specs).sort();
  const hash = sortedKeys.map(key => `${key}:${specs[key]}`).join('|');
  specsHashCache.set(specs, hash);
  return hash;
}

function areSpecsEqual(specs1, specs2) {
  if (specs1 === specs2) return true;
  if (specs1 == null || specs2 == null) return false;
  return getSpecsHash(specs1) === getSpecsHash(specs2);
}

if (!isMainThread) {
  parentPort.on('message', data => {
    const { products, serializedExistingMap, importMode } = data;
    const existingMap = new Map(Object.entries(serializedExistingMap));
    const result = processProducts(products, existingMap, importMode);
    parentPort.postMessage(result);
  });

  function processProducts(products, existingMap, importMode) {
    const toCreate = [];
    const toUpdate = [];

    for (const product of products) {
      const existing = existingMap.get(product.name) || [];
      let duplicate = null;

      const productSpecKeys = Object.keys(product.specifications || {}).sort();
      
      existingLoop: for (const item of existing) {
        const itemSpecKeys = Object.keys(item.specifications || {}).sort();
        
        if (itemSpecKeys.length !== productSpecKeys.length) continue;
        
        for (let i = 0; i < productSpecKeys.length; i++) {
          if (productSpecKeys[i] !== itemSpecKeys[i]) continue existingLoop;
        }
        
        for (let i = 0; i < productSpecKeys.length; i++) {
          const key = productSpecKeys[i];
          if (item.specifications[key] !== product.specifications[key]) {
            continue existingLoop;
          }
        }
        
        duplicate = item;
        break;
      }

      if (duplicate) {
        if (importMode === 'overwrite') {
          toUpdate.push({
            where: { id: duplicate.id },
            data: product
          });
        }
      } else {
        toCreate.push({ ...product, id: generateProductId() });
      }
    }

    return { toCreate, toUpdate };
  }
}

async function processWithWorkers(productsToProcess, existingMap, importMode) {
  const numCPUs = Math.min(
    Math.max(1, os.cpus().length - 1),
    productsToProcess.length > 100000 ? os.cpus().length : Math.ceil(os.cpus().length * 0.75)
  );
  const batchItemSize = Math.ceil(productsToProcess.length / numCPUs);

  const serializedExistingMap = {};
  for (const [key, value] of existingMap.entries()) {
    serializedExistingMap[key] = value;
  }
  
  const workerPromises = [];
  const __filename = fileURLToPath(import.meta.url);
  
  for (let i = 0; i < numCPUs; i++) {
    const start = i * batchItemSize;
    const end = Math.min(start + batchItemSize, productsToProcess.length);
    const productBatch = productsToProcess.slice(start, end);
    
    if (productBatch.length === 0) continue;
    
    const worker = new Worker(__filename, {
      workerData: { threadNumber: i }
    });
    
    const workerPromise = new Promise((resolve, reject) => {
      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', code => {
        if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
      });
      
      worker.postMessage({
        products: productBatch,
        serializedExistingMap,
        importMode
      });
    }).finally(() => worker.terminate());
    
    workerPromises.push(workerPromise);
  }
  
  const results = await Promise.all(workerPromises);
  
  const toCreate = [];
  const toUpdate = [];
  
  for (const result of results) {
    toCreate.push(...result.toCreate);
    toUpdate.push(...result.toUpdate);
  }
  
  return { toCreate, toUpdate };
}

async function processDatabaseBatches(batches, operation, batchType) {
  const maxParallel = batchType === 'create' ? 12 : 8;
  let processed = 0;
  let totalCount = 0;
  
  for (let i = 0; i < batches.length; i += maxParallel) {
    const startTime = Date.now();
    const batchesToProcess = batches.slice(i, i + maxParallel);
    const results = await Promise.all(batchesToProcess.map(async (batch, idx) => {
      try {
        const result = await operation(batch);
        processed++;
        return result;
      } catch (error) {
        console.error(`Error processing ${batchType} batch ${i + idx + 1}:`, error);
        throw error;
      }
    }));
    
    if (batchType === 'create') {
      totalCount += results.reduce((sum, result) => sum + (result?.count || 0), 0);
    } else {
      totalCount += results.reduce((sum, result) => sum + (Array.isArray(result) ? result.length : 0), 0);
    }
  }
  
  return totalCount;
}

async function importCSV(filePath, importMode) {
  console.time('Total CSV Import Time');
  
  const productsToProcess = [];
  const names = new Set();
  const dbFetchBatchSize = 3000;
  const dbWriteBatchSize = 2000;

  console.time('CSV Parsing Time');
  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath, { highWaterMark: 256 * 1024 })
      .pipe(csv({ skipLines: 0, strict: false, maxRows: Infinity }))
      .on('data', (row) => {
        try {
          const product = {
            source: row['Source']?.trim() || null,
            mainCategory: row['Main Category']?.trim() || "-",
            category: row['Category']?.trim() || "-",
            subCategory: row['Sub-category']?.trim() || null,
            name: row['Product Name/Part No.']?.trim() || "-",
            datasheetLink: row['Datasheet Link (PDF)']?.trim() || null,
            description: row['Description']?.trim() || null,
            specifications: {}
          };

          const standardFields = new Set([
            'Source', 'Main Category', 'Category', 'Sub-category',
            'Product Name/Part No.', 'Datasheet Link (PDF)', 'Description'
          ]);
          
          for (const key in row) {
            const value = row[key];
            if (!standardFields.has(key) && value?.trim?.() !== "") {
              product.specifications[key] = value.trim();
            }
          }

          productsToProcess.push(product);
          names.add(product.name);
        } catch (error) {
          console.error("Error processing row:", error);
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });
  console.timeEnd('CSV Parsing Time');

  const nameArray = [...names];
  const existingProducts = [];
  
  console.time('Database Fetch Time');
  const fetchChunks = [];
  for (let i = 0; i < nameArray.length; i += dbFetchBatchSize) {
    const chunk = nameArray.slice(i, i + dbFetchBatchSize);
    fetchChunks.push(prisma.product.findMany({
      where: { name: { in: chunk } }
    }));
  }
  
  const chunkResults = await Promise.all(fetchChunks);
  chunkResults.forEach(chunk => existingProducts.push(...chunk));
  console.timeEnd('Database Fetch Time');

  console.time('Product Mapping Time');
  const existingMap = new Map();
  
  for (const product of existingProducts) {
    if (!existingMap.has(product.name)) {
      existingMap.set(product.name, []);
    }
    existingMap.get(product.name).push(product);
  }

  for (const products of existingMap.values()) {
    for (const product of products) {
      getSpecsHash(product.specifications);
    }
  }
  
  let processingResults;
  
  try {
    processingResults = await processWithWorkers(productsToProcess, existingMap, importMode);
  } catch (error) {
    console.warn("Worker thread processing failed, falling back to Promise.all:", error);
    
    const numCPUs = Math.max(1, os.cpus().length - 1);
    const productBatches = [];
    const batchItemSize = Math.ceil(productsToProcess.length / numCPUs);
    
    for (let i = 0; i < productsToProcess.length; i += batchItemSize) {
      productBatches.push(productsToProcess.slice(i, i + batchItemSize));
    }
    
    const batchResults = await Promise.all(
      productBatches.map(batch => processProductBatch(batch, existingMap, importMode))
    );
    
    const toCreate = [];
    const toUpdate = [];
    
    batchResults.forEach(result => {
      toCreate.push(...result.toCreate);
      toUpdate.push(...result.toUpdate);
    });
    
    processingResults = { toCreate, toUpdate };
  }
  
  const { toCreate, toUpdate } = processingResults;
  console.timeEnd('Product Mapping Time');

  try {
    if (toUpdate.length > 0 && importMode === 'overwrite') {
      console.time('Database Update Time');
      
      const updateBatches = [];
      for (let i = 0; i < toUpdate.length; i += dbWriteBatchSize) {
        const chunk = toUpdate.slice(i, i + dbWriteBatchSize);
        updateBatches.push(chunk);
      }
      
      const updateOperation = async (batch) => {
        return await prisma.$transaction(
          batch.map(update => prisma.product.update(update))
        );
      };
      
      const totalUpdated = await processDatabaseBatches(updateBatches, updateOperation, 'update');
      console.timeEnd('Database Update Time');
      console.log(`Updated ${totalUpdated} products`);
    }

    if (toCreate.length > 0) {
      console.time('Database Create Time');
      
      const createBatches = [];
      for (let i = 0; i < toCreate.length; i += dbWriteBatchSize) {
        const chunk = toCreate.slice(i, i + dbWriteBatchSize);
        createBatches.push(chunk);
      }
      
      const createOperation = async (batch) => {
        return await prisma.product.createMany({
          data: batch,
          skipDuplicates: true
        });
      };
      
      const totalCreated = await processDatabaseBatches(createBatches, createOperation, 'create');
      console.timeEnd('Database Create Time');
      console.log(`Created ${totalCreated} products (out of ${toCreate.length} attempted)`);
    }

    console.timeEnd('Total CSV Import Time');
    return true;
  } catch (error) {
    console.error("Import failed:", error);
    console.timeEnd('Total CSV Import Time');
    throw error;
  }
}

function processProductBatch(batch, existingMap, importMode) {
  const toCreate = [];
  const toUpdate = [];

  for (const product of batch) {
    const existing = existingMap.get(product.name) || [];
    let duplicate = null;

    for (const item of existing) {
      if (areSpecsEqual(item.specifications, product.specifications)) {
        duplicate = item;
        break;
      }
    }

    if (duplicate) {
      if (importMode === 'overwrite') {
        toUpdate.push({
          where: { id: duplicate.id },
          data: product
        });
      }
    } else {
      toCreate.push({ ...product, id: generateProductId() });
    }
  }

  return { toCreate, toUpdate };
}

export default importCSV;