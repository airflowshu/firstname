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

  it('should reject cemetery marker when life status is not deceased', async () => {
    prisma.member.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        {
          name: '测试成员',
          gender: Gender.MALE,
          lifeStatus: LifeStatus.ALIVE,
          cemeteryLatitude: 31.2304,
          cemeteryLongitude: 121.4737,
        },
        'operator-id',
      ),
    ).rejects.toThrow('只有生命状态为“已故”时才能维护墓地位置标记');
  });

  it('should reject cemetery marker when only one coordinate is provided', async () => {
    prisma.member.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        {
          name: '测试成员',
          gender: Gender.MALE,
          lifeStatus: LifeStatus.DECEASED,
          cemeteryLatitude: 31.2304,
        },
        'operator-id',
      ),
    ).rejects.toThrow('墓地位置标记需要同时填写经纬度坐标');
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

  it('should bind existing member as quick father without creating a new member', async () => {
    const getByIdSpy = jest
      .spyOn(service, 'getById')
      .mockResolvedValue({ id: 'existing-father' } as never);
    prisma.member.findFirst
      .mockResolvedValueOnce({
        id: 'anchor-member',
        name: '子女成员',
        gender: Gender.MALE,
        birthDate: new Date('2000-01-01'),
        deathDate: null,
        lifeStatus: LifeStatus.ALIVE,
        fatherId: null,
        motherId: null,
        father: null,
        mother: null,
        isDeleted: false,
      })
      .mockResolvedValueOnce({
        id: 'existing-father',
        name: '已有父亲',
        gender: Gender.MALE,
        birthDate: new Date('1970-01-01'),
        isDeleted: false,
      });
    prisma.member.update.mockResolvedValue({});

    try {
      await service.createQuickRelative(
        'anchor-member',
        {
          relationType: 'father',
          existingMemberId: 'existing-father',
          member: {
            name: '已有父亲',
            gender: Gender.MALE,
          },
        },
        'operator-id',
      );
    } finally {
      getByIdSpy.mockRestore();
    }

    expect(prisma.member.create).not.toHaveBeenCalled();
    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 'anchor-member' },
      data: { fatherId: 'existing-father' },
    });
  });

  it('should bind existing member as quick child without creating a new member', async () => {
    const getByIdSpy = jest
      .spyOn(service, 'getById')
      .mockResolvedValue({ id: 'existing-child' } as never);
    prisma.member.findFirst
      .mockResolvedValueOnce({
        id: 'anchor-member',
        name: '父亲成员',
        gender: Gender.MALE,
        birthDate: new Date('1970-01-01'),
        deathDate: null,
        lifeStatus: LifeStatus.ALIVE,
        fatherId: null,
        motherId: null,
        father: null,
        mother: null,
        isDeleted: false,
      })
      .mockResolvedValueOnce({
        id: 'existing-child',
        name: '已有子女',
        gender: Gender.MALE,
        birthDate: new Date('2000-01-01'),
        deathDate: null,
        lifeStatus: LifeStatus.ALIVE,
        fatherId: null,
        motherId: null,
        isDeleted: false,
      })
      .mockResolvedValueOnce({
        id: 'anchor-member',
        name: '父亲成员',
        gender: Gender.MALE,
        birthDate: new Date('1970-01-01'),
        isDeleted: false,
      });
    prisma.member.update.mockResolvedValue({});

    try {
      await service.createQuickRelative(
        'anchor-member',
        {
          relationType: 'child',
          existingMemberId: 'existing-child',
          member: {
            name: '已有子女',
            gender: Gender.MALE,
          },
        },
        'operator-id',
      );
    } finally {
      getByIdSpy.mockRestore();
    }

    expect(prisma.member.create).not.toHaveBeenCalled();
    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 'existing-child' },
      data: {
        fatherId: 'anchor-member',
        motherId: undefined,
      },
    });
  });

  it('should clear death date and cemetery fields when member is switched to alive', async () => {
    prisma.member.findUnique.mockResolvedValue({
      id: 'member-id',
      name: '已故成员',
      gender: Gender.MALE,
      birthDate: new Date('1950-01-01'),
      deathDate: new Date('2020-01-01'),
      lifeStatus: LifeStatus.DECEASED,
      cemeteryLatitude: 31.2304,
      cemeteryLongitude: 121.4737,
      cemeteryName: '福寿园',
      cemeteryAddress: '上海市某墓园',
      cemeteryPoiId: 'poi-1',
      cemeteryRemark: '一区三排',
      generationName: null,
      birthOrder: null,
      nativePlace: null,
      fatherId: null,
      motherId: null,
      notes: null,
      photoPath: null,
      familyId: 'family-id',
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.member.update.mockResolvedValue({});
    const getByIdSpy = jest.spyOn(service, 'getById').mockResolvedValue({ id: 'member-id' } as never);

    try {
      await service.update(
        'member-id',
        {
          lifeStatus: LifeStatus.ALIVE,
          deathDate: null,
          cemeteryLatitude: null,
          cemeteryLongitude: null,
          cemeteryName: null,
          cemeteryAddress: null,
          cemeteryPoiId: null,
          cemeteryRemark: null,
        },
        'operator-id',
      );
    } finally {
      getByIdSpy.mockRestore();
    }

    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 'member-id' },
      data: expect.objectContaining({
        lifeStatus: LifeStatus.ALIVE,
        deathDate: null,
        cemeteryLatitude: null,
        cemeteryLongitude: null,
        cemeteryName: null,
        cemeteryAddress: null,
        cemeteryPoiId: null,
        cemeteryRemark: null,
      }),
    });
  });
});
