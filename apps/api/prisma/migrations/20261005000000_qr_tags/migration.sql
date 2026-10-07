-- CreateEnum
CREATE TYPE "QrTagType" AS ENUM ('PRODUCT_BATCH', 'EQUIPMENT');

-- CreateTable
CREATE TABLE "QrTag" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "QrTagType" NOT NULL,
    "payload" JSONB NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "QrTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrScan" (
    "id" TEXT NOT NULL,
    "rawCode" TEXT NOT NULL,
    "tagId" TEXT,
    "userId" TEXT,
    "outcome" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "villageId" TEXT,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QrTag_code_key" ON "QrTag"("code");

-- CreateIndex
CREATE INDEX "QrTag_type_idx" ON "QrTag"("type");

-- CreateIndex
CREATE INDEX "QrScan_tagId_scannedAt_idx" ON "QrScan"("tagId", "scannedAt");

-- CreateIndex
CREATE INDEX "QrScan_rawCode_idx" ON "QrScan"("rawCode");

-- AddForeignKey
ALTER TABLE "QrScan" ADD CONSTRAINT "QrScan_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "QrTag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

