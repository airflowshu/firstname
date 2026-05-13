CREATE TYPE "FamilyType" AS ENUM ('STANDARD', 'DEMO', 'TEMPLATE');

ALTER TABLE "Family"
ADD COLUMN "familyType" "FamilyType" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN "resetTemplateKey" TEXT;

CREATE TABLE "DemoResetHistory" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "familyNameSnapshot" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "operatorId" TEXT,
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoResetHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Family_familyType_idx" ON "Family"("familyType");
CREATE INDEX "Family_resetTemplateKey_idx" ON "Family"("resetTemplateKey");
CREATE INDEX "DemoResetHistory_familyId_idx" ON "DemoResetHistory"("familyId");
CREATE INDEX "DemoResetHistory_operatorId_idx" ON "DemoResetHistory"("operatorId");
CREATE INDEX "DemoResetHistory_templateKey_idx" ON "DemoResetHistory"("templateKey");
CREATE INDEX "DemoResetHistory_createdAt_idx" ON "DemoResetHistory"("createdAt");

ALTER TABLE "DemoResetHistory"
ADD CONSTRAINT "DemoResetHistory_familyId_fkey"
FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DemoResetHistory"
ADD CONSTRAINT "DemoResetHistory_operatorId_fkey"
FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
