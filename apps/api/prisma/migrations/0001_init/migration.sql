CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'VIEWER');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');
CREATE TYPE "LifeStatus" AS ENUM ('ALIVE', 'DECEASED', 'UNKNOWN');
CREATE TYPE "MarriageStatus" AS ENUM ('ACTIVE', 'DIVORCED', 'WIDOWED');
CREATE TYPE "AuditAction" AS ENUM (
  'LOGIN',
  'LOGOUT',
  'CREATE',
  'UPDATE',
  'DELETE',
  'RESTORE',
  'EXPORT',
  'UPLOAD_PHOTO',
  'ROLE_CHANGE'
);

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastLoginAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Member" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "gender" "Gender" NOT NULL DEFAULT 'UNKNOWN',
  "birthDate" TIMESTAMPTZ,
  "deathDate" TIMESTAMPTZ,
  "lifeStatus" "LifeStatus" NOT NULL DEFAULT 'ALIVE',
  "photoPath" TEXT,
  "generationName" TEXT,
  "birthOrder" INTEGER,
  "nativePlace" TEXT,
  "fatherId" TEXT,
  "motherId" TEXT,
  "notes" TEXT,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Marriage" (
  "id" TEXT NOT NULL,
  "pairKey" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "spouseId" TEXT NOT NULL,
  "status" "MarriageStatus" NOT NULL DEFAULT 'ACTIVE',
  "startDate" TIMESTAMPTZ,
  "endDate" TIMESTAMPTZ,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Marriage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KinshipAlias" (
  "id" TEXT NOT NULL,
  "relationCode" TEXT NOT NULL,
  "standardTerm" TEXT NOT NULL,
  "familyAlias" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KinshipAlias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "operatorId" TEXT,
  "action" "AuditAction" NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "Member_name_idx" ON "Member"("name");
CREATE INDEX "Member_fatherId_idx" ON "Member"("fatherId");
CREATE INDEX "Member_motherId_idx" ON "Member"("motherId");
CREATE INDEX "Member_isDeleted_idx" ON "Member"("isDeleted");
CREATE UNIQUE INDEX "Marriage_pairKey_key" ON "Marriage"("pairKey");
CREATE INDEX "Marriage_memberId_idx" ON "Marriage"("memberId");
CREATE INDEX "Marriage_spouseId_idx" ON "Marriage"("spouseId");
CREATE INDEX "Marriage_isDeleted_idx" ON "Marriage"("isDeleted");
CREATE UNIQUE INDEX "KinshipAlias_relationCode_key" ON "KinshipAlias"("relationCode");
CREATE INDEX "KinshipAlias_enabled_idx" ON "KinshipAlias"("enabled");
CREATE INDEX "AuditLog_operatorId_idx" ON "AuditLog"("operatorId");
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

ALTER TABLE "Member"
  ADD CONSTRAINT "Member_fatherId_fkey"
  FOREIGN KEY ("fatherId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Member"
  ADD CONSTRAINT "Member_motherId_fkey"
  FOREIGN KEY ("motherId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Marriage"
  ADD CONSTRAINT "Marriage_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Marriage"
  ADD CONSTRAINT "Marriage_spouseId_fkey"
  FOREIGN KEY ("spouseId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_operatorId_fkey"
  FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
