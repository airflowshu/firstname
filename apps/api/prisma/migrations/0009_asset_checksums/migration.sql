ALTER TABLE "MemberAsset"
  ADD COLUMN "checksum" TEXT;

CREATE INDEX "MemberAsset_checksum_idx" ON "MemberAsset"("checksum");

ALTER TABLE "SupplementRequestAsset"
  ADD COLUMN "checksum" TEXT;

CREATE INDEX "SupplementRequestAsset_checksum_idx" ON "SupplementRequestAsset"("checksum");
