/*
  Warnings:

  - A unique constraint covering the columns `[specsHash]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "specsHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Product_specsHash_key" ON "Product"("specsHash");
