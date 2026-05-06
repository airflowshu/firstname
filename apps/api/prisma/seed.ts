import {
  PrismaClient,
  PlatformRole,
  UserRole,
  UserStatus,
  Gender,
  LifeStatus,
  MarriageStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function buildPairKey(firstId: string, secondId: string) {
  return [firstId, secondId].sort().join(':');
}

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.familyMembership.deleteMany();
  await prisma.assetSource.deleteMany();
  await prisma.assetTag.deleteMany();
  await prisma.kinshipAlias.deleteMany();
  await prisma.marriage.deleteMany();
  await prisma.member.deleteMany();
  await prisma.family.deleteMany();
  await prisma.user.deleteMany();

  const adminPasswordHash = await bcrypt.hash('admin123456', 10);
  const viewerPasswordHash = await bcrypt.hash('viewer123456', 10);
  const superPasswordHash = await bcrypt.hash('super123456', 10);

  const defaultFamily = await prisma.family.create({
    data: {
      name: '默认家族',
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
      lastActiveFamilyId: defaultFamily.id,
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
      lastActiveFamilyId: defaultFamily.id,
    },
  });

  await prisma.familyMembership.createMany({
    data: [
      { familyId: defaultFamily.id, userId: superUser.id, role: UserRole.ADMIN },
      { familyId: defaultFamily.id, userId: adminUser.id, role: UserRole.ADMIN },
      { familyId: defaultFamily.id, userId: viewerUser.id, role: UserRole.VIEWER },
    ],
  });

  const zhenshan = await prisma.member.create({
    data: {
      name: '王振山',
      familyId: defaultFamily.id,
      gender: Gender.MALE,
      birthDate: new Date('1938-05-03'),
      lifeStatus: LifeStatus.ALIVE,
      generationName: '振',
      birthOrder: 1,
      nativePlace: '江苏徐州',
      notes: '家族长辈示例数据',
    },
  });

  const xiulan = await prisma.member.create({
    data: {
      name: '李秀兰',
      familyId: defaultFamily.id,
      gender: Gender.FEMALE,
      birthDate: new Date('1940-10-12'),
      lifeStatus: LifeStatus.ALIVE,
      nativePlace: '江苏徐州',
    },
  });

  const guohua = await prisma.member.create({
    data: {
      name: '王国华',
      familyId: defaultFamily.id,
      gender: Gender.MALE,
      birthDate: new Date('1965-03-15'),
      lifeStatus: LifeStatus.ALIVE,
      generationName: '国',
      birthOrder: 1,
      fatherId: zhenshan.id,
      motherId: xiulan.id,
      nativePlace: '江苏徐州',
    },
  });

  const guoqiang = await prisma.member.create({
    data: {
      name: '王国强',
      familyId: defaultFamily.id,
      gender: Gender.MALE,
      birthDate: new Date('1968-08-09'),
      lifeStatus: LifeStatus.ALIVE,
      generationName: '国',
      birthOrder: 2,
      fatherId: zhenshan.id,
      motherId: xiulan.id,
      nativePlace: '江苏徐州',
    },
  });

  await prisma.member.create({
    data: {
      name: '王桂芳',
      familyId: defaultFamily.id,
      gender: Gender.FEMALE,
      birthDate: new Date('1970-04-20'),
      lifeStatus: LifeStatus.ALIVE,
      generationName: '桂',
      birthOrder: 3,
      fatherId: zhenshan.id,
      motherId: xiulan.id,
      nativePlace: '江苏徐州',
    },
  });

  const meilan = await prisma.member.create({
    data: {
      name: '张美兰',
      familyId: defaultFamily.id,
      gender: Gender.FEMALE,
      birthDate: new Date('1967-01-23'),
      lifeStatus: LifeStatus.ALIVE,
      nativePlace: '安徽宿州',
    },
  });

  const chenfang = await prisma.member.create({
    data: {
      name: '陈芳',
      familyId: defaultFamily.id,
      gender: Gender.FEMALE,
      birthDate: new Date('1972-07-30'),
      lifeStatus: LifeStatus.ALIVE,
      nativePlace: '山东枣庄',
    },
  });

  const leiming = await prisma.member.create({
    data: {
      name: '王磊',
      familyId: defaultFamily.id,
      gender: Gender.MALE,
      birthDate: new Date('1990-11-05'),
      lifeStatus: LifeStatus.ALIVE,
      generationName: '磊',
      birthOrder: 1,
      fatherId: guohua.id,
      motherId: meilan.id,
      nativePlace: '江苏徐州',
    },
  });

  await prisma.member.create({
    data: {
      name: '王敏',
      familyId: defaultFamily.id,
      gender: Gender.FEMALE,
      birthDate: new Date('1994-02-17'),
      lifeStatus: LifeStatus.ALIVE,
      generationName: '敏',
      birthOrder: 2,
      fatherId: guohua.id,
      motherId: meilan.id,
      nativePlace: '江苏徐州',
    },
  });

  await prisma.member.create({
    data: {
      name: '王浩',
      familyId: defaultFamily.id,
      gender: Gender.MALE,
      birthDate: new Date('1998-06-01'),
      lifeStatus: LifeStatus.ALIVE,
      generationName: '浩',
      birthOrder: 1,
      fatherId: guoqiang.id,
      motherId: chenfang.id,
      nativePlace: '江苏徐州',
    },
  });

  const liuyan = await prisma.member.create({
    data: {
      name: '刘妍',
      familyId: defaultFamily.id,
      gender: Gender.FEMALE,
      birthDate: new Date('1992-09-13'),
      lifeStatus: LifeStatus.ALIVE,
      nativePlace: '江苏徐州',
    },
  });

  const chenxi = await prisma.member.create({
    data: {
      name: '王晨曦',
      familyId: defaultFamily.id,
      gender: Gender.MALE,
      birthDate: new Date('2020-01-19'),
      lifeStatus: LifeStatus.ALIVE,
      generationName: '晨',
      birthOrder: 1,
      fatherId: leiming.id,
      motherId: liuyan.id,
      nativePlace: '江苏徐州',
    },
  });

  await prisma.marriage.createMany({
    data: [
      {
        familyId: defaultFamily.id,
        pairKey: buildPairKey(zhenshan.id, xiulan.id),
        memberId: zhenshan.id,
        spouseId: xiulan.id,
        status: MarriageStatus.ACTIVE,
        startDate: new Date('1962-01-01'),
      },
      {
        familyId: defaultFamily.id,
        pairKey: buildPairKey(guohua.id, meilan.id),
        memberId: guohua.id,
        spouseId: meilan.id,
        status: MarriageStatus.ACTIVE,
        startDate: new Date('1988-01-01'),
      },
      {
        familyId: defaultFamily.id,
        pairKey: buildPairKey(guoqiang.id, chenfang.id),
        memberId: guoqiang.id,
        spouseId: chenfang.id,
        status: MarriageStatus.ACTIVE,
        startDate: new Date('1996-01-01'),
      },
      {
        familyId: defaultFamily.id,
        pairKey: buildPairKey(leiming.id, liuyan.id),
        memberId: leiming.id,
        spouseId: liuyan.id,
        status: MarriageStatus.ACTIVE,
        startDate: new Date('2018-01-01'),
      },
    ],
  });

  await prisma.kinshipAlias.createMany({
    data: [
      {
        familyId: defaultFamily.id,
        relationCode: 'F',
        standardTerm: '父亲',
        familyAlias: '阿爸',
      },
      {
        familyId: defaultFamily.id,
        relationCode: 'M',
        standardTerm: '母亲',
        familyAlias: '阿妈',
      },
      {
        familyId: defaultFamily.id,
        relationCode: 'F>F',
        standardTerm: '祖父',
        familyAlias: '阿公',
      },
      {
        familyId: defaultFamily.id,
        relationCode: 'F>M',
        standardTerm: '祖母',
        familyAlias: '阿婆',
      },
      {
        familyId: defaultFamily.id,
        relationCode: 'M>OB',
        standardTerm: '舅舅',
        familyAlias: '大舅',
      },
    ],
  });

  await prisma.assetTag.createMany({
    data: [
      { familyId: defaultFamily.id, name: '合影', enabled: true, sortOrder: 10 },
      { familyId: defaultFamily.id, name: '证书', enabled: true, sortOrder: 20 },
      { familyId: defaultFamily.id, name: '毕业', enabled: true, sortOrder: 30 },
      { familyId: defaultFamily.id, name: '婚礼', enabled: true, sortOrder: 40 },
      { familyId: defaultFamily.id, name: '祖宅', enabled: true, sortOrder: 50 },
      { familyId: defaultFamily.id, name: '墓碑', enabled: true, sortOrder: 60 },
      { familyId: defaultFamily.id, name: '族谱', enabled: true, sortOrder: 70 },
      { familyId: defaultFamily.id, name: '口述资料', enabled: true, sortOrder: 80 },
    ],
  });

  await prisma.assetSource.createMany({
    data: [
      { familyId: defaultFamily.id, name: '族人提供', enabled: true, sortOrder: 10 },
      { familyId: defaultFamily.id, name: '老相册翻拍', enabled: true, sortOrder: 20 },
      { familyId: defaultFamily.id, name: '证件扫描', enabled: true, sortOrder: 30 },
      { familyId: defaultFamily.id, name: '地方志摘录', enabled: true, sortOrder: 40 },
      { familyId: defaultFamily.id, name: '墓碑抄录', enabled: true, sortOrder: 50 },
      { familyId: defaultFamily.id, name: '口述整理', enabled: true, sortOrder: 60 },
    ],
  });

  console.log('Seed completed:', {
    demoUsers: [
      'super/super123456 or 18800000000/super123456',
      'admin/admin123456 or 18800000001/admin123456',
      'viewer/viewer123456 or 18800000002/viewer123456',
    ],
    memberCount: 11,
    sampleChild: chenxi.name,
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
