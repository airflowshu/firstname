ALTER TABLE "User"
  ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "refreshTokenHash" TEXT,
  ADD COLUMN "refreshTokenExpiresAt" TIMESTAMP(3);

CREATE INDEX "User_refreshTokenHash_idx" ON "User"("refreshTokenHash");
