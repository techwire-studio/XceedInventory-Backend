-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "source" TEXT,
    "category" TEXT NOT NULL,
    "subCategory" TEXT,
    "name" TEXT NOT NULL,
    "datasheetLink" TEXT,
    "description" TEXT,
    "specifications" JSONB,
    "tags" TEXT[],
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "price" DECIMAL(65,30),
    "stockStatus" TEXT,
    "vendorId" INTEGER,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "warranty" TEXT,
    "contactInfo" JSONB,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariation" (
    "id" SERIAL NOT NULL,
    "productId" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "variationDetails" JSONB,

    CONSTRAINT "ProductVariation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariation_variationId_key" ON "ProductVariation"("variationId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariation" ADD CONSTRAINT "ProductVariation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
