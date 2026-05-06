import {
  InvitationType,
  MembershipStatus,
  PlatformRole,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { InvitationsService } from './invitations.service';

describe('InvitationsService', () => {
  const invitation = {
    id: 'invitation-id',
    codeHash: 'hash',
    type: InvitationType.FAMILY_MEMBER,
    familyId: 'family-id',
    targetRole: UserRole.VIEWER,
    createdById: 'admin-id',
    usedById: null,
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    family: {
      id: 'family-id',
      name: '默认家族',
      status: 'ACTIVE',
    },
    createdBy: {
      id: 'admin-id',
      status: UserStatus.ACTIVE,
    },
  };

  const prisma = {
    invitation: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    familyMembership: {
      upsert: jest.fn(),
    },
    family: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    kinshipAlias: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
    assetTag: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
    assetSource: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const service = new InvitationsService(
    prisma as never,
    { get: jest.fn() } as never,
    { log: jest.fn() } as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.invitation.findUnique.mockResolvedValue(invitation);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.invitation.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.create.mockResolvedValue({
      id: 'user-id',
      username: 'wangts_admin',
      phone: '18800000009',
      displayName: '王管理员',
    });
    prisma.familyMembership.upsert.mockResolvedValue({});
    prisma.user.update.mockResolvedValue({});
    prisma.invitation.update.mockResolvedValue({});
    prisma.family.create.mockResolvedValue({ id: 'new-family-id', name: '新家族' });
    prisma.family.findFirst.mockResolvedValue(null);
    prisma.kinshipAlias.findMany.mockResolvedValue([]);
    prisma.kinshipAlias.createMany.mockResolvedValue({ count: 0 });
    prisma.assetTag.findMany.mockResolvedValue([]);
    prisma.assetTag.createMany.mockResolvedValue({ count: 0 });
    prisma.assetSource.findMany.mockResolvedValue([]);
    prisma.assetSource.createMany.mockResolvedValue({ count: 0 });
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
  });

  it('creates invited users with the submitted username instead of phone', async () => {
    await service.accept('raw-code', {
      phone: '18800000009',
      username: 'wangts_admin',
      displayName: '王管理员',
      password: 'password123',
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          username: 'wangts_admin',
          phone: '18800000009',
          displayName: '王管理员',
          platformRole: PlatformRole.USER,
          role: UserRole.VIEWER,
          status: UserStatus.ACTIVE,
        }),
      }),
    );
    expect(prisma.familyMembership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: 'user-id',
          familyId: 'family-id',
          role: UserRole.VIEWER,
          status: MembershipStatus.ACTIVE,
        }),
      }),
    );
  });

  it('copies settings from the template family when accepting a family admin invitation', async () => {
    prisma.invitation.findUnique.mockResolvedValue({
      ...invitation,
      type: InvitationType.FAMILY_ADMIN,
      familyId: null,
      family: null,
      targetRole: UserRole.ADMIN,
    });
    prisma.family.findFirst.mockResolvedValue({
      id: 'template-family-id',
      _count: {
        kinshipAliases: 1,
        assetTags: 1,
        assetSources: 1,
      },
    });
    prisma.kinshipAlias.findMany.mockResolvedValue([
      {
        relationCode: 'F',
        standardTerm: '父亲',
        familyAlias: '阿爸',
        enabled: true,
      },
    ]);
    prisma.assetTag.findMany.mockResolvedValue([
      {
        name: '族谱',
        enabled: true,
        sortOrder: 10,
      },
    ]);
    prisma.assetSource.findMany.mockResolvedValue([
      {
        name: '族人提供',
        enabled: true,
        sortOrder: 20,
      },
    ]);

    await service.accept('raw-code', {
      phone: '18800000009',
      username: 'wangts_admin',
      displayName: '王管理员',
      password: 'password123',
      familyName: '新家族',
    });

    expect(prisma.kinshipAlias.createMany).toHaveBeenCalledWith({
      data: [
        {
          familyId: 'new-family-id',
          relationCode: 'F',
          standardTerm: '父亲',
          familyAlias: '阿爸',
          enabled: true,
        },
      ],
      skipDuplicates: true,
    });
    expect(prisma.assetTag.createMany).toHaveBeenCalledWith({
      data: [
        {
          familyId: 'new-family-id',
          name: '族谱',
          enabled: true,
          sortOrder: 10,
        },
      ],
      skipDuplicates: true,
    });
    expect(prisma.assetSource.createMany).toHaveBeenCalledWith({
      data: [
        {
          familyId: 'new-family-id',
          name: '族人提供',
          enabled: true,
          sortOrder: 20,
        },
      ],
      skipDuplicates: true,
    });
  });
});
