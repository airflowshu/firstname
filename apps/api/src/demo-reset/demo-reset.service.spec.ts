import {
  FamilyType,
  PlatformRole,
  UserRole,
} from '@prisma/client';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { DemoResetService } from './demo-reset.service';

describe('DemoResetService', () => {
  const prisma = {
    family: {
      findUnique: jest.fn(),
    },
    member: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    marriage: {
      count: jest.fn(),
    },
    memberEvent: {
      count: jest.fn(),
    },
    memberAsset: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    invitation: {
      count: jest.fn(),
    },
    familyMembership: {
      count: jest.fn(),
    },
    supplementRequest: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    supplementRequestAsset: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const service = new DemoResetService(prisma as never);

  const superUser: AuthenticatedUser = {
    sub: 'super-id',
    username: 'super',
    platformRole: PlatformRole.SUPER,
    activeFamilyId: null,
    familyRole: null,
    role: UserRole.ADMIN,
    tokenVersion: 1,
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns reset preview for demo families', async () => {
    prisma.family.findUnique.mockResolvedValue({
      id: 'demo-family',
      name: '默认演示家族',
      familyType: FamilyType.DEMO,
      resetTemplateKey: 'default-demo',
    });
    prisma.$transaction.mockResolvedValue([11, 4, 2, 0, 1, 3, 2]);

    const result = await service.preview('demo-family');

    expect(result).toMatchObject({
      familyId: 'demo-family',
      familyName: '默认演示家族',
      templateKey: 'default-demo',
      confirmationText: '默认演示家族',
      counts: {
        members: 11,
        marriages: 4,
        customEvents: 2,
        assets: 0,
        invitations: 1,
        supplementRequests: 3,
        systemAccounts: 2,
      },
    });
  });

  it('rejects preview for non-demo families', async () => {
    prisma.family.findUnique.mockResolvedValue({
      id: 'standard-family',
      name: '真实家族',
      familyType: FamilyType.STANDARD,
      resetTemplateKey: null,
    });

    await expect(service.preview('standard-family')).rejects.toThrow(ForbiddenException);
  });

  it('rejects reset when confirmation text does not match', async () => {
    prisma.family.findUnique.mockResolvedValue({
      id: 'demo-family',
      name: '默认演示家族',
      familyType: FamilyType.DEMO,
      resetTemplateKey: 'default-demo',
    });

    await expect(service.reset('demo-family', '演示环境', superUser)).rejects.toThrow(
      BadRequestException,
    );
  });
});
