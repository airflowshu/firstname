import { ForbiddenException } from '@nestjs/common';
import { MembershipStatus, PlatformRole, UserRole, UserStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const prisma = {
    familyMembership: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const auditLogsService = {
    log: jest.fn(),
  };

  const service = new UsersService(prisma as never, auditLogsService as never);

  const operator: AuthenticatedUser = {
    sub: 'tenant-admin-id',
    username: 'tenant-admin',
    platformRole: PlatformRole.USER,
    activeFamilyId: 'family-id',
    familyRole: UserRole.ADMIN,
    role: UserRole.ADMIN,
    tokenVersion: 1,
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('filters platform super users from family user management', async () => {
    prisma.familyMembership.findMany.mockResolvedValue([]);

    await service.list(operator);

    expect(prisma.familyMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          familyId: 'family-id',
          user: { platformRole: PlatformRole.USER },
        },
      }),
    );
  });

  it('rejects adding a platform super user to a family through user management', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'super-id',
      username: 'super',
      phone: '18800000000',
      platformRole: PlatformRole.SUPER,
      memberships: [],
    });

    await expect(
      service.create(
        {
          username: '18800000000',
          password: 'super123456',
          role: UserRole.VIEWER,
        },
        operator,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.familyMembership.create).not.toHaveBeenCalled();
  });

  it('rejects editing a platform super user through family user management', async () => {
    prisma.familyMembership.findUnique.mockResolvedValue({
      userId: 'super-id',
      familyId: 'family-id',
      role: UserRole.ADMIN,
      status: MembershipStatus.ACTIVE,
      user: {
        id: 'super-id',
        username: 'super',
        phone: '18800000000',
        displayName: 'super',
        platformRole: PlatformRole.SUPER,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        lastLoginAt: null,
        createdAt: new Date(),
      },
    });

    await expect(service.update('super-id', { role: UserRole.VIEWER }, operator)).rejects.toThrow(
      ForbiddenException,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not update platform identity fields when editing a family user', async () => {
    const createdAt = new Date();
    const existingMembership = {
      userId: 'user-id',
      familyId: 'family-id',
      role: UserRole.VIEWER,
      status: MembershipStatus.ACTIVE,
      user: {
        id: 'user-id',
        username: '18800000001',
        phone: '18800000001',
        displayName: '18800000001',
        platformRole: PlatformRole.USER,
        role: UserRole.VIEWER,
        status: UserStatus.ACTIVE,
        lastLoginAt: null,
        createdAt,
      },
    };
    const tx = {
      user: {
        update: jest.fn().mockResolvedValue({
          ...existingMembership.user,
          status: UserStatus.DISABLED,
          updatedAt: new Date(),
        }),
      },
      familyMembership: {
        update: jest.fn().mockResolvedValue({
          ...existingMembership,
          role: UserRole.ADMIN,
        }),
      },
    };

    prisma.familyMembership.findUnique.mockResolvedValue(existingMembership);
    prisma.$transaction.mockImplementation((callback) => callback(tx));
    auditLogsService.log.mockResolvedValue(null);

    await service.update(
      'user-id',
      {
        username: '18800000999',
        role: UserRole.ADMIN,
        status: UserStatus.DISABLED,
      },
      operator,
    );

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: {
        status: UserStatus.DISABLED,
        passwordHash: undefined,
      },
    });
  });
});
