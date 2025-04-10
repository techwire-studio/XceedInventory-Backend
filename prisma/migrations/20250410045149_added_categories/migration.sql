/*
  Warnings:

  - You are about to drop the column `category` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `mainCategory` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `subCategory` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "category",
DROP COLUMN "mainCategory",
DROP COLUMN "subCategory",
ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "Categories" (
    "id" TEXT NOT NULL,
    "mainCategory" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subCategory" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Categories_mainCategory_idx" ON "Categories"("mainCategory");

-- CreateIndex
CREATE INDEX "Categories_mainCategory_category_idx" ON "Categories"("mainCategory", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Categories_mainCategory_category_subCategory_key" ON "Categories"("mainCategory", "category", "subCategory");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
