import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FamilyType,
  LifeStatus,
  MembershipStatus,
  PlatformRole,
  Prisma,
  UserStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { getDemoResetTemplate } from './templates';

type DemoResetPreview = {
  familyId: string;
  familyName: string;
  familyType: FamilyType;
  templateKey: string;
  confirmationText: string;
  counts: {
    members: number;
    marriages: number;
    customEvents: number;
    assets: number;
    invitations: number;
    supplementRequests: number;
    systemAccounts: number;
  };
  warnings: string[];
};

type DemoResetResult = {
  success: true;
  familyId: string;
  familyName: string;
  templateKey: string;
  resetAt: string;
  summary: {
    cleared: DemoResetPreview['counts'];
    recreated: {
      members: number;
      marriages: number;
      customEvents: number;
      assets: number;
      systemAccounts: number;
      kinshipAliases: number;
      assetTags: number;
      assetSources: number;
    };
    removedMemberships: number;
    resetUsers: string[];
    deletedFileCount: number;
  };
};

@Injectable()
export class DemoResetService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(familyId: string): Promise<DemoResetPreview> {
    const family = await this.getResettableFamily(familyId);
    return this.buildPreview(family);
  }

  async reset(
    familyId: string,
    confirmationText: string,
    operator: AuthenticatedUser,
  ): Promise<DemoResetResult> {
    if (operator.platformRole !== PlatformRole.SUPER) {
      throw new ForbiddenException('仅平台超级管理员可重置演示家族。');
    }

    const family = await this.getResettableFamily(familyId);
    const expectedConfirmationText = family.name;
    if (confirmationText.trim() !== expectedConfirmationText) {
      throw new BadRequestException(`确认文本不匹配，请输入“${expectedConfirmationText}”。`);
    }

    const template = getDemoResetTemplate(family.resetTemplateKey!);
    if (!template) {
      throw new NotFoundException('未找到该演示家族绑定的重置模板。');
    }

    const preview = await this.buildPreview(family);
    const filePaths = await this.collectFamilyFilePaths(familyId);
    const hashedUsers = await Promise.all(
      template.users.map(async (user) => ({
        ...user,
        passwordHash: await bcrypt.hash(user.password, 10),
      })),
    );

    const summary = await this.prisma.$transaction(async (tx) => {
      const currentMemberships = await tx.familyMembership.findMany({
        where: { familyId },
        select: {
          id: true,
          userId: true,
          user: {
            select: {
              platformRole: true,
              lastActiveFamilyId: true,
            },
          },
        },
      });

      const removableMemberships = currentMemberships.filter(
        (membership) => membership.user.platformRole === PlatformRole.USER,
      );

      await tx.auditLog.deleteMany({ where: { familyId } });

      await tx.invitation.deleteMany({ where: { familyId } });
      await tx.supplementRequestAsset.deleteMany({ where: { familyId } });
      await tx.supplementRequest.deleteMany({ where: { familyId } });
      await tx.memberAsset.deleteMany({ where: { familyId } });
      await tx.memberEvent.deleteMany({ where: { familyId } });
      await tx.marriage.deleteMany({ where: { familyId } });
      await tx.member.deleteMany({ where: { familyId } });
      await tx.assetTag.deleteMany({ where: { familyId } });
      await tx.assetSource.deleteMany({ where: { familyId } });
      await tx.kinshipAlias.deleteMany({ where: { familyId } });
      await tx.familyMembership.deleteMany({ where: { familyId } });

      const templateUserIdSet = new Set<string>();
      const userIdByUsername = new Map<string, string>();

      for (const user of hashedUsers) {
        const existingUser = await tx.user.findUnique({
          where: { username: user.username },
          select: { id: true },
        });

        const ensuredUser = existingUser
          ? await tx.user.update({
              where: { id: existingUser.id },
              data: {
                phone: user.phone,
                displayName: user.displayName,
                passwordHash: user.passwordHash,
                status: user.status,
                lastActiveFamilyId: familyId,
              },
              select: { id: true },
            })
          : await tx.user.create({
              data: {
                username: user.username,
                phone: user.phone,
                displayName: user.displayName,
                passwordHash: user.passwordHash,
                platformRole: PlatformRole.USER,
                role: user.role,
                status: user.status,
                lastActiveFamilyId: familyId,
              },
              select: { id: true },
            });

        templateUserIdSet.add(ensuredUser.id);
        userIdByUsername.set(user.username, ensuredUser.id);
      }

      const removedMembershipUserIds = removableMemberships
        .map((membership) => membership.userId)
        .filter((userId) => !templateUserIdSet.has(userId));

      if (removedMembershipUserIds.length > 0) {
        await tx.user.updateMany({
          where: {
            id: {
              in: removedMembershipUserIds,
            },
            lastActiveFamilyId: familyId,
          },
          data: {
            lastActiveFamilyId: null,
          },
        });
      }

      await tx.familyMembership.createMany({
        data: hashedUsers.map((user) => ({
          familyId,
          userId: userIdByUsername.get(user.username)!,
          role: user.role,
          status:
            user.status === UserStatus.ACTIVE
              ? MembershipStatus.ACTIVE
              : MembershipStatus.DISABLED,
        })),
      });

      if (template.settings.kinshipAliases.length > 0) {
        await tx.kinshipAlias.createMany({
          data: template.settings.kinshipAliases.map((alias) => ({
            familyId,
            relationCode: alias.relationCode,
            standardTerm: alias.standardTerm,
            familyAlias: alias.familyAlias,
            enabled: alias.enabled ?? true,
          })),
        });
      }

      if (template.settings.assetTags.length > 0) {
        await tx.assetTag.createMany({
          data: template.settings.assetTags.map((tag) => ({
            familyId,
            name: tag.name,
            enabled: tag.enabled ?? true,
            sortOrder: tag.sortOrder ?? 0,
          })),
        });
      }

      if (template.settings.assetSources.length > 0) {
        await tx.assetSource.createMany({
          data: template.settings.assetSources.map((source) => ({
            familyId,
            name: source.name,
            enabled: source.enabled ?? true,
            sortOrder: source.sortOrder ?? 0,
          })),
        });
      }

      const memberIdByCode = new Map<string, string>();
      for (const member of template.data.members) {
        const createdMember = await tx.member.create({
          data: {
            familyId,
            name: member.name,
            gender: member.gender,
            birthDate: member.birthDate ? new Date(member.birthDate) : undefined,
            deathDate: member.deathDate ? new Date(member.deathDate) : undefined,
            lifeStatus: member.deathDate ? LifeStatus.DECEASED : LifeStatus.ALIVE,
            generationName: member.generationName,
            birthOrder: member.birthOrder,
            nativePlace: member.nativePlace,
            notes: member.notes,
            fatherId: member.fatherCode ? memberIdByCode.get(member.fatherCode) : undefined,
            motherId: member.motherCode ? memberIdByCode.get(member.motherCode) : undefined,
          },
          select: { id: true },
        });
        memberIdByCode.set(member.code, createdMember.id);
      }

      if (template.data.marriages.length > 0) {
        await tx.marriage.createMany({
          data: template.data.marriages.map((marriage) => {
            const memberId = memberIdByCode.get(marriage.memberCode);
            const spouseId = memberIdByCode.get(marriage.spouseCode);
            if (!memberId || !spouseId) {
              throw new BadRequestException('演示模板中的婚姻关系引用了不存在的成员编码。');
            }

            return {
              familyId,
              pairKey: this.buildPairKey(memberId, spouseId),
              memberId,
              spouseId,
              status: marriage.status,
              startDate: marriage.startDate ? new Date(marriage.startDate) : undefined,
              endDate: marriage.endDate ? new Date(marriage.endDate) : undefined,
            };
          }),
        });
      }

      if (template.data.events.length > 0) {
        await tx.memberEvent.createMany({
          data: template.data.events.map((event) => {
            const memberId = memberIdByCode.get(event.memberCode);
            if (!memberId) {
              throw new BadRequestException('演示模板中的成员事件引用了不存在的成员编码。');
            }

            return {
              familyId,
              memberId,
              createdById: event.createdByUsername
                ? userIdByUsername.get(event.createdByUsername)
                : undefined,
              eventType: event.eventType,
              title: event.title,
              description: event.description,
              eventDate: new Date(event.eventDate),
            };
          }),
        });
      }

      if (template.data.assets.length > 0) {
        await tx.memberAsset.createMany({
          data: template.data.assets.map((asset) => {
            const memberId = memberIdByCode.get(asset.memberCode);
            if (!memberId) {
              throw new BadRequestException('演示模板中的资料引用了不存在的成员编码。');
            }

            return {
              familyId,
              memberId,
              uploadedById: asset.uploadedByUsername
                ? userIdByUsername.get(asset.uploadedByUsername)
                : undefined,
              category: asset.category,
              filePath: asset.filePath,
              originalName: asset.originalName,
              checksum: asset.checksum,
              title: asset.title,
              sourceType: asset.sourceType,
              source: asset.source,
              description: asset.description,
              tags: asset.tags ?? [],
              mimeType: asset.mimeType,
              sizeBytes: asset.sizeBytes,
            };
          }),
        });
      }

      const resetSummary = {
        cleared: preview.counts,
        recreated: {
          members: template.data.members.length,
          marriages: template.data.marriages.length,
          customEvents: template.data.events.length,
          assets: template.data.assets.length,
          systemAccounts: hashedUsers.length,
          kinshipAliases: template.settings.kinshipAliases.length,
          assetTags: template.settings.assetTags.length,
          assetSources: template.settings.assetSources.length,
        },
        removedMemberships: removableMemberships.length,
        resetUsers: hashedUsers.map((user) => user.username),
        deletedFileCount: filePaths.length,
      } satisfies DemoResetResult['summary'];

      await tx.demoResetHistory.create({
        data: {
          familyId,
          familyNameSnapshot: family.name,
          templateKey: template.key,
          operatorId: operator.sub,
          summary: resetSummary as Prisma.InputJsonValue,
        },
      });

      return resetSummary;
    });

    await this.deleteFiles(filePaths);

    return {
      success: true,
      familyId,
      familyName: family.name,
      templateKey: template.key,
      resetAt: new Date().toISOString(),
      summary,
    };
  }

  private async buildPreview(family: {
    id: string;
    name: string;
    familyType: FamilyType;
    resetTemplateKey: string | null;
  }): Promise<DemoResetPreview> {
    const [members, marriages, customEvents, assets, invitations, supplementRequests, systemAccounts] =
      await this.prisma.$transaction([
        this.prisma.member.count({
          where: { familyId: family.id, isDeleted: false },
        }),
        this.prisma.marriage.count({
          where: { familyId: family.id, isDeleted: false },
        }),
        this.prisma.memberEvent.count({
          where: { familyId: family.id, isDeleted: false },
        }),
        this.prisma.memberAsset.count({
          where: { familyId: family.id, isDeleted: false },
        }),
        this.prisma.invitation.count({
          where: { familyId: family.id },
        }),
        this.prisma.supplementRequest.count({
          where: { familyId: family.id },
        }),
        this.prisma.familyMembership.count({
          where: {
            familyId: family.id,
            user: {
              platformRole: PlatformRole.USER,
            },
          },
        }),
      ]);

    return {
      familyId: family.id,
      familyName: family.name,
      familyType: family.familyType,
      templateKey: family.resetTemplateKey!,
      confirmationText: family.name,
      counts: {
        members,
        marriages,
        customEvents,
        assets,
        invitations,
        supplementRequests,
        systemAccounts,
      },
      warnings: [
        '该操作只会重置当前演示家族，不会影响其他家族。',
        '重置会清空当前家族的成员、资料、补充申请、邀请与家族账号关系，并恢复为模板初始状态。',
        `请在确认框中输入“${family.name}”后再执行。`,
      ],
    };
  }

  private async getResettableFamily(familyId: string) {
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      select: {
        id: true,
        name: true,
        familyType: true,
        resetTemplateKey: true,
      },
    });

    if (!family) {
      throw new NotFoundException('未找到指定家族。');
    }

    if (family.familyType !== FamilyType.DEMO || !family.resetTemplateKey) {
      throw new ForbiddenException('仅已绑定模板的演示家族支持一键重置。');
    }

    return family;
  }

  private async collectFamilyFilePaths(familyId: string) {
    const [members, assets, requestAssets, requests] = await this.prisma.$transaction([
      this.prisma.member.findMany({
        where: { familyId },
        select: { photoPath: true },
      }),
      this.prisma.memberAsset.findMany({
        where: { familyId },
        select: { filePath: true },
      }),
      this.prisma.supplementRequestAsset.findMany({
        where: { familyId },
        select: { filePath: true },
      }),
      this.prisma.supplementRequest.findMany({
        where: { familyId },
        select: {
          payload: true,
          afterSnapshot: true,
        },
      }),
    ]);

    const filePathSet = new Set<string>();
    for (const member of members) {
      if (member.photoPath) {
        filePathSet.add(member.photoPath);
      }
    }
    for (const asset of assets) {
      filePathSet.add(asset.filePath);
    }
    for (const asset of requestAssets) {
      filePathSet.add(asset.filePath);
    }
    for (const request of requests) {
      this.collectFilePathsFromJson(request.payload, filePathSet);
      this.collectFilePathsFromJson(request.afterSnapshot, filePathSet);
    }

    return [...filePathSet];
  }

  private collectFilePathsFromJson(value: Prisma.JsonValue | null, output: Set<string>) {
    if (typeof value === 'string') {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        this.collectFilePathsFromJson(item, output);
      }
      return;
    }

    if (!value || typeof value !== 'object') {
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      if ((key === 'filePath' || key === 'photoPath') && typeof child === 'string' && child.trim()) {
        output.add(child);
      }

      this.collectFilePathsFromJson(child as Prisma.JsonValue, output);
    }
  }

  private async deleteFiles(filePaths: string[]) {
    const uploadRoot = resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');
    await Promise.all(
      filePaths.map((filePath) =>
        unlink(resolve(uploadRoot, filePath.replace(/^[/\\]+/, ''))).catch(() => undefined),
      ),
    );
  }

  private buildPairKey(firstId: string, secondId: string) {
    return [firstId, secondId].sort().join(':');
  }
}
