CREATE TYPE "MemberAssetCategory" AS ENUM ('PHOTO', 'DOCUMENT');

CREATE TABLE "MemberAsset" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "uploadedById" TEXT,
  "category" "MemberAssetCategory" NOT NULL,
  "filePath" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemberAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MemberAsset_memberId_idx" ON "MemberAsset"("memberId");
CREATE INDEX "MemberAsset_uploadedById_idx" ON "MemberAsset"("uploadedById");
CREATE INDEX "MemberAsset_category_idx" ON "MemberAsset"("category");
CREATE INDEX "MemberAsset_isDeleted_idx" ON "MemberAsset"("isDeleted");
CREATE INDEX "MemberAsset_createdAt_idx" ON "MemberAsset"("createdAt");

ALTER TABLE "MemberAsset"
  ADD CONSTRAINT "MemberAsset_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemberAsset"
  ADD CONSTRAINT "MemberAsset_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
