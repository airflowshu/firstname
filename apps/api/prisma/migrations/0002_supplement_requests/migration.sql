CREATE TYPE "SupplementRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "SupplementRequest" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "reviewerId" TEXT,
  "status" "SupplementRequestStatus" NOT NULL DEFAULT 'PENDING',
  "patch" JSONB NOT NULL,
  "reason" TEXT,
  "reviewComment" TEXT,
  "reviewedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplementRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplementRequest_memberId_idx" ON "SupplementRequest"("memberId");
CREATE INDEX "SupplementRequest_requesterId_idx" ON "SupplementRequest"("requesterId");
CREATE INDEX "SupplementRequest_reviewerId_idx" ON "SupplementRequest"("reviewerId");
CREATE INDEX "SupplementRequest_status_idx" ON "SupplementRequest"("status");
CREATE INDEX "SupplementRequest_createdAt_idx" ON "SupplementRequest"("createdAt");

ALTER TABLE "SupplementRequest"
  ADD CONSTRAINT "SupplementRequest_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplementRequest"
  ADD CONSTRAINT "SupplementRequest_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplementRequest"
  ADD CONSTRAINT "SupplementRequest_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
