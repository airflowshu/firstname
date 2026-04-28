ALTER TABLE "MemberAsset"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "source" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "MemberAsset_tags_gin_idx" ON "MemberAsset" USING GIN ("tags");

ALTER TABLE "SupplementRequestAsset"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "source" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "SupplementRequestAsset_tags_gin_idx" ON "SupplementRequestAsset" USING GIN ("tags");
