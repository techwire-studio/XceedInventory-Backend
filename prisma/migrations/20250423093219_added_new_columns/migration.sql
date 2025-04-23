-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "cpn" TEXT DEFAULT '-',
ADD COLUMN     "ltwks" TEXT DEFAULT '-',
ADD COLUMN     "manufacturer" TEXT DEFAULT '-',
ADD COLUMN     "mfrPartNumber" TEXT DEFAULT '-',
ADD COLUMN     "moq" INTEGER,
ADD COLUMN     "remarks" TEXT DEFAULT '-',
ADD COLUMN     "spq" INTEGER,
ADD COLUMN     "stockQty" INTEGER;

-- CreateIndex
CREATE INDEX "Product_manufacturer_idx" ON "Product"("manufacturer");

-- CreateIndex
CREATE INDEX "Product_mfrPartNumber_idx" ON "Product"("mfrPartNumber");
