-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "fromAddressId" TEXT;

-- CreateTable
CREATE TABLE "FromAddress" (
    "id" TEXT NOT NULL,
    "addressLabel" TEXT NOT NULL,
    "addressDetails" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FromAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FromAddress_addressLabel_key" ON "FromAddress"("addressLabel");

-- CreateIndex
CREATE INDEX "Order_fromAddressId_idx" ON "Order"("fromAddressId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_fromAddressId_fkey" FOREIGN KEY ("fromAddressId") REFERENCES "FromAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;
