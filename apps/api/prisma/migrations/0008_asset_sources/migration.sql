CREATE TABLE "AssetSource" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssetSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssetSource_name_key" ON "AssetSource"("name");
CREATE INDEX "AssetSource_enabled_sortOrder_idx" ON "AssetSource"("enabled", "sortOrder");

ALTER TABLE "MemberAsset"
  ADD COLUMN "sourceType" TEXT;

ALTER TABLE "SupplementRequestAsset"
  ADD COLUMN "sourceType" TEXT;

INSERT INTO "AssetTag" ("id", "name", "enabled", "sortOrder")
VALUES
  ('asset-tag-heying', '合影', true, 10),
  ('asset-tag-zhengshu', '证书', true, 20),
  ('asset-tag-biye', '毕业', true, 30),
  ('asset-tag-hunli', '婚礼', true, 40),
  ('asset-tag-zuzhai', '祖宅', true, 50),
  ('asset-tag-mubei', '墓碑', true, 60),
  ('asset-tag-zupu', '族谱', true, 70),
  ('asset-tag-koushu', '口述资料', true, 80)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "AssetSource" ("id", "name", "enabled", "sortOrder")
VALUES
  ('asset-source-zuren', '族人提供', true, 10),
  ('asset-source-xiangce', '老相册翻拍', true, 20),
  ('asset-source-zhengjian', '证件扫描', true, 30),
  ('asset-source-difangzhi', '地方志摘录', true, 40),
  ('asset-source-mubei', '墓碑抄录', true, 50),
  ('asset-source-koushu', '口述整理', true, 60)
ON CONFLICT ("name") DO NOTHING;
