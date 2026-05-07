-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SUPER', 'USER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "FamilyStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "InvitationType" AS ENUM ('FAMILY_ADMIN', 'FAMILY_MEMBER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "LifeStatus" AS ENUM ('ALIVE', 'DECEASED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MarriageStatus" AS ENUM ('ACTIVE', 'DIVORCED', 'WIDOWED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'EXPORT', 'UPLOAD_PHOTO', 'ROLE_CHANGE');

-- CreateEnum
CREATE TYPE "MemberEventType" AS ENUM ('BIRTH', 'MARRIAGE', 'DIVORCE', 'DEATH', 'MOVE', 'CAREER', 'HONOR', 'STORY', 'OTHER');

-- CreateEnum
CREATE TYPE "MemberAssetCategory" AS ENUM ('PHOTO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "SupplementRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SupplementRequestType" AS ENUM ('BASIC_INFO', 'PHOTO', 'DOCUMENT', 'MEMBER_CREATE', 'MEMBER_UPDATE', 'MEMBER_DELETE', 'MEMBER_RESTORE', 'QUICK_RELATIVE', 'MARRIAGE_CREATE', 'MARRIAGE_UPDATE', 'MARRIAGE_DELETE', 'MARRIAGE_RESTORE', 'MEMBER_PHOTO', 'ASSET_UPDATE', 'ASSET_DELETE', 'EVENT_CREATE', 'EVENT_DELETE', 'MEMBER_IMPORT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "phone" TEXT,
    "displayName" TEXT,
    "passwordHash" TEXT NOT NULL,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "refreshTokenHash" TEXT,
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER',
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastActiveFamilyId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "FamilyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMembership" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "type" "InvitationType" NOT NULL,
    "familyId" TEXT,
    "targetRole" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "createdById" TEXT,
    "usedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "familyId" TEXT,
    "name" TEXT NOT NULL,
    "gender" "Gender" NOT NULL DEFAULT 'UNKNOWN',
    "birthDate" TIMESTAMP(3),
    "deathDate" TIMESTAMP(3),
    "lifeStatus" "LifeStatus" NOT NULL DEFAULT 'ALIVE',
    "photoPath" TEXT,
    "generationName" TEXT,
    "birthOrder" INTEGER,
    "nativePlace" TEXT,
    "fatherId" TEXT,
    "motherId" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetTag" (
    "id" TEXT NOT NULL,
    "familyId" TEXT,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetSource" (
    "id" TEXT NOT NULL,
    "familyId" TEXT,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberEvent" (
    "id" TEXT NOT NULL,
    "familyId" TEXT,
    "memberId" TEXT,
    "createdById" TEXT,
    "eventType" "MemberEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberAsset" (
    "id" TEXT NOT NULL,
    "familyId" TEXT,
    "memberId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "category" "MemberAssetCategory" NOT NULL,
    "filePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "checksum" TEXT,
    "title" TEXT,
    "sourceType" TEXT,
    "source" TEXT,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplementRequest" (
    "id" TEXT NOT NULL,
    "familyId" TEXT,
    "memberId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "requestType" "SupplementRequestType" NOT NULL DEFAULT 'BASIC_INFO',
    "status" "SupplementRequestStatus" NOT NULL DEFAULT 'PENDING',
    "patch" JSONB NOT NULL,
    "beforeSnapshot" JSONB,
    "afterSnapshot" JSONB,
    "payload" JSONB,
    "reason" TEXT,
    "reviewComment" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplementRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplementRequestAsset" (
    "id" TEXT NOT NULL,
    "familyId" TEXT,
    "requestId" TEXT NOT NULL,
    "category" "MemberAssetCategory" NOT NULL,
    "filePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "checksum" TEXT,
    "title" TEXT,
    "sourceType" TEXT,
    "source" TEXT,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplementRequestAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marriage" (
    "id" TEXT NOT NULL,
    "familyId" TEXT,
    "pairKey" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "spouseId" TEXT NOT NULL,
    "status" "MarriageStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Marriage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KinshipAlias" (
    "id" TEXT NOT NULL,
    "familyId" TEXT,
    "relationCode" TEXT NOT NULL,
    "standardTerm" TEXT NOT NULL,
    "familyAlias" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KinshipAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "familyId" TEXT,
    "operatorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_refreshTokenHash_idx" ON "User"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "User_lastActiveFamilyId_idx" ON "User"("lastActiveFamilyId");

-- CreateIndex
CREATE INDEX "Family_status_idx" ON "Family"("status");

-- CreateIndex
CREATE INDEX "Family_createdById_idx" ON "Family"("createdById");

-- CreateIndex
CREATE INDEX "FamilyMembership_familyId_role_idx" ON "FamilyMembership"("familyId", "role");

-- CreateIndex
CREATE INDEX "FamilyMembership_userId_status_idx" ON "FamilyMembership"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMembership_userId_familyId_key" ON "FamilyMembership"("userId", "familyId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_codeHash_key" ON "Invitation"("codeHash");

-- CreateIndex
CREATE INDEX "Invitation_familyId_idx" ON "Invitation"("familyId");

-- CreateIndex
CREATE INDEX "Invitation_createdById_idx" ON "Invitation"("createdById");

-- CreateIndex
CREATE INDEX "Invitation_usedById_idx" ON "Invitation"("usedById");

-- CreateIndex
CREATE INDEX "Invitation_expiresAt_idx" ON "Invitation"("expiresAt");

-- CreateIndex
CREATE INDEX "Member_familyId_idx" ON "Member"("familyId");

-- CreateIndex
CREATE INDEX "Member_familyId_name_idx" ON "Member"("familyId", "name");

-- CreateIndex
CREATE INDEX "Member_fatherId_idx" ON "Member"("fatherId");

-- CreateIndex
CREATE INDEX "Member_motherId_idx" ON "Member"("motherId");

-- CreateIndex
CREATE INDEX "Member_isDeleted_idx" ON "Member"("isDeleted");

-- CreateIndex
CREATE INDEX "AssetTag_familyId_idx" ON "AssetTag"("familyId");

-- CreateIndex
CREATE INDEX "AssetTag_enabled_sortOrder_idx" ON "AssetTag"("enabled", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AssetTag_familyId_name_key" ON "AssetTag"("familyId", "name");

-- CreateIndex
CREATE INDEX "AssetSource_familyId_idx" ON "AssetSource"("familyId");

-- CreateIndex
CREATE INDEX "AssetSource_enabled_sortOrder_idx" ON "AssetSource"("enabled", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AssetSource_familyId_name_key" ON "AssetSource"("familyId", "name");

-- CreateIndex
CREATE INDEX "MemberEvent_familyId_idx" ON "MemberEvent"("familyId");

-- CreateIndex
CREATE INDEX "MemberEvent_memberId_idx" ON "MemberEvent"("memberId");

-- CreateIndex
CREATE INDEX "MemberEvent_createdById_idx" ON "MemberEvent"("createdById");

-- CreateIndex
CREATE INDEX "MemberEvent_eventType_idx" ON "MemberEvent"("eventType");

-- CreateIndex
CREATE INDEX "MemberEvent_eventDate_idx" ON "MemberEvent"("eventDate");

-- CreateIndex
CREATE INDEX "MemberEvent_isDeleted_idx" ON "MemberEvent"("isDeleted");

-- CreateIndex
CREATE INDEX "MemberAsset_familyId_idx" ON "MemberAsset"("familyId");

-- CreateIndex
CREATE INDEX "MemberAsset_memberId_idx" ON "MemberAsset"("memberId");

-- CreateIndex
CREATE INDEX "MemberAsset_uploadedById_idx" ON "MemberAsset"("uploadedById");

-- CreateIndex
CREATE INDEX "MemberAsset_category_idx" ON "MemberAsset"("category");

-- CreateIndex
CREATE INDEX "MemberAsset_isDeleted_idx" ON "MemberAsset"("isDeleted");

-- CreateIndex
CREATE INDEX "MemberAsset_createdAt_idx" ON "MemberAsset"("createdAt");

-- CreateIndex
CREATE INDEX "MemberAsset_checksum_idx" ON "MemberAsset"("checksum");

-- CreateIndex
CREATE INDEX "SupplementRequest_familyId_idx" ON "SupplementRequest"("familyId");

-- CreateIndex
CREATE INDEX "SupplementRequest_memberId_idx" ON "SupplementRequest"("memberId");

-- CreateIndex
CREATE INDEX "SupplementRequest_requesterId_idx" ON "SupplementRequest"("requesterId");

-- CreateIndex
CREATE INDEX "SupplementRequest_reviewerId_idx" ON "SupplementRequest"("reviewerId");

-- CreateIndex
CREATE INDEX "SupplementRequest_requestType_idx" ON "SupplementRequest"("requestType");

-- CreateIndex
CREATE INDEX "SupplementRequest_status_idx" ON "SupplementRequest"("status");

-- CreateIndex
CREATE INDEX "SupplementRequest_createdAt_idx" ON "SupplementRequest"("createdAt");

-- CreateIndex
CREATE INDEX "SupplementRequestAsset_familyId_idx" ON "SupplementRequestAsset"("familyId");

-- CreateIndex
CREATE INDEX "SupplementRequestAsset_requestId_idx" ON "SupplementRequestAsset"("requestId");

-- CreateIndex
CREATE INDEX "SupplementRequestAsset_category_idx" ON "SupplementRequestAsset"("category");

-- CreateIndex
CREATE INDEX "SupplementRequestAsset_createdAt_idx" ON "SupplementRequestAsset"("createdAt");

-- CreateIndex
CREATE INDEX "SupplementRequestAsset_checksum_idx" ON "SupplementRequestAsset"("checksum");

-- CreateIndex
CREATE UNIQUE INDEX "Marriage_pairKey_key" ON "Marriage"("pairKey");

-- CreateIndex
CREATE INDEX "Marriage_familyId_idx" ON "Marriage"("familyId");

-- CreateIndex
CREATE INDEX "Marriage_memberId_idx" ON "Marriage"("memberId");

-- CreateIndex
CREATE INDEX "Marriage_spouseId_idx" ON "Marriage"("spouseId");

-- CreateIndex
CREATE INDEX "Marriage_isDeleted_idx" ON "Marriage"("isDeleted");

-- CreateIndex
CREATE INDEX "KinshipAlias_familyId_idx" ON "KinshipAlias"("familyId");

-- CreateIndex
CREATE INDEX "KinshipAlias_enabled_idx" ON "KinshipAlias"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "KinshipAlias_familyId_relationCode_key" ON "KinshipAlias"("familyId", "relationCode");

-- CreateIndex
CREATE INDEX "AuditLog_familyId_idx" ON "AuditLog"("familyId");

-- CreateIndex
CREATE INDEX "AuditLog_operatorId_idx" ON "AuditLog"("operatorId");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_lastActiveFamilyId_fkey" FOREIGN KEY ("lastActiveFamilyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMembership" ADD CONSTRAINT "FamilyMembership_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMembership" ADD CONSTRAINT "FamilyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_fatherId_fkey" FOREIGN KEY ("fatherId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_motherId_fkey" FOREIGN KEY ("motherId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetTag" ADD CONSTRAINT "AssetTag_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetSource" ADD CONSTRAINT "AssetSource_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberEvent" ADD CONSTRAINT "MemberEvent_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberEvent" ADD CONSTRAINT "MemberEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberEvent" ADD CONSTRAINT "MemberEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberAsset" ADD CONSTRAINT "MemberAsset_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberAsset" ADD CONSTRAINT "MemberAsset_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberAsset" ADD CONSTRAINT "MemberAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementRequest" ADD CONSTRAINT "SupplementRequest_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementRequest" ADD CONSTRAINT "SupplementRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementRequest" ADD CONSTRAINT "SupplementRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementRequest" ADD CONSTRAINT "SupplementRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementRequestAsset" ADD CONSTRAINT "SupplementRequestAsset_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementRequestAsset" ADD CONSTRAINT "SupplementRequestAsset_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupplementRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marriage" ADD CONSTRAINT "Marriage_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marriage" ADD CONSTRAINT "Marriage_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marriage" ADD CONSTRAINT "Marriage_spouseId_fkey" FOREIGN KEY ("spouseId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KinshipAlias" ADD CONSTRAINT "KinshipAlias_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

