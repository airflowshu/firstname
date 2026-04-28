import { BadRequestException } from '@nestjs/common';
import { Gender, LifeStatus } from '@prisma/client';
import { MembersService } from './members.service';

describe('MembersService', () => {
  const prisma = {
    member: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    marriage: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const auditLogsService = {
    log: jest.fn(),
  };

  const cacheManager = {
    del: jest.fn(),
  };

  const service = new MembersService(
    prisma as never,
    auditLogsService as never,
    cacheManager as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.member.findMany.mockResolvedValue([]);
  });

  it('should reject death date when life status is not deceased', async () => {
    prisma.member.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        {
          name: '测试成员',
          gender: Gender.MALE,
          lifeStatus: LifeStatus.ALIVE,
          deathDate: '2020-01-01',
        },
        'operator-id',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject selecting a female member as father', async () => {
    prisma.member.findFirst
      .mockResolvedValueOnce({
        id: 'female-member',
        gender: Gender.FEMALE,
        birthDate: new Date('1970-01-01'),
      })
      .mockResolvedValueOnce(null);

    await expect(
      service.create(
        {
          name: '测试成员',
          gender: Gender.MALE,
          fatherId: 'female-member',
        },
        'operator-id',
      ),
    ).rejects.toThrow('父亲关系不能选择女性成员');
  });

  it('should reject child birth date earlier than father birth date', async () => {
    prisma.member.findFirst
      .mockResolvedValueOnce({
        id: 'father-member',
        gender: Gender.MALE,
        birthDate: new Date('1990-01-01'),
      })
      .mockResolvedValueOnce(null);

    await expect(
      service.create(
        {
          name: '测试成员',
          gender: Gender.MALE,
          fatherId: 'father-member',
          birthDate: '1989-01-01',
        },
        'operator-id',
      ),
    ).rejects.toThrow('成员出生日期必须晚于父亲的出生日期');
  });

  it('should reject quick create child when anchor gender is unknown', async () => {
    prisma.member.findFirst.mockResolvedValue({
      id: 'anchor-member',
      name: '未知成员',
      gender: Gender.UNKNOWN,
      fatherId: null,
      motherId: null,
      father: null,
      mother: null,
      isDeleted: false,
    });
    prisma.marriage.findMany.mockResolvedValue([]);

    await expect(
      service.createQuickRelative(
        'anchor-member',
        {
          relationType: 'child',
          member: {
            name: '测试子女',
            gender: Gender.MALE,
          },
        },
        'operator-id',
      ),
    ).rejects.toThrow('当前成员性别未知，暂无法快速新增子女');
  });

  it('should reject quick create sibling when anchor has no parents', async () => {
    prisma.member.findFirst.mockResolvedValue({
      id: 'anchor-member',
      name: '独生成员',
      gender: Gender.MALE,
      fatherId: null,
      motherId: null,
      father: null,
      mother: null,
      isDeleted: false,
    });
    prisma.marriage.findMany.mockResolvedValue([]);

    await expect(
      service.createQuickRelative(
        'anchor-member',
        {
          relationType: 'sibling',
          member: {
            name: '测试兄弟',
            gender: Gender.MALE,
          },
        },
        'operator-id',
      ),
    ).rejects.toThrow('当前成员尚未录入父母信息，暂无法快速新增兄弟姐妹');
  });
});
