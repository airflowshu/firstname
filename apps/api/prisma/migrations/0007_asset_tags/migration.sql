CREATE TABLE "AssetTag" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssetTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssetTag_name_key" ON "AssetTag"("name");
CREATE INDEX "AssetTag_enabled_sortOrder_idx" ON "AssetTag"("enabled", "sortOrder");
