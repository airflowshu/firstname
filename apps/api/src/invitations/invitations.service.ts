import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  FamilyType,
  FamilyStatus,
  InvitationType,
  MembershipStatus,
  PlatformRole,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AcceptInvitationDto,
  CreateFamilyAdminInvitationDto,
  CreateFamilyMemberInvitationDto,
} from './dto/invitation.dto';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async createFamilyAdminInvitation(dto: CreateFamilyAdminInvitationDto, user: AuthenticatedUser) {
    const invitation = await this.createInvitation({
      type: InvitationType.FAMILY_ADMIN,
      targetRole: UserRole.ADMIN,
      createdById: user.sub,
      expiresAt: this.addDays(dto.expiresInDays ?? 7),
    });

    await this.auditLogsService.log({
      operatorId: user.sub,
      action: AuditAction.CREATE,
      targetType: 'INVITATION',
      targetId: invitation.id,
      after: {
        type: invitation.type,
        expiresAt: invitation.expiresAt,
      },
    });

    return invitation;
  }

  async createFamilyMemberInvitation(
    dto: CreateFamilyMemberInvitationDto,
    user: AuthenticatedUser,
  ) {
    if (!user.activeFamilyId) {
      throw new ForbiddenException('请先进入一个家族后再创建邀请。');
    }

    const family = await this.prisma.family.findFirst({
      where: { id: user.activeFamilyId, status: FamilyStatus.ACTIVE },
    });

    if (!family) {
      throw new NotFoundException('当前家族不存在或已停用。');
    }

    const invitation = await this.createInvitation({
      type: InvitationType.FAMILY_MEMBER,
      targetRole: UserRole.VIEWER,
      familyId: family.id,
      createdById: user.sub,
      expiresAt: this.addHours(dto.expiresInHours ?? 72),
    });

    await this.auditLogsService.log({
      familyId: family.id,
      operatorId: user.sub,
      action: AuditAction.CREATE,
      targetType: 'INVITATION',
      targetId: invitation.id,
      after: {
        type: invitation.type,
        familyId: family.id,
        expiresAt: invitation.expiresAt,
      },
    });

    return invitation;
  }

  async inspect(code: string) {
    const invitation = await this.findInvitationByCode(code);
    const now = new Date();

    return {
      id: invitation.id,
      type: invitation.type,
      targetRole: invitation.targetRole,
      family: invitation.family
        ? {
            id: invitation.family.id,
            name: invitation.family.name,
            status: invitation.family.status,
          }
        : null,
      expiresAt: invitation.expiresAt,
      usedAt: invitation.usedAt,
      available:
        !invitation.usedAt &&
        invitation.expiresAt.getTime() > now.getTime() &&
        (!invitation.family || invitation.family.status === FamilyStatus.ACTIVE),
    };
  }

  async accept(code: string, dto: AcceptInvitationDto) {
    const invitation = await this.findInvitationByCode(code);
    const now = new Date();

    if (invitation.usedAt) {
      throw new ConflictException('该邀请链接已被使用。');
    }

    if (invitation.expiresAt.getTime() <= now.getTime()) {
      throw new BadRequestException('该邀请链接已过期。');
    }

    if (invitation.createdBy?.status === UserStatus.DISABLED) {
      throw new BadRequestException('邀请人账号已停用，该邀请不可继续使用。');
    }

    if (invitation.family && invitation.family.status !== FamilyStatus.ACTIVE) {
      throw new BadRequestException('目标家族已停用，该邀请不可继续使用。');
    }

    if (invitation.type === InvitationType.FAMILY_ADMIN && !dto.familyName?.trim()) {
      throw new BadRequestException('创建家族时需要填写家族名称。');
    }

    const normalizedPhone = dto.phone.trim();
    const normalizedUsername = dto.username.trim();
    const normalizedDisplayName = dto.displayName?.trim() || normalizedUsername;
    const existingUserByPhone = await this.prisma.user.findFirst({
      where: { phone: normalizedPhone },
    });
    const usernameOwner = await this.prisma.user.findUnique({
      where: { username: normalizedUsername },
    });
    const existingUser = existingUserByPhone ?? usernameOwner;

    if (usernameOwner && usernameOwner.id !== existingUserByPhone?.id) {
      throw new ConflictException('该用户名已被使用，请更换后重试。');
    }

    if (existingUserByPhone && existingUserByPhone.username !== normalizedUsername) {
      throw new BadRequestException('该手机号已注册，请填写该账号当前用户名。');
    }

    if (existingUser) {
      const passwordMatched = await bcrypt.compare(dto.password, existingUser.passwordHash);
      if (!passwordMatched) {
        throw new UnauthorizedException('该手机号已注册，请输入正确密码后加入。');
      }

      if (existingUser.status !== UserStatus.ACTIVE) {
        throw new ForbiddenException('该账号已停用，无法接受邀请。');
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.invitation.updateMany({
        where: {
          id: invitation.id,
          usedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          usedAt: now,
        },
      });

      if (claimed.count !== 1) {
        throw new ConflictException('该邀请链接已被使用或已过期。');
      }

      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            username: normalizedUsername,
            phone: normalizedPhone,
            displayName: normalizedDisplayName,
            passwordHash: await bcrypt.hash(dto.password, 10),
            platformRole: PlatformRole.USER,
            role: UserRole.VIEWER,
            status: UserStatus.ACTIVE,
          },
        }));

      let familyId = invitation.familyId;
      let familyName = invitation.family?.name ?? null;
      let role = invitation.targetRole;

      if (invitation.type === InvitationType.FAMILY_ADMIN) {
        const family = await tx.family.create({
          data: {
            name: dto.familyName!.trim(),
            createdById: user.id,
          },
        });
        await this.initializeFamilySettings(tx, family.id);
        familyId = family.id;
        familyName = family.name;
        role = UserRole.ADMIN;
      }

      if (!familyId) {
        throw new BadRequestException('邀请缺少目标家族。');
      }

      await tx.familyMembership.upsert({
        where: {
          userId_familyId: {
            userId: user.id,
            familyId,
          },
        },
        create: {
          userId: user.id,
          familyId,
          role,
          status: MembershipStatus.ACTIVE,
        },
        update: {
          role,
          status: MembershipStatus.ACTIVE,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          phone: user.phone ?? normalizedPhone,
          displayName: user.displayName ?? normalizedDisplayName,
          lastActiveFamilyId: familyId,
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          usedById: user.id,
        },
      });

      return {
        userId: user.id,
        familyId,
        familyName,
        role,
      };
    });

    await this.auditLogsService.log({
      familyId: result.familyId,
      operatorId: result.userId,
      action: AuditAction.CREATE,
      targetType: 'INVITATION_ACCEPT',
      targetId: invitation.id,
      metadata: {
        type: invitation.type,
        familyId: result.familyId,
        role: result.role,
      },
    });

    return {
      success: true,
      userId: result.userId,
      family: {
        id: result.familyId,
        name: result.familyName,
      },
      role: result.role,
    };
  }

  private async createInvitation(params: {
    type: InvitationType;
    targetRole: UserRole;
    familyId?: string;
    createdById?: string;
    expiresAt: Date;
  }) {
    const code = randomBytes(32).toString('base64url');
    const created = await this.prisma.invitation.create({
      data: {
        codeHash: this.hashCode(code),
        type: params.type,
        familyId: params.familyId,
        targetRole: params.targetRole,
        createdById: params.createdById,
        expiresAt: params.expiresAt,
      },
      include: {
        family: true,
      },
    });

    return {
      id: created.id,
      code,
      inviteUrl: `${this.frontendBaseUrl()}/invite/${code}`,
      type: created.type,
      family: created.family
        ? {
            id: created.family.id,
            name: created.family.name,
          }
        : null,
      expiresAt: created.expiresAt,
    };
  }

  private async findInvitationByCode(code: string) {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      throw new NotFoundException('邀请链接不存在。');
    }

    const invitation = await this.prisma.invitation.findUnique({
      where: { codeHash: this.hashCode(normalizedCode) },
      include: {
        family: true,
        createdBy: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('邀请链接不存在。');
    }

    return invitation;
  }

  private async initializeFamilySettings(tx: Prisma.TransactionClient, familyId: string) {
    const sourceFamilyId = await this.findSettingsTemplateFamilyId(tx, familyId);
    if (!sourceFamilyId) {
      return;
    }

    const [aliases, tags, sources] = await Promise.all([
      tx.kinshipAlias.findMany({
        where: { familyId: sourceFamilyId },
        select: {
          relationCode: true,
          standardTerm: true,
          familyAlias: true,
          enabled: true,
        },
      }),
      tx.assetTag.findMany({
        where: { familyId: sourceFamilyId },
        select: {
          name: true,
          enabled: true,
          sortOrder: true,
        },
      }),
      tx.assetSource.findMany({
        where: { familyId: sourceFamilyId },
        select: {
          name: true,
          enabled: true,
          sortOrder: true,
        },
      }),
    ]);

    await Promise.all([
      aliases.length
        ? tx.kinshipAlias.createMany({
            data: aliases.map((alias) => ({
              familyId,
              relationCode: alias.relationCode,
              standardTerm: alias.standardTerm,
              familyAlias: alias.familyAlias,
              enabled: alias.enabled,
            })),
            skipDuplicates: true,
          })
        : Promise.resolve(),
      tags.length
        ? tx.assetTag.createMany({
            data: tags.map((tag) => ({
              familyId,
              name: tag.name,
              enabled: tag.enabled,
              sortOrder: tag.sortOrder,
            })),
            skipDuplicates: true,
          })
        : Promise.resolve(),
      sources.length
        ? tx.assetSource.createMany({
            data: sources.map((source) => ({
              familyId,
              name: source.name,
              enabled: source.enabled,
              sortOrder: source.sortOrder,
            })),
            skipDuplicates: true,
          })
        : Promise.resolve(),
    ]);
  }

  private async findSettingsTemplateFamilyId(tx: Prisma.TransactionClient, targetFamilyId: string) {
    const templateFamily = await tx.family.findFirst({
      where: {
        id: { not: targetFamilyId },
        familyType: FamilyType.TEMPLATE,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        _count: {
          select: {
            kinshipAliases: true,
            assetTags: true,
            assetSources: true,
          },
        },
      },
    });

    if (!templateFamily || !this.hasSettings(templateFamily._count)) {
      return undefined;
    }

    return templateFamily.id;
  }

  private hasSettings(counts: { kinshipAliases: number; assetTags: number; assetSources: number }) {
    return counts.kinshipAliases > 0 || counts.assetTags > 0 || counts.assetSources > 0;
  }

  private hashCode(code: string) {
    return createHash('sha256').update(code).digest('hex');
  }

  private addDays(days: number) {
    return new Date(Date.now() + days * 86_400_000);
  }

  private addHours(hours: number) {
    return new Date(Date.now() + hours * 3_600_000);
  }

  private frontendBaseUrl() {
    return this.configService.get<string>('frontendBaseUrl', 'http://localhost:3000');
  }
}
