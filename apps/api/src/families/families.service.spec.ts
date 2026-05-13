import { FamilyStatus, FamilyType } from '@prisma/client';
import { FamiliesService } from './families.service';

describe('FamiliesService', () => {
  const prisma = {
    family: {
      findMany: jest.fn(),
    },
  };

  const service = new FamiliesService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('marks demo families with template keys as resettable', async () => {
    prisma.family.findMany.mockResolvedValue([
      {
        id: 'demo-family',
        name: '演示家族',
        status: FamilyStatus.ACTIVE,
        familyType: FamilyType.DEMO,
        resetTemplateKey: 'default-demo',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        _count: {
          memberships: 3,
          members: 12,
        },
      },
      {
        id: 'standard-family',
        name: '真实家族',
        status: FamilyStatus.ACTIVE,
        familyType: FamilyType.STANDARD,
        resetTemplateKey: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        _count: {
          memberships: 5,
          members: 28,
        },
      },
      {
        id: 'template-family',
        name: '系统设置模板家族',
        status: FamilyStatus.ACTIVE,
        familyType: FamilyType.TEMPLATE,
        resetTemplateKey: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        _count: {
          memberships: 0,
          members: 0,
        },
      },
    ]);

    const result = await service.listPlatformFamilies();

    expect(prisma.family.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          familyType: {
            not: FamilyType.TEMPLATE,
          },
        },
      }),
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'demo-family',
      familyType: FamilyType.DEMO,
      resetTemplateKey: 'default-demo',
      canResetDemoData: true,
    });
    expect(result[1]).toMatchObject({
      id: 'standard-family',
      familyType: FamilyType.STANDARD,
      canResetDemoData: false,
    });
  });
});
