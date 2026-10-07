-- CreateEnum
CREATE TYPE "RecStatus" AS ENUM ('DRAFT', 'REVIEW', 'VERIFIED', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "RecType" AS ENUM ('GENERAL', 'SOIL_TEST', 'STCR');

-- CreateEnum
CREATE TYPE "Season" AS ENUM ('KHARIF', 'RABI', 'SUMMER', 'PERENNIAL');

-- CreateEnum
CREATE TYPE "Irrigation" AS ENUM ('IRRIGATED', 'RAINFED');

-- CreateTable
CREATE TABLE "RecommendationSource" (
    "id" TEXT NOT NULL,
    "organisation" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "url" TEXT,
    "page" TEXT,
    "region" TEXT NOT NULL,
    "publishedOn" TIMESTAMP(3),
    "verifiedOn" TIMESTAMP(3) NOT NULL,
    "verifiedBy" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutrientRecommendation" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT,
    "agroClimaticZone" TEXT,
    "cropId" TEXT NOT NULL,
    "variety" TEXT,
    "season" "Season" NOT NULL,
    "irrigation" "Irrigation" NOT NULL,
    "soilCondition" TEXT,
    "targetYieldQtlHa" DECIMAL(8,2),
    "nPerHa" DECIMAL(8,2) NOT NULL,
    "p2o5PerHa" DECIMAL(8,2) NOT NULL,
    "k2oPerHa" DECIMAL(8,2) NOT NULL,
    "type" "RecType" NOT NULL,
    "status" "RecStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveDate" TIMESTAMP(3),
    "sourceId" TEXT NOT NULL,
    "conflictsWithId" TEXT,
    "conflictNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutrientRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationStageRow" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "daysAfterSowing" INTEGER,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "nShare" DECIMAL(4,3),
    "p2o5Share" DECIMAL(4,3),
    "k2oShare" DECIMAL(4,3),

    CONSTRAINT "ApplicationStageRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FertilizerProduct" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameTe" TEXT,
    "nameHi" TEXT,
    "nPct" DECIMAL(5,2) NOT NULL,
    "p2o5Pct" DECIMAL(5,2) NOT NULL,
    "k2oPct" DECIMAL(5,2) NOT NULL,
    "sPct" DECIMAL(5,2),
    "znPct" DECIMAL(5,2),
    "regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FertilizerProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FertilizerPrice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "rupeesPerKg" DECIMAL(8,2) NOT NULL,
    "observedOn" TIMESTAMP(3) NOT NULL,
    "sourceNote" TEXT NOT NULL,

    CONSTRAINT "FertilizerPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoilClassification" (
    "id" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "lowBelow" DECIMAL(10,3) NOT NULL,
    "highAbove" DECIMAL(10,3) NOT NULL,
    "region" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "SoilClassification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationSource_organisation_document_version_key" ON "RecommendationSource"("organisation", "document", "version");

-- CreateIndex
CREATE INDEX "NutrientRecommendation_state_cropId_season_irrigation_statu_idx" ON "NutrientRecommendation"("state", "cropId", "season", "irrigation", "status");

-- CreateIndex
CREATE INDEX "ApplicationStageRow_recommendationId_orderIndex_idx" ON "ApplicationStageRow"("recommendationId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "FertilizerProduct_key_key" ON "FertilizerProduct"("key");

-- CreateIndex
CREATE INDEX "FertilizerPrice_productId_state_observedOn_idx" ON "FertilizerPrice"("productId", "state", "observedOn");

-- CreateIndex
CREATE UNIQUE INDEX "SoilClassification_parameter_region_key" ON "SoilClassification"("parameter", "region");

-- AddForeignKey
ALTER TABLE "NutrientRecommendation" ADD CONSTRAINT "NutrientRecommendation_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutrientRecommendation" ADD CONSTRAINT "NutrientRecommendation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RecommendationSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStageRow" ADD CONSTRAINT "ApplicationStageRow_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "NutrientRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FertilizerPrice" ADD CONSTRAINT "FertilizerPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "FertilizerProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoilClassification" ADD CONSTRAINT "SoilClassification_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RecommendationSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

