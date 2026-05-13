import {
  FamilyType,
  Gender,
  LifeStatus,
  MarriageStatus,
  PlatformRole,
  PrismaClient,
  UserRole,
  UserStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { defaultDemoTemplate } from '../src/demo-reset/templates/default-demo';

const prisma = new PrismaClient();

function buildPairKey(firstId: string, secondId: string) {
  return [firstId, secondId].sort().join(':');
}

async function seedFamilySettings(familyId: string) {
  await prisma.kinshipAlias.createMany({
    data: defaultDemoTemplate.settings.kinshipAliases.map((alias) => ({
      familyId,
      relationCode: alias.relationCode,
      standardTerm: alias.standardTerm,
      familyAlias: alias.familyAlias,
      enabled: alias.enabled ?? true,
    })),
  });

  await prisma.assetTag.createMany({
    data: defaultDemoTemplate.settings.assetTags.map((tag) => ({
      familyId,
      name: tag.name,
      enabled: tag.enabled ?? true,
      sortOrder: tag.sortOrder ?? 0,
    })),
  });

  await prisma.assetSource.createMany({
    data: defaultDemoTemplate.settings.assetSources.map((source) => ({
      familyId,
      name: source.name,
      enabled: source.enabled ?? true,
      sortOrder: source.sortOrder ?? 0,
    })),
  });
}

async function seedDemoFamilyData(familyId: string, userIdByUsername: Map<string, string>) {
  const memberIdByCode = new Map<string, string>();

  for (const member of defaultDemoTemplate.data.members) {
    const created = await prisma.member.create({
      data: {
        familyId,
        name: member.name,
        gender: member.gender,
        birthDate: member.birthDate ? new Date(member.birthDate) : undefined,
        deathDate: member.deathDate ? new Date(member.deathDate) : undefined,
        lifeStatus: member.deathDate ? LifeStatus.DECEASED : LifeStatus.ALIVE,
        generationName: member.generationName,
        birthOrder: member.birthOrder,
        nativePlace: member.nativePlace,
        notes: member.notes,
        fatherId: member.fatherCode ? memberIdByCode.get(member.fatherCode) : undefined,
        motherId: member.motherCode ? memberIdByCode.get(member.motherCode) : undefined,
      },
      select: { id: true },
    });

    memberIdByCode.set(member.code, created.id);
  }

  if (defaultDemoTemplate.data.marriages.length > 0) {
    await prisma.marriage.createMany({
      data: defaultDemoTemplate.data.marriages.map((marriage) => {
        const memberId = memberIdByCode.get(marriage.memberCode);
        const spouseId = memberIdByCode.get(marriage.spouseCode);
        if (!memberId || !spouseId) {
          throw new Error('婚姻模板引用了不存在的成员编码。');
        }

        return {
          familyId,
          pairKey: buildPairKey(memberId, spouseId),
          memberId,
          spouseId,
          status: marriage.status ?? MarriageStatus.ACTIVE,
          startDate: marriage.startDate ? new Date(marriage.startDate) : undefined,
          endDate: marriage.endDate ? new Date(marriage.endDate) : undefined,
        };
      }),
    });
  }

  if (defaultDemoTemplate.data.events.length > 0) {
    await prisma.memberEvent.createMany({
      data: defaultDemoTemplate.data.events.map((event) => {
        const memberId = memberIdByCode.get(event.memberCode);
        if (!memberId) {
          throw new Error('成员事件模板引用了不存在的成员编码。');
        }

        return {
          familyId,
          memberId,
          createdById: event.createdByUsername
            ? userIdByUsername.get(event.createdByUsername)
            : undefined,
          eventType: event.eventType,
          title: event.title,
          description: event.description,
          eventDate: new Date(event.eventDate),
        };
      }),
    });
  }
}

async function main() {
  await prisma.demoResetHistory.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.familyMembership.deleteMany();
  await prisma.assetSource.deleteMany();
  await prisma.assetTag.deleteMany();
  await prisma.kinshipAlias.deleteMany();
  await prisma.marriage.deleteMany();
  await prisma.memberEvent.deleteMany();
  await prisma.memberAsset.deleteMany();
  await prisma.supplementRequestAsset.deleteMany();
  await prisma.supplementRequest.deleteMany();
  await prisma.member.deleteMany();
  await prisma.family.deleteMany();
  await prisma.user.deleteMany();

  const adminPasswordHash = await bcrypt.hash('admin123456', 10);
  const viewerPasswordHash = await bcrypt.hash('viewer123456', 10);
  const superPasswordHash = await bcrypt.hash('super123456', 10);

  const templateFamily = await prisma.family.create({
    data: {
      name: '系统设置模板家族',
      familyType: FamilyType.TEMPLATE,
    },
  });

  const demoFamily = await prisma.family.create({
    data: {
      name: defaultDemoTemplate.familyName,
      familyType: FamilyType.DEMO,
      resetTemplateKey: defaultDemoTemplate.key,
    },
  });

  const superUser = await prisma.user.create({
    data: {
      username: 'super',
      phone: '18800000000',
      displayName: '平台超级管理员',
      passwordHash: superPasswordHash,
      platformRole: PlatformRole.SUPER,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      username: 'admin',
      phone: '18800000001',
      displayName: '默认家族管理员',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      lastActiveFamilyId: demoFamily.id,
    },
  });

  const viewerUser = await prisma.user.create({
    data: {
      username: 'viewer',
      phone: '18800000002',
      displayName: '默认家族普通用户',
      passwordHash: viewerPasswordHash,
      role: UserRole.VIEWER,
      status: UserStatus.ACTIVE,
      lastActiveFamilyId: demoFamily.id,
    },
  });

  await prisma.familyMembership.createMany({
    data: [
      { familyId: demoFamily.id, userId: superUser.id, role: UserRole.ADMIN },
      { familyId: demoFamily.id, userId: adminUser.id, role: UserRole.ADMIN },
      { familyId: demoFamily.id, userId: viewerUser.id, role: UserRole.VIEWER },
    ],
  });

  await seedFamilySettings(templateFamily.id);
  await seedFamilySettings(demoFamily.id);
  await seedDemoFamilyData(
    demoFamily.id,
    new Map([
      ['admin', adminUser.id],
      ['viewer', viewerUser.id],
    ]),
  );

  console.log('Seed completed:', {
    templateFamily: templateFamily.name,
    demoFamily: demoFamily.name,
    demoUsers: [
      'super/super123456 or 18800000000/super123456',
      'admin/admin123456 or 18800000001/admin123456',
      'viewer/viewer123456 or 18800000002/viewer123456',
    ],
    memberCount: defaultDemoTemplate.data.members.length,
  });
}

main()
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
