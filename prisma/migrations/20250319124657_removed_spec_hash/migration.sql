/*
  Warnings:

  - You are about to drop the column `specsHash` on the `Product` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Product_specsHash_key";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "specsHash";
