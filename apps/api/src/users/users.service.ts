import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, MembershipStatus, PlatformRole, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async list(operator: AuthenticatedUser) {
    const familyId = this.requireFamilyId(operator);
    const memberships = await this.prisma.familyMembership.findMany({
      where: {
        familyId,
        user: { platformRole: PlatformRole.USER },
      },
      include: { user: true },
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    });

    return memberships.map((membership) =>
      this.serializeUser({
        ...membership.user,
        role: membership.role,
        membershipStatus: membership.status,
      }),
    );
  }

  async create(dto: CreateUserDto, operator: AuthenticatedUser) {
    const familyId = this.requireFamilyId(operator);
    const normalizedUsername = dto.username.trim();
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: normalizedUsername }, { phone: normalizedUsername }],
      },
      include: {
        memberships: {
          where: { familyId },
        },
      },
    });

    if (existingUser?.memberships.length) {
      throw new ConflictException('该账号已在当前家族中，请直接编辑现有成员。');
    }

    if (existingUser?.platformRole === PlatformRole.SUPER) {
      throw new ForbiddenException('平台超级管理员账号不能加入或作为家族用户管理。');
    }

    const user =
      existingUser ??
      (await this.prisma.user.create({
        data: {
          username: normalizedUsername,
          phone: normalizedUsername,
          displayName: normalizedUsername,
          passwordHash: await bcrypt.hash(dto.password, 10),
          role: UserRole.VIEWER,
          status: dto.status ?? UserStatus.ACTIVE,
          lastActiveFamilyId: familyId,
        },
      }));

    const membership = await this.prisma.familyMembership.create({
      data: {
        userId: user.id,
        familyId,
        role: dto.role,
        status: MembershipStatus.ACTIVE,
      },
      include: { user: true },
    });

    await this.auditLogsService.log({
      familyId,
      operatorId: operator.sub,
      action: dto.role === UserRole.ADMIN ? AuditAction.ROLE_CHANGE : AuditAction.CREATE,
      targetType: 'USER',
      targetId: user.id,
      after: this.serializeUser({
        ...membership.user,
        role: membership.role,
        membershipStatus: membership.status,
      }),
    });

    return this.serializeUser({
      ...membership.user,
      role: membership.role,
      membershipStatus: membership.status,
    });
  }

  async update(id: string, dto: UpdateUserDto, operator: AuthenticatedUser) {
    const familyId = this.requireFamilyId(operator);
    const membership = await this.prisma.familyMembership.findUnique({
      where: {
        userId_familyId: {
          userId: id,
          familyId,
        },
      },
      include: { user: true },
    });

    if (!membership) {
      throw new NotFoundException('未找到当前家族中的指定用户。');
    }

    if (membership.user.platformRole === PlatformRole.SUPER) {
      throw new ForbiddenException('平台超级管理员账号不能在家族用户管理中查看或操作。');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: {
          status: dto.status,
          passwordHash: dto.password ? await bcrypt.hash(dto.password, 10) : undefined,
        },
      });
      const updatedMembership = await tx.familyMembership.update({
        where: {
          userId_familyId: {
            userId: id,
            familyId,
          },
        },
        data: {
          role: dto.role,
        },
      });

      return { updatedUser, updatedMembership };
    });

    await this.auditLogsService.log({
      familyId,
      operatorId: operator.sub,
      action:
        dto.role && dto.role !== membership.role ? AuditAction.ROLE_CHANGE : AuditAction.UPDATE,
      targetType: 'USER',
      targetId: id,
      before: this.serializeUser({
        ...membership.user,
        role: membership.role,
        membershipStatus: membership.status,
      }),
      after: this.serializeUser({
        ...updated.updatedUser,
        role: updated.updatedMembership.role,
        membershipStatus: updated.updatedMembership.status,
      }),
    });

    return this.serializeUser({
      ...updated.updatedUser,
      role: updated.updatedMembership.role,
      membershipStatus: updated.updatedMembership.status,
    });
  }

  private requireFamilyId(user: AuthenticatedUser) {
    if (!user.activeFamilyId) {
      throw new ForbiddenException('请先进入一个家族后再管理用户。');
    }

    return user.activeFamilyId;
  }

  private serializeUser(user: {
    id: string;
    username: string;
    phone?: string | null;
    displayName?: string | null;
    platformRole: PlatformRole;
    role: UserRole;
    status: UserStatus;
    membershipStatus?: MembershipStatus;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt?: Date;
  }) {
    return {
      id: user.id,
      username: user.username,
      phone: user.phone,
      displayName: user.displayName ?? user.username,
      platformRole: user.platformRole,
      role: user.role,
      status: user.status,
      membershipStatus: user.membershipStatus,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
