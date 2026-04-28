CREATE TYPE "MemberEventType" AS ENUM (
  'BIRTH',
  'MARRIAGE',
  'DIVORCE',
  'DEATH',
  'MOVE',
  'CAREER',
  'HONOR',
  'STORY',
  'OTHER'
);

CREATE TABLE "MemberEvent" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "createdById" TEXT,
  "eventType" "MemberEventType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "eventDate" TIMESTAMPTZ NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemberEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MemberEvent_memberId_idx" ON "MemberEvent"("memberId");
CREATE INDEX "MemberEvent_createdById_idx" ON "MemberEvent"("createdById");
CREATE INDEX "MemberEvent_eventType_idx" ON "MemberEvent"("eventType");
CREATE INDEX "MemberEvent_eventDate_idx" ON "MemberEvent"("eventDate");
CREATE INDEX "MemberEvent_isDeleted_idx" ON "MemberEvent"("isDeleted");

ALTER TABLE "MemberEvent"
  ADD CONSTRAINT "MemberEvent_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemberEvent"
  ADD CONSTRAINT "MemberEvent_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
