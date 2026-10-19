-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AffiliateOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateNetworkId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "offerUrl" TEXT NOT NULL DEFAULT '',
    "commissionAmount" INTEGER,
    "commissionType" TEXT NOT NULL DEFAULT 'fixed',
    "commissionRate" REAL,
    "averageOrderValue" INTEGER,
    "conversionConditions" TEXT NOT NULL DEFAULT '',
    "rejectionConditions" TEXT NOT NULL DEFAULT '',
    "approvalRate" REAL,
    "targetAudience" TEXT NOT NULL DEFAULT '',
    "partnershipStatus" TEXT NOT NULL DEFAULT 'candidate',
    "approvalTiming" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "fitScore" INTEGER,
    "fitEvaluation" TEXT NOT NULL DEFAULT '',
    "fitEvaluatedBy" TEXT NOT NULL DEFAULT '',
    "fitEvaluatedAt" DATETIME,
    "lastVerifiedAt" DATETIME,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AffiliateOffer_affiliateNetworkId_fkey" FOREIGN KEY ("affiliateNetworkId") REFERENCES "AffiliateNetwork" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AffiliateOffer" ("affiliateNetworkId", "approvalRate", "approvalTiming", "averageOrderValue", "category", "commissionAmount", "commissionRate", "commissionType", "conversionConditions", "createdAt", "id", "isDemo", "lastVerifiedAt", "name", "notes", "offerUrl", "partnershipStatus", "rejectionConditions", "targetAudience", "updatedAt") SELECT "affiliateNetworkId", "approvalRate", "approvalTiming", "averageOrderValue", "category", "commissionAmount", "commissionRate", "commissionType", "conversionConditions", "createdAt", "id", "isDemo", "lastVerifiedAt", "name", "notes", "offerUrl", "partnershipStatus", "rejectionConditions", "targetAudience", "updatedAt" FROM "AffiliateOffer";
DROP TABLE "AffiliateOffer";
ALTER TABLE "new_AffiliateOffer" RENAME TO "AffiliateOffer";
CREATE INDEX "AffiliateOffer_partnershipStatus_idx" ON "AffiliateOffer"("partnershipStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
