CREATE TYPE "SupplementRequestType" AS ENUM ('BASIC_INFO', 'PHOTO', 'DOCUMENT');

ALTER TABLE "SupplementRequest"
  ADD COLUMN "requestType" "SupplementRequestType" NOT NULL DEFAULT 'BASIC_INFO';

CREATE INDEX "SupplementRequest_requestType_idx" ON "SupplementRequest"("requestType");

CREATE TABLE "SupplementRequestAsset" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "category" "MemberAssetCategory" NOT NULL,
  "filePath" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplementRequestAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplementRequestAsset_requestId_idx" ON "SupplementRequestAsset"("requestId");
CREATE INDEX "SupplementRequestAsset_category_idx" ON "SupplementRequestAsset"("category");
CREATE INDEX "SupplementRequestAsset_createdAt_idx" ON "SupplementRequestAsset"("createdAt");

ALTER TABLE "SupplementRequestAsset"
  ADD CONSTRAINT "SupplementRequestAsset_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "SupplementRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
