import {
  PrismaClient,
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
  await prisma.assetSource.deleteMany();
  await prisma.assetTag.deleteMany();
  await prisma.kinshipAlias.deleteMany();
  await prisma.marriage.deleteMany();
  await prisma.member.deleteMany();
  await prisma.user.deleteMany();

  const adminPasswordHash = await bcrypt.hash('admin123456', 10);
  const viewerPasswordHash = await bcrypt.hash('viewer123456', 10);

  await prisma.user.createMany({
    data: [
      {
        username: 'admin',
        passwordHash: adminPasswordHash,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
      {
        username: 'viewer',
        passwordHash: viewerPasswordHash,
        role: UserRole.VIEWER,
        status: UserStatus.ACTIVE,
      },
    ],
  });

  const zhenshan = await prisma.member.create({
    data: {
      name: '王振山',
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
      gender: Gender.FEMALE,
      birthDate: new Date('1940-10-12'),
      lifeStatus: LifeStatus.ALIVE,
      nativePlace: '江苏徐州',
    },
  });

  const guohua = await prisma.member.create({
    data: {
      name: '王国华',
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
      gender: Gender.FEMALE,
      birthDate: new Date('1967-01-23'),
      lifeStatus: LifeStatus.ALIVE,
      nativePlace: '安徽宿州',
    },
  });

  const chenfang = await prisma.member.create({
    data: {
      name: '陈芳',
      gender: Gender.FEMALE,
      birthDate: new Date('1972-07-30'),
      lifeStatus: LifeStatus.ALIVE,
      nativePlace: '山东枣庄',
    },
  });

  const leiming = await prisma.member.create({
    data: {
      name: '王磊',
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
      gender: Gender.FEMALE,
      birthDate: new Date('1992-09-13'),
      lifeStatus: LifeStatus.ALIVE,
      nativePlace: '江苏徐州',
    },
  });

  const chenxi = await prisma.member.create({
    data: {
      name: '王晨曦',
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
        pairKey: buildPairKey(zhenshan.id, xiulan.id),
        memberId: zhenshan.id,
        spouseId: xiulan.id,
        status: MarriageStatus.ACTIVE,
        startDate: new Date('1962-01-01'),
      },
      {
        pairKey: buildPairKey(guohua.id, meilan.id),
        memberId: guohua.id,
        spouseId: meilan.id,
        status: MarriageStatus.ACTIVE,
        startDate: new Date('1988-01-01'),
      },
      {
        pairKey: buildPairKey(guoqiang.id, chenfang.id),
        memberId: guoqiang.id,
        spouseId: chenfang.id,
        status: MarriageStatus.ACTIVE,
        startDate: new Date('1996-01-01'),
      },
      {
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
        relationCode: 'F',
        standardTerm: '父亲',
        familyAlias: '阿爸',
      },
      {
        relationCode: 'M',
        standardTerm: '母亲',
        familyAlias: '阿妈',
      },
      {
        relationCode: 'F>F',
        standardTerm: '祖父',
        familyAlias: '阿公',
      },
      {
        relationCode: 'F>M',
        standardTerm: '祖母',
        familyAlias: '阿婆',
      },
      {
        relationCode: 'M>OB',
        standardTerm: '舅舅',
        familyAlias: '大舅',
      },
    ],
  });

  await prisma.assetTag.createMany({
    data: [
      { name: '合影', enabled: true, sortOrder: 10 },
      { name: '证书', enabled: true, sortOrder: 20 },
      { name: '毕业', enabled: true, sortOrder: 30 },
      { name: '婚礼', enabled: true, sortOrder: 40 },
      { name: '祖宅', enabled: true, sortOrder: 50 },
      { name: '墓碑', enabled: true, sortOrder: 60 },
      { name: '族谱', enabled: true, sortOrder: 70 },
      { name: '口述资料', enabled: true, sortOrder: 80 },
    ],
  });

  await prisma.assetSource.createMany({
    data: [
      { name: '族人提供', enabled: true, sortOrder: 10 },
      { name: '老相册翻拍', enabled: true, sortOrder: 20 },
      { name: '证件扫描', enabled: true, sortOrder: 30 },
      { name: '地方志摘录', enabled: true, sortOrder: 40 },
      { name: '墓碑抄录', enabled: true, sortOrder: 50 },
      { name: '口述整理', enabled: true, sortOrder: 60 },
    ],
  });

  console.log('Seed completed:', {
    demoUsers: ['admin/admin123456', 'viewer/viewer123456'],
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
