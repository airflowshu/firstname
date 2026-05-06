import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import {
  AuditAction,
  Gender,
  LifeStatus,
  MarriageStatus,
  MemberAssetCategory,
  MemberEventType,
  Prisma,
  UserRole,
  type Member,
} from '@prisma/client';
import ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  buildFileChecksum,
  buildPairKey,
  buildPhotoUrl,
  buildUploadUrl,
} from '../common/utils/family-tree.util';
import { validateMemberAssetFile } from '../common/utils/asset-file.util';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { getTenantContext } from '../common/tenant/tenant-context';
import { DASHBOARD_SUMMARY_CACHE_KEY } from '../dashboard/dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { BatchAssetOperationDto } from './dto/asset-batch.dto';
import {
  AssetImportBatchQueryDto,
  AssetImportPrecheckDto,
  ImportAssetBatchDto,
} from './dto/asset-import.dto';
import { AssetSourceQueryDto, UpsertAssetSourceDto } from './dto/asset-source.dto';
import { AssetTagQueryDto, UpsertAssetTagDto } from './dto/asset-tag.dto';
import {
  CreateMarriageDto,
  CreateMemberDto,
  MemberAssetMetadataDto,
  MemberAssetLibraryQueryDto,
  MemberAssetQueryDto,
  CreateMemberEventDto,
  CreateQuickRelativeDto,
  MemberDuplicateCheckDto,
  MemberQueryDto,
  UpdateMemberAssetDto,
  UploadMemberAssetsDto,
  UpdateMarriageDto,
  UpdateMemberDto,
} from './dto/member.dto';

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async list(query: MemberQueryDto) {
    const where: Prisma.MemberWhereInput = {
      isDeleted: query.includeDeleted ? undefined : false,
      gender: query.gender,
      lifeStatus: query.lifeStatus,
      OR: query.keyword
        ? [
            { name: { contains: query.keyword, mode: 'insensitive' } },
            { generationName: { contains: query.keyword, mode: 'insensitive' } },
            { nativePlace: { contains: query.keyword, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.member.count({ where }),
      this.prisma.member.findMany({
        where,
        include: {
          father: {
            select: { id: true, name: true },
          },
          mother: {
            select: { id: true, name: true },
          },
        },
        orderBy: [{ generationName: 'asc' }, { birthOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      data: data.map((member) => ({
        ...member,
        photoUrl: buildPhotoUrl(member.photoPath),
      })),
    };
  }

  async options(keyword?: string) {
    const members = await this.prisma.member.findMany({
      where: {
        isDeleted: false,
        name: keyword
          ? {
              contains: keyword,
              mode: 'insensitive',
            }
          : undefined,
      },
      orderBy: [{ name: 'asc' }, { birthDate: 'asc' }],
      take: 20,
      select: {
        id: true,
        name: true,
        gender: true,
        birthDate: true,
        generationName: true,
        nativePlace: true,
      },
    });

    return members.map((member) => ({
      id: member.id,
      name: member.name,
      gender: member.gender,
      subtitle: [member.generationName, member.nativePlace, member.birthDate?.getFullYear()]
        .filter(Boolean)
        .join(' · '),
    }));
  }

  async checkDuplicates(dto: MemberDuplicateCheckDto) {
    const normalizedName = dto.name?.trim();

    if (!normalizedName || normalizedName.length < 2) {
      return {
        hasMatches: false,
        matches: [],
      };
    }

    const candidates = await this.prisma.member.findMany({
      where: {
        isDeleted: false,
        id: dto.excludeId ? { not: dto.excludeId } : undefined,
        OR: [
          { name: { equals: normalizedName, mode: 'insensitive' } },
          { name: { startsWith: normalizedName, mode: 'insensitive' } },
        ],
      },
      include: {
        father: {
          select: { id: true, name: true },
        },
        mother: {
          select: { id: true, name: true },
        },
      },
      take: 8,
      orderBy: [{ name: 'asc' }, { birthDate: 'asc' }],
    });

    const targetBirthDate = dto.birthDate
      ? new Date(dto.birthDate).toISOString().slice(0, 10)
      : null;
    const targetGenerationName = dto.generationName?.trim();
    const targetNativePlace = dto.nativePlace?.trim();

    const matches = candidates
      .map((member) => {
        const matchedFields: string[] = [];
        let score = 0;
        const memberBirthDate = member.birthDate?.toISOString().slice(0, 10) ?? null;

        if (member.name.toLowerCase() === normalizedName.toLowerCase()) {
          matchedFields.push('同名');
          score += 40;
        } else if (member.name.toLowerCase().startsWith(normalizedName.toLowerCase())) {
          matchedFields.push('姓名前缀相同');
          score += 12;
        }

        if (dto.gender && member.gender === dto.gender) {
          matchedFields.push('性别相同');
          score += 12;
        }

        if (targetBirthDate && memberBirthDate === targetBirthDate) {
          matchedFields.push('出生日期相同');
          score += 24;
        }

        if (dto.fatherId && member.fatherId === dto.fatherId) {
          matchedFields.push('父亲相同');
          score += 18;
        }

        if (dto.motherId && member.motherId === dto.motherId) {
          matchedFields.push('母亲相同');
          score += 18;
        }

        if (targetGenerationName && member.generationName === targetGenerationName) {
          matchedFields.push('字辈相同');
          score += 8;
        }

        if (targetNativePlace && member.nativePlace === targetNativePlace) {
          matchedFields.push('籍贯相同');
          score += 8;
        }

        return {
          id: member.id,
          name: member.name,
          gender: member.gender,
          birthDate: member.birthDate,
          generationName: member.generationName,
          nativePlace: member.nativePlace,
          father: member.father,
          mother: member.mother,
          score,
          matchedFields,
        };
      })
      .filter((member) => member.matchedFields.length > 0 && member.score >= 30)
      .sort((left, right) => right.score - left.score);

    return {
      hasMatches: matches.length > 0,
      matches,
    };
  }

  async getById(id: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: {
        father: {
          select: { id: true, name: true, gender: true },
        },
        mother: {
          select: { id: true, name: true, gender: true },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('未找到对应成员。');
    }

    const [children, marriages, siblings] = await this.prisma.$transaction([
      this.prisma.member.findMany({
        where: {
          isDeleted: false,
          OR: [{ fatherId: id }, { motherId: id }],
        },
        orderBy: [{ birthOrder: 'asc' }, { birthDate: 'asc' }],
        select: {
          id: true,
          name: true,
          gender: true,
          birthDate: true,
          generationName: true,
        },
      }),
      this.prisma.marriage.findMany({
        where: {
          isDeleted: false,
          OR: [{ memberId: id }, { spouseId: id }],
        },
        include: {
          member: {
            select: { id: true, name: true, gender: true },
          },
          spouse: {
            select: { id: true, name: true, gender: true },
          },
        },
        orderBy: { startDate: 'asc' },
      }),
      this.prisma.member.findMany({
        where: {
          isDeleted: false,
          id: { not: id },
          OR: [
            member.fatherId ? { fatherId: member.fatherId } : undefined,
            member.motherId ? { motherId: member.motherId } : undefined,
          ].filter(Boolean) as Prisma.MemberWhereInput[],
        },
        select: {
          id: true,
          name: true,
          gender: true,
          birthDate: true,
          birthOrder: true,
        },
        orderBy: [{ birthOrder: 'asc' }, { birthDate: 'asc' }],
      }),
    ]);
    const timeline = await this.getTimeline(id);

    return {
      ...member,
      photoUrl: buildPhotoUrl(member.photoPath),
      children,
      siblings,
      timeline,
      marriages: marriages.map((marriage) => ({
        id: marriage.id,
        status: marriage.status,
        startDate: marriage.startDate,
        endDate: marriage.endDate,
        spouse: marriage.memberId === id ? marriage.spouse : marriage.member,
      })),
    };
  }

  async listAssets(memberId: string, query: MemberAssetQueryDto = {}) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, isDeleted: false },
      select: { id: true },
    });

    if (!member) {
      throw new NotFoundException('未找到对应成员。');
    }

    const normalizedKeyword = query.keyword?.trim();
    const normalizedTag = query.tag?.trim();
    const normalizedSourceType = query.sourceType?.trim();

    const assets = await this.prisma.memberAsset.findMany({
      where: {
        memberId,
        isDeleted: false,
        category: query.category,
        sourceType: normalizedSourceType || undefined,
        tags: normalizedTag
          ? {
              has: normalizedTag,
            }
          : undefined,
        OR: normalizedKeyword
          ? [
              {
                originalName: {
                  contains: normalizedKeyword,
                  mode: 'insensitive',
                },
              },
              {
                title: {
                  contains: normalizedKeyword,
                  mode: 'insensitive',
                },
              },
              {
                sourceType: {
                  contains: normalizedKeyword,
                  mode: 'insensitive',
                },
              },
              {
                source: {
                  contains: normalizedKeyword,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: normalizedKeyword,
                  mode: 'insensitive',
                },
              },
            ]
          : undefined,
      },
      include: {
        uploadedBy: {
          select: { id: true, username: true, role: true },
        },
      },
      orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
    });

    return assets.map((asset) => ({
      ...asset,
      fileUrl: buildUploadUrl(asset.filePath),
    }));
  }

  async listAssetTags(query: AssetTagQueryDto = {}, user?: AuthenticatedUser) {
    const includeDisabled = query.includeDisabled === true && user?.role === UserRole.ADMIN;

    const [tags, assetRows, requestAssetRows] = await this.prisma.$transaction([
      this.prisma.assetTag.findMany({
        where: {
          enabled: includeDisabled ? undefined : true,
        },
        orderBy: [{ enabled: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.memberAsset.findMany({
        where: {
          isDeleted: false,
        },
        select: {
          tags: true,
        },
      }),
      this.prisma.supplementRequestAsset.findMany({
        select: {
          tags: true,
        },
      }),
    ]);

    const usageCounter = new Map<string, number>();
    for (const row of [...assetRows, ...requestAssetRows]) {
      for (const tag of row.tags) {
        usageCounter.set(tag, (usageCounter.get(tag) ?? 0) + 1);
      }
    }

    return tags.map((tag) => ({
      ...tag,
      useCount: usageCounter.get(tag.name) ?? 0,
    }));
  }

  async listAssetSources(query: AssetSourceQueryDto = {}, user?: AuthenticatedUser) {
    const includeDisabled = query.includeDisabled === true && user?.role === UserRole.ADMIN;

    const [sources, assets, requestAssets] = await this.prisma.$transaction([
      this.prisma.assetSource.findMany({
        where: {
          enabled: includeDisabled ? undefined : true,
        },
        orderBy: [{ enabled: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.memberAsset.findMany({
        where: {
          isDeleted: false,
          sourceType: {
            not: null,
          },
        },
        select: {
          sourceType: true,
        },
      }),
      this.prisma.supplementRequestAsset.findMany({
        where: {
          sourceType: {
            not: null,
          },
        },
        select: {
          sourceType: true,
        },
      }),
    ]);

    const usageCounter = new Map<string, number>();
    for (const row of [...assets, ...requestAssets]) {
      if (!row.sourceType) {
        continue;
      }

      usageCounter.set(row.sourceType, (usageCounter.get(row.sourceType) ?? 0) + 1);
    }

    return sources.map((source) => ({
      ...source,
      useCount: usageCounter.get(source.name) ?? 0,
    }));
  }

  async createAssetTag(dto: UpsertAssetTagDto, operatorId: string) {
    const normalizedName = dto.name.trim();
    if (!normalizedName) {
      throw new BadRequestException('标签名称不能为空。');
    }

    const existing = await this.prisma.assetTag.findFirst({
      where: {
        name: {
          equals: normalizedName,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      throw new ConflictException('该推荐标签已存在，请直接编辑现有标签。');
    }

    const created = await this.prisma.assetTag.create({
      data: {
        name: normalizedName,
        enabled: dto.enabled ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.CREATE,
      targetType: 'ASSET_TAG',
      targetId: created.id,
      after: created,
    });

    return {
      ...created,
      useCount: 0,
    };
  }

  async updateAssetTag(id: string, dto: UpsertAssetTagDto, operatorId: string) {
    const familyId = this.currentFamilyId();
    const existing = await this.prisma.assetTag.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('未找到对应推荐标签。');
    }

    const normalizedName = dto.name.trim();
    if (!normalizedName) {
      throw new BadRequestException('标签名称不能为空。');
    }

    const duplicate = await this.prisma.assetTag.findFirst({
      where: {
        id: {
          not: id,
        },
        name: {
          equals: normalizedName,
          mode: 'insensitive',
        },
      },
    });

    if (duplicate) {
      throw new ConflictException('该推荐标签名称已存在，请使用其他名称。');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.assetTag.update({
        where: { id },
        data: {
          name: normalizedName,
          enabled: dto.enabled ?? existing.enabled,
          sortOrder: dto.sortOrder ?? existing.sortOrder,
        },
      });

      if (existing.name !== normalizedName) {
        const memberAssets = await tx.memberAsset.findMany({
          where: {
            familyId,
            isDeleted: false,
            tags: {
              has: existing.name,
            },
          },
          select: {
            id: true,
            tags: true,
          },
        });

        for (const asset of memberAssets) {
          const nextTags = Array.from(
            new Set(asset.tags.map((tag) => (tag === existing.name ? normalizedName : tag))),
          );

          await tx.memberAsset.update({
            where: { id: asset.id },
            data: {
              tags: {
                set: nextTags,
              },
            },
          });
        }

        const requestAssets = await tx.supplementRequestAsset.findMany({
          where: {
            familyId,
            tags: {
              has: existing.name,
            },
          },
          select: {
            id: true,
            tags: true,
          },
        });

        for (const asset of requestAssets) {
          const nextTags = Array.from(
            new Set(asset.tags.map((tag) => (tag === existing.name ? normalizedName : tag))),
          );

          await tx.supplementRequestAsset.update({
            where: { id: asset.id },
            data: {
              tags: {
                set: nextTags,
              },
            },
          });
        }
      }

      return next;
    });

    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.UPDATE,
      targetType: 'ASSET_TAG',
      targetId: id,
      before: existing,
      after: updated,
    });

    const [assetUseCount, requestUseCount] = await this.prisma.$transaction([
      this.prisma.memberAsset.count({
        where: {
          isDeleted: false,
          tags: {
            has: updated.name,
          },
        },
      }),
      this.prisma.supplementRequestAsset.count({
        where: {
          tags: {
            has: updated.name,
          },
        },
      }),
    ]);

    return {
      ...updated,
      useCount: assetUseCount + requestUseCount,
    };
  }

  async removeAssetTag(id: string, operatorId: string) {
    const existing = await this.prisma.assetTag.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('未找到对应推荐标签。');
    }

    const [assetUseCount, requestUseCount] = await this.prisma.$transaction([
      this.prisma.memberAsset.count({
        where: {
          isDeleted: false,
          tags: {
            has: existing.name,
          },
        },
      }),
      this.prisma.supplementRequestAsset.count({
        where: {
          tags: {
            has: existing.name,
          },
        },
      }),
    ]);

    const useCount = assetUseCount + requestUseCount;

    if (useCount > 0) {
      throw new ConflictException('该标签仍在资料中使用，请先停用或替换后再删除。');
    }

    await this.prisma.assetTag.delete({
      where: { id },
    });

    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.DELETE,
      targetType: 'ASSET_TAG',
      targetId: id,
      before: existing,
    });

    return { success: true };
  }

  async createAssetSource(dto: UpsertAssetSourceDto, operatorId: string) {
    const normalizedName = dto.name.trim();
    if (!normalizedName) {
      throw new BadRequestException('来源类型名称不能为空。');
    }

    const existing = await this.prisma.assetSource.findFirst({
      where: {
        name: {
          equals: normalizedName,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      throw new ConflictException('该来源类型已存在，请直接编辑现有来源。');
    }

    const created = await this.prisma.assetSource.create({
      data: {
        name: normalizedName,
        enabled: dto.enabled ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.CREATE,
      targetType: 'ASSET_SOURCE',
      targetId: created.id,
      after: created,
    });

    return {
      ...created,
      useCount: 0,
    };
  }

  async updateAssetSource(id: string, dto: UpsertAssetSourceDto, operatorId: string) {
    const familyId = this.currentFamilyId();
    const existing = await this.prisma.assetSource.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('未找到对应来源类型。');
    }

    const normalizedName = dto.name.trim();
    if (!normalizedName) {
      throw new BadRequestException('来源类型名称不能为空。');
    }

    const duplicate = await this.prisma.assetSource.findFirst({
      where: {
        id: {
          not: id,
        },
        name: {
          equals: normalizedName,
          mode: 'insensitive',
        },
      },
    });

    if (duplicate) {
      throw new ConflictException('该来源类型名称已存在，请使用其他名称。');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.assetSource.update({
        where: { id },
        data: {
          name: normalizedName,
          enabled: dto.enabled ?? existing.enabled,
          sortOrder: dto.sortOrder ?? existing.sortOrder,
        },
      });

      if (existing.name !== normalizedName) {
        const memberAssets = await tx.memberAsset.findMany({
          where: {
            familyId,
            isDeleted: false,
            sourceType: existing.name,
          },
          select: {
            id: true,
          },
        });

        for (const asset of memberAssets) {
          await tx.memberAsset.update({
            where: { id: asset.id },
            data: {
              sourceType: normalizedName,
            },
          });
        }

        const requestAssets = await tx.supplementRequestAsset.findMany({
          where: {
            familyId,
            sourceType: existing.name,
          },
          select: {
            id: true,
          },
        });

        for (const asset of requestAssets) {
          await tx.supplementRequestAsset.update({
            where: { id: asset.id },
            data: {
              sourceType: normalizedName,
            },
          });
        }
      }

      return next;
    });

    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.UPDATE,
      targetType: 'ASSET_SOURCE',
      targetId: id,
      before: existing,
      after: updated,
    });

    const [assetUseCount, requestUseCount] = await this.prisma.$transaction([
      this.prisma.memberAsset.count({
        where: {
          isDeleted: false,
          sourceType: updated.name,
        },
      }),
      this.prisma.supplementRequestAsset.count({
        where: {
          sourceType: updated.name,
        },
      }),
    ]);

    return {
      ...updated,
      useCount: assetUseCount + requestUseCount,
    };
  }

  async removeAssetSource(id: string, operatorId: string) {
    const existing = await this.prisma.assetSource.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('未找到对应来源类型。');
    }

    const [assetUseCount, requestUseCount] = await this.prisma.$transaction([
      this.prisma.memberAsset.count({
        where: {
          isDeleted: false,
          sourceType: existing.name,
        },
      }),
      this.prisma.supplementRequestAsset.count({
        where: {
          sourceType: existing.name,
        },
      }),
    ]);

    const useCount = assetUseCount + requestUseCount;

    if (useCount > 0) {
      throw new ConflictException('该来源类型仍在资料中使用，请先停用或替换后再删除。');
    }

    await this.prisma.assetSource.delete({
      where: { id },
    });

    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.DELETE,
      targetType: 'ASSET_SOURCE',
      targetId: id,
      before: existing,
    });

    return { success: true };
  }

  async batchOperateAssets(dto: BatchAssetOperationDto, operatorId: string) {
    if (!dto.assetIds || dto.assetIds.length === 0) {
      throw new BadRequestException('请至少选择一项资料后再执行批量操作。');
    }

    const assets = await this.prisma.memberAsset.findMany({
      where: {
        id: {
          in: dto.assetIds,
        },
        isDeleted: false,
      },
      select: {
        id: true,
        memberId: true,
        filePath: true,
        tags: true,
        sourceType: true,
      },
    });

    if (assets.length === 0) {
      throw new NotFoundException('未找到可处理的资料记录。');
    }

    const foundIds = new Set(assets.map((asset) => asset.id));
    const missingIds = dto.assetIds.filter((id) => !foundIds.has(id));

    if (dto.action === 'APPEND_TAGS') {
      const normalizedTags = this.normalizeAssetTags(dto.tags) ?? [];
      if (normalizedTags.length === 0) {
        throw new BadRequestException('批量打标签时至少需要提供一个标签。');
      }

      await this.prisma.$transaction(
        assets.map((asset) =>
          this.prisma.memberAsset.update({
            where: { id: asset.id },
            data: {
              tags: {
                set: Array.from(new Set([...asset.tags, ...normalizedTags])),
              },
            },
          }),
        ),
      );

      await this.auditLogsService.log({
        operatorId,
        action: AuditAction.UPDATE,
        targetType: 'MEMBER_ASSET_BATCH',
        metadata: {
          action: dto.action,
          assetIds: assets.map((asset) => asset.id),
          missingIds,
          tags: normalizedTags,
          count: assets.length,
        },
      });

      return {
        success: true,
        action: dto.action,
        affectedCount: assets.length,
      };
    }

    if (dto.action === 'SET_SOURCE_TYPE') {
      const normalizedSourceType = this.normalizeNullableText(dto.sourceType);
      if (!normalizedSourceType) {
        throw new BadRequestException('批量设置来源类型时必须选择来源类型。');
      }

      const source = await this.prisma.assetSource.findFirst({
        where: {
          enabled: true,
          name: {
            equals: normalizedSourceType,
            mode: 'insensitive',
          },
        },
      });

      if (!source) {
        throw new BadRequestException('指定的来源类型不存在或已停用。');
      }

      await this.prisma.memberAsset.updateMany({
        where: {
          id: {
            in: assets.map((asset) => asset.id),
          },
        },
        data: {
          sourceType: source.name,
        },
      });

      await this.auditLogsService.log({
        operatorId,
        action: AuditAction.UPDATE,
        targetType: 'MEMBER_ASSET_BATCH',
        metadata: {
          action: dto.action,
          assetIds: assets.map((asset) => asset.id),
          missingIds,
          sourceType: source.name,
          count: assets.length,
        },
      });

      return {
        success: true,
        action: dto.action,
        affectedCount: assets.length,
      };
    }

    if (dto.action === 'DELETE') {
      const uploadRoot = resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');
      for (const asset of assets) {
        await unlink(resolve(uploadRoot, asset.filePath)).catch(() => undefined);
      }

      await this.prisma.memberAsset.updateMany({
        where: {
          id: {
            in: assets.map((asset) => asset.id),
          },
        },
        data: {
          isDeleted: true,
        },
      });

      await this.auditLogsService.log({
        operatorId,
        action: AuditAction.DELETE,
        targetType: 'MEMBER_ASSET_BATCH',
        metadata: {
          action: dto.action,
          assetIds: assets.map((asset) => asset.id),
          missingIds,
          count: assets.length,
        },
      });

      return {
        success: true,
        action: dto.action,
        affectedCount: assets.length,
      };
    }

    throw new BadRequestException('暂不支持该批量操作。');
  }

  async precheckAssetImport(dto: AssetImportPrecheckDto, files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('请至少选择一个文件后再执行导入预检查。');
    }

    const member = await this.prisma.member.findFirst({
      where: {
        id: dto.memberId,
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!member) {
      throw new NotFoundException('未找到导入目标成员。');
    }

    const normalizedAssetMetadata = this.normalizeAssetMetadata(dto);
    const normalizedSourceType = normalizedAssetMetadata.sourceType ?? null;

    if (normalizedSourceType) {
      const sourceTypeRecord = await this.prisma.assetSource.findFirst({
        where: {
          enabled: true,
          name: {
            equals: normalizedSourceType,
            mode: 'insensitive',
          },
        },
      });

      if (!sourceTypeRecord) {
        throw new BadRequestException('指定的来源类型不存在或已停用。');
      }
    }

    const precheckItems = files.map((file, index) => {
      const issues: Array<{
        code: string;
        severity: 'warning' | 'error';
        message: string;
      }> = [];

      try {
        this.validateAssetFile(file, dto.category);
      } catch (error) {
        issues.push({
          code: 'INVALID_FILE_TYPE',
          severity: 'error',
          message:
            error instanceof Error && error.message ? error.message : '文件类型不支持，无法导入。',
        });
      }

      return {
        inputIndex: index,
        originalName: file.originalname,
        sizeBytes: file.size,
        mimeType: file.mimetype,
        checksum: buildFileChecksum(file.buffer),
        resolvedTitle:
          dto.titles?.[index]?.trim() || this.deriveDefaultAssetTitle(file.originalname),
        issues,
      };
    });

    const checksums = [...new Set(precheckItems.map((item) => item.checksum))];
    const originalNames = [...new Set(precheckItems.map((item) => item.originalName))];
    const titles = [...new Set(precheckItems.map((item) => item.resolvedTitle).filter(Boolean))];
    const sizeBytesList = [...new Set(precheckItems.map((item) => item.sizeBytes))];

    const candidateAssets = await this.prisma.memberAsset.findMany({
      where: {
        isDeleted: false,
        category: dto.category,
        OR: [
          { checksum: { in: checksums } },
          { originalName: { in: originalNames } },
          { title: { in: titles } },
          { sizeBytes: { in: sizeBytesList } },
        ],
      },
      select: {
        id: true,
        memberId: true,
        originalName: true,
        title: true,
        sizeBytes: true,
        mimeType: true,
        checksum: true,
        member: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const batchChecksumCount = new Map<string, number>();
    const batchTitleCount = new Map<string, number>();
    for (const item of precheckItems) {
      batchChecksumCount.set(item.checksum, (batchChecksumCount.get(item.checksum) ?? 0) + 1);
      batchTitleCount.set(item.resolvedTitle, (batchTitleCount.get(item.resolvedTitle) ?? 0) + 1);
    }

    const items = precheckItems.map((item) => {
      const issues: Array<{
        code: string;
        severity: 'warning' | 'error';
        message: string;
        relatedMemberName?: string;
        relatedAssetId?: string;
      }> = [...item.issues];

      if ((batchChecksumCount.get(item.checksum) ?? 0) > 1) {
        issues.push({
          code: 'DUPLICATE_IN_BATCH',
          severity: 'warning',
          message: '本批次中存在内容完全相同的重复文件。',
        });
      }

      if ((batchTitleCount.get(item.resolvedTitle) ?? 0) > 1) {
        issues.push({
          code: 'TITLE_COLLISION_IN_BATCH',
          severity: 'warning',
          message: `本批次中存在重复标题：${item.resolvedTitle}`,
        });
      }

      for (const asset of candidateAssets) {
        const checksumMatched = Boolean(asset.checksum && asset.checksum === item.checksum);
        const nameSizeMatched =
          asset.originalName === item.originalName &&
          asset.sizeBytes === item.sizeBytes &&
          asset.mimeType === item.mimeType;
        const titleMatched = Boolean(item.resolvedTitle && asset.title === item.resolvedTitle);

        if (!checksumMatched && !nameSizeMatched && !titleMatched) {
          continue;
        }

        if (asset.memberId === dto.memberId) {
          if (checksumMatched || nameSizeMatched) {
            issues.push({
              code: 'DUPLICATE_EXISTING_SAME_MEMBER',
              severity: 'warning',
              message: `当前成员名下已存在疑似重复资料：${asset.title || asset.originalName}`,
              relatedMemberName: asset.member.name,
              relatedAssetId: asset.id,
            });
          } else if (titleMatched) {
            issues.push({
              code: 'TITLE_COLLISION_EXISTING_SAME_MEMBER',
              severity: 'warning',
              message: `当前成员名下已存在同名资料标题：${item.resolvedTitle}`,
              relatedMemberName: asset.member.name,
              relatedAssetId: asset.id,
            });
          }
        } else if (checksumMatched || nameSizeMatched) {
          issues.push({
            code: 'DUPLICATE_EXISTING_OTHER_MEMBER',
            severity: 'warning',
            message: `其他成员名下存在疑似相同资料：${asset.member.name} / ${
              asset.title || asset.originalName
            }`,
            relatedMemberName: asset.member.name,
            relatedAssetId: asset.id,
          });
        }
      }

      return {
        ...item,
        issues,
        status: issues.some((issue) => issue.severity === 'error')
          ? 'error'
          : issues.length > 0
            ? 'warning'
            : 'safe',
      };
    });

    return {
      memberId: member.id,
      memberName: member.name,
      category: dto.category,
      totalCount: items.length,
      errorCount: items.filter((item) => item.status === 'error').length,
      warningCount: items.filter((item) => item.issues.length > 0).length,
      duplicateInBatchCount: items.filter((item) =>
        item.issues.some((issue) => issue.code === 'DUPLICATE_IN_BATCH'),
      ).length,
      duplicateExistingCount: items.filter((item) =>
        item.issues.some((issue) =>
          ['DUPLICATE_EXISTING_SAME_MEMBER', 'DUPLICATE_EXISTING_OTHER_MEMBER'].includes(
            issue.code,
          ),
        ),
      ).length,
      titleCollisionCount: items.filter((item) =>
        item.issues.some((issue) =>
          ['TITLE_COLLISION_IN_BATCH', 'TITLE_COLLISION_EXISTING_SAME_MEMBER'].includes(issue.code),
        ),
      ).length,
      items,
    };
  }

  async importAssetsBatch(
    dto: ImportAssetBatchDto,
    files: Express.Multer.File[],
    operatorId: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('请至少选择一个文件后再执行批量导入。');
    }

    const member = await this.prisma.member.findFirst({
      where: {
        id: dto.memberId,
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!member) {
      throw new NotFoundException('未找到导入目标成员。');
    }

    const normalizedAssetMetadata = this.normalizeAssetMetadata(dto);
    const normalizedSourceType = normalizedAssetMetadata.sourceType ?? null;
    const sourceTypeRecord = normalizedSourceType
      ? await this.prisma.assetSource.findFirst({
          where: {
            enabled: true,
            name: {
              equals: normalizedSourceType,
              mode: 'insensitive',
            },
          },
        })
      : null;

    if (normalizedSourceType && !sourceTypeRecord) {
      throw new BadRequestException('指定的来源类型不存在或已停用。');
    }

    const uploadRoot = resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');
    const directoryName =
      dto.category === MemberAssetCategory.PHOTO
        ? 'member-assets/photos'
        : 'member-assets/documents';
    const saveDirectory = resolve(uploadRoot, directoryName);
    await mkdir(saveDirectory, { recursive: true });

    const createdAssets: Array<{
      id: string;
      memberId: string;
      uploadedById: string | null;
      category: MemberAssetCategory;
      filePath: string;
      fileUrl: string | null;
      originalName: string;
      title: string | null;
      sourceType: string | null;
      source: string | null;
      description: string | null;
      tags: string[];
      checksum: string | null;
      mimeType: string;
      sizeBytes: number;
      isDeleted: boolean;
      createdAt: Date;
      updatedAt: Date;
    }> = [];
    const failures: Array<{ inputIndex: number; originalName: string; message: string }> = [];

    for (const [index, file] of files.entries()) {
      let relativePath: string | null = null;
      try {
        this.validateAssetFile(file, dto.category);

        const extension = extname(file.originalname || '') || '';
        relativePath = `${directoryName}/${randomUUID()}${extension}`;
        const absolutePath = resolve(uploadRoot, relativePath);
        await writeFile(absolutePath, file.buffer);

        const title = dto.titles?.[index]?.trim() || normalizedAssetMetadata.title;
        const checksum = buildFileChecksum(file.buffer);
        const created = await this.prisma.memberAsset.create({
          data: {
            memberId: dto.memberId,
            uploadedById: operatorId,
            category: dto.category,
            filePath: relativePath,
            originalName: file.originalname,
            checksum,
            title: title || null,
            sourceType: sourceTypeRecord?.name ?? null,
            source: normalizedAssetMetadata.source,
            description: normalizedAssetMetadata.description,
            tags: normalizedAssetMetadata.tags,
            mimeType: file.mimetype,
            sizeBytes: file.size,
          },
        });

        createdAssets.push({
          ...created,
          fileUrl: buildUploadUrl(created.filePath),
        });
      } catch (error) {
        if (relativePath) {
          await unlink(resolve(uploadRoot, relativePath)).catch(() => undefined);
        }

        failures.push({
          inputIndex: index,
          originalName: file.originalname,
          message:
            error instanceof Error && error.message ? error.message : '文件导入失败，请稍后重试。',
        });
      }
    }

    const auditLog = await this.auditLogsService.log({
      operatorId,
      action: AuditAction.UPLOAD_PHOTO,
      targetType: 'MEMBER_ASSET_IMPORT_BATCH',
      targetId: member.id,
      metadata: {
        memberId: member.id,
        memberName: member.name,
        category: dto.category,
        totalCount: files.length,
        successCount: createdAssets.length,
        failedCount: failures.length,
        sourceType: sourceTypeRecord?.name ?? null,
        source: normalizedAssetMetadata.source,
        tags: normalizedAssetMetadata.tags,
        titles: dto.titles ?? [],
        failures,
        createdAssetIds: createdAssets.map((asset) => asset.id),
      },
    });

    return {
      auditLogId: auditLog?.id ?? '',
      memberId: member.id,
      memberName: member.name,
      category: dto.category,
      totalCount: files.length,
      successCount: createdAssets.length,
      failedCount: failures.length,
      createdAt: auditLog?.createdAt ?? new Date(),
      createdAssets,
      failures,
    };
  }

  async listAssetImportBatches(query: AssetImportBatchQueryDto = {}) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 8;
    const where: Prisma.AuditLogWhereInput = {
      targetType: 'MEMBER_ASSET_IMPORT_BATCH',
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          operator: {
            select: {
              id: true,
              username: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      data,
    };
  }

  async listLibraryAssets(query: MemberAssetLibraryQueryDto = {}) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 24;
    let importBatchAssetIds: string[] | undefined;

    if (query.importBatchId) {
      const batchLog = await this.prisma.auditLog.findFirst({
        where: {
          id: query.importBatchId,
          targetType: 'MEMBER_ASSET_IMPORT_BATCH',
        },
        select: {
          metadata: true,
        },
      });

      const createdAssetIds = Array.isArray(
        (batchLog?.metadata as { createdAssetIds?: unknown } | null)?.createdAssetIds,
      )
        ? ((batchLog?.metadata as { createdAssetIds?: unknown[] }).createdAssetIds ?? [])
            .map((item) => String(item))
            .filter(Boolean)
        : [];

      importBatchAssetIds = createdAssetIds;
    }

    const where = this.buildAssetWhereInput(query, importBatchAssetIds);
    const overviewWhere: Prisma.MemberAssetWhereInput = {
      isDeleted: false,
    };
    const tagWhere: Prisma.MemberAssetWhereInput = {
      isDeleted: false,
      category: query.category,
    };

    const [
      total,
      data,
      totalAssets,
      totalPhotos,
      totalDocuments,
      taggedAssets,
      sourcedAssets,
      describedAssets,
      linkedMembersResult,
      tagAssetRows,
    ] = await this.prisma.$transaction([
      this.prisma.memberAsset.count({ where }),
      this.prisma.memberAsset.findMany({
        where,
        include: {
          member: {
            select: {
              id: true,
              name: true,
              gender: true,
              generationName: true,
              nativePlace: true,
            },
          },
          uploadedBy: {
            select: { id: true, username: true, role: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.memberAsset.count({ where: overviewWhere }),
      this.prisma.memberAsset.count({
        where: {
          ...overviewWhere,
          category: MemberAssetCategory.PHOTO,
        },
      }),
      this.prisma.memberAsset.count({
        where: {
          ...overviewWhere,
          category: MemberAssetCategory.DOCUMENT,
        },
      }),
      this.prisma.memberAsset.count({
        where: {
          ...overviewWhere,
          NOT: {
            tags: {
              isEmpty: true,
            },
          },
        },
      }),
      this.prisma.memberAsset.count({
        where: {
          ...overviewWhere,
          OR: [
            {
              sourceType: {
                not: null,
              },
            },
            {
              source: {
                not: null,
              },
            },
          ],
        },
      }),
      this.prisma.memberAsset.count({
        where: {
          ...overviewWhere,
          description: {
            not: null,
          },
        },
      }),
      this.prisma.memberAsset.findMany({
        where: overviewWhere,
        distinct: ['memberId'],
        select: { memberId: true },
      }),
      this.prisma.memberAsset.findMany({
        where: tagWhere,
        select: { tags: true },
      }),
    ]);

    const tagCounter = new Map<string, number>();
    for (const row of tagAssetRows) {
      for (const tag of row.tags) {
        tagCounter.set(tag, (tagCounter.get(tag) ?? 0) + 1);
      }
    }

    const tagBuckets = [...tagCounter.entries()]
      .sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }

        return left[0].localeCompare(right[0], 'zh-Hans-CN');
      })
      .slice(0, 30)
      .map(([tag, count]) => ({
        tag,
        count,
      }));

    return {
      total,
      page,
      pageSize,
      overview: {
        totalAssets,
        totalPhotos,
        totalDocuments,
        taggedAssets,
        sourcedAssets,
        describedAssets,
        linkedMembers: linkedMembersResult.length,
      },
      tagBuckets,
      data: data.map((asset) => ({
        ...asset,
        fileUrl: buildUploadUrl(asset.filePath),
      })),
    };
  }

  async getTimeline(memberId: string) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, isDeleted: false },
      include: {
        marriagesAsMember: {
          where: { isDeleted: false },
          include: {
            spouse: {
              select: { id: true, name: true },
            },
          },
        },
        marriagesAsSpouse: {
          where: { isDeleted: false },
          include: {
            member: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('未找到对应成员。');
    }

    const customEvents = await this.prisma.memberEvent.findMany({
      where: {
        memberId,
        isDeleted: false,
      },
      include: {
        createdBy: {
          select: { id: true, username: true, role: true },
        },
      },
      orderBy: { eventDate: 'desc' },
    });

    const systemEvents: Array<Record<string, unknown>> = [];

    if (member.birthDate) {
      systemEvents.push({
        id: `system-birth-${member.id}`,
        source: 'system',
        eventType: MemberEventType.BIRTH,
        title: `${member.name} 出生`,
        description: member.nativePlace ? `出生地/籍贯：${member.nativePlace}` : undefined,
        eventDate: member.birthDate,
      });
    }

    if (member.deathDate) {
      systemEvents.push({
        id: `system-death-${member.id}`,
        source: 'system',
        eventType: MemberEventType.DEATH,
        title: `${member.name} 去世`,
        description: member.notes ?? undefined,
        eventDate: member.deathDate,
      });
    }

    for (const marriage of member.marriagesAsMember) {
      if (marriage.startDate) {
        systemEvents.push({
          id: `system-marriage-${marriage.id}-start`,
          source: 'system',
          eventType: MemberEventType.MARRIAGE,
          title: `${member.name} 与 ${marriage.spouse.name} 结婚`,
          description: '系统根据婚姻关系自动生成',
          eventDate: marriage.startDate,
        });
      }

      if (marriage.endDate && marriage.status !== MarriageStatus.ACTIVE) {
        systemEvents.push({
          id: `system-marriage-${marriage.id}-end`,
          source: 'system',
          eventType:
            marriage.status === MarriageStatus.DIVORCED
              ? MemberEventType.DIVORCE
              : MemberEventType.DEATH,
          title:
            marriage.status === MarriageStatus.DIVORCED
              ? `${member.name} 与 ${marriage.spouse.name} 离异`
              : `${member.name} 与 ${marriage.spouse.name} 婚姻状态变更`,
          description:
            marriage.status === MarriageStatus.DIVORCED
              ? '系统根据离异状态自动生成'
              : '系统根据丧偶状态自动生成',
          eventDate: marriage.endDate,
        });
      }
    }

    for (const marriage of member.marriagesAsSpouse) {
      if (marriage.startDate) {
        systemEvents.push({
          id: `system-marriage-${marriage.id}-start`,
          source: 'system',
          eventType: MemberEventType.MARRIAGE,
          title: `${member.name} 与 ${marriage.member.name} 结婚`,
          description: '系统根据婚姻关系自动生成',
          eventDate: marriage.startDate,
        });
      }

      if (marriage.endDate && marriage.status !== MarriageStatus.ACTIVE) {
        systemEvents.push({
          id: `system-marriage-${marriage.id}-end`,
          source: 'system',
          eventType:
            marriage.status === MarriageStatus.DIVORCED
              ? MemberEventType.DIVORCE
              : MemberEventType.DEATH,
          title:
            marriage.status === MarriageStatus.DIVORCED
              ? `${member.name} 与 ${marriage.member.name} 离异`
              : `${member.name} 与 ${marriage.member.name} 婚姻状态变更`,
          description:
            marriage.status === MarriageStatus.DIVORCED
              ? '系统根据离异状态自动生成'
              : '系统根据丧偶状态自动生成',
          eventDate: marriage.endDate,
        });
      }
    }

    return [
      ...systemEvents,
      ...customEvents.map((event) => ({
        ...event,
        source: 'custom',
      })),
    ].sort((left, right) => {
      const leftTime = new Date(String(left.eventDate)).getTime();
      const rightTime = new Date(String(right.eventDate)).getTime();
      return rightTime - leftTime;
    });
  }

  async create(dto: CreateMemberDto, operatorId: string) {
    const { father, mother } = await this.ensureParentReferences(dto.fatherId, dto.motherId);
    await this.validateMemberConsistency(dto, {
      father,
      mother,
    });

    const created = await this.prisma.member.create({
      data: {
        name: dto.name,
        gender: dto.gender,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        deathDate: dto.deathDate ? new Date(dto.deathDate) : undefined,
        lifeStatus: dto.lifeStatus ?? LifeStatus.ALIVE,
        generationName: dto.generationName,
        birthOrder: dto.birthOrder,
        nativePlace: dto.nativePlace,
        fatherId: dto.fatherId,
        motherId: dto.motherId,
        notes: dto.notes,
      },
    });

    await this.invalidateDashboardCache();
    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.CREATE,
      targetType: 'MEMBER',
      targetId: created.id,
      after: created,
    });

    return this.getById(created.id);
  }

  async createQuickRelative(anchorId: string, dto: CreateQuickRelativeDto, operatorId: string) {
    const anchorMember = await this.prisma.member.findFirst({
      where: {
        id: anchorId,
        isDeleted: false,
      },
      include: {
        father: {
          select: { id: true, name: true, gender: true },
        },
        mother: {
          select: { id: true, name: true, gender: true },
        },
      },
    });

    if (!anchorMember) {
      throw new NotFoundException('未找到当前锚点成员，无法快速创建亲属。');
    }

    const existingMemberId = dto.existingMemberId?.trim();
    if (existingMemberId) {
      if (!['father', 'mother', 'child'].includes(dto.relationType)) {
        throw new BadRequestException('当前快速新增类型不支持绑定已有成员。');
      }

      if (existingMemberId === anchorId) {
        throw new BadRequestException('不能将当前成员本人绑定为亲属。');
      }

      if (dto.relationType === 'child') {
        if (anchorMember.gender === Gender.UNKNOWN) {
          throw new BadRequestException('当前成员性别未知，暂无法快速新增子女。');
        }

        const existingChild = await this.prisma.member.findFirst({
          where: {
            id: existingMemberId,
            isDeleted: false,
          },
        });

        if (!existingChild) {
          throw new NotFoundException('指定的子女成员不存在。');
        }

        if (
          anchorMember.gender === Gender.MALE &&
          existingChild.fatherId &&
          existingChild.fatherId !== anchorId
        ) {
          throw new BadRequestException('该成员已绑定其他父亲，不能直接作为当前成员子女。');
        }

        if (
          anchorMember.gender === Gender.FEMALE &&
          existingChild.motherId &&
          existingChild.motherId !== anchorId
        ) {
          throw new BadRequestException('该成员已绑定其他母亲，不能直接作为当前成员子女。');
        }

        const nextFatherId =
          anchorMember.gender === Gender.MALE
            ? anchorId
            : (existingChild.fatherId ?? dto.member.fatherId ?? undefined);
        const nextMotherId =
          anchorMember.gender === Gender.FEMALE
            ? anchorId
            : (existingChild.motherId ?? dto.member.motherId ?? undefined);
        const { father, mother } = await this.ensureParentReferences(
          nextFatherId,
          nextMotherId,
          existingMemberId,
        );
        await this.validateMemberConsistency(
          {
            name: existingChild.name,
            gender: existingChild.gender,
            birthDate: existingChild.birthDate,
            deathDate: existingChild.deathDate,
            lifeStatus: existingChild.lifeStatus,
            fatherId: nextFatherId,
            motherId: nextMotherId,
          },
          {
            currentId: existingMemberId,
            father,
            mother,
          },
        );

        await this.prisma.member.update({
          where: { id: existingMemberId },
          data: {
            fatherId: nextFatherId,
            motherId: nextMotherId,
          },
        });

        await this.invalidateDashboardCache();
        await this.auditLogsService.log({
          operatorId,
          action: AuditAction.UPDATE,
          targetType: 'MEMBER',
          targetId: existingMemberId,
          metadata: {
            quickRelativeType: dto.relationType,
            anchorId,
            linkedExistingMember: true,
          },
        });

        return this.getById(existingMemberId);
      }

      const nextFatherId =
        dto.relationType === 'father' ? existingMemberId : (anchorMember.fatherId ?? undefined);
      const nextMotherId =
        dto.relationType === 'mother' ? existingMemberId : (anchorMember.motherId ?? undefined);
      const { father, mother } = await this.ensureParentReferences(
        nextFatherId,
        nextMotherId,
        anchorId,
      );
      await this.validateMemberConsistency(
        {
          name: anchorMember.name,
          gender: anchorMember.gender,
          birthDate: anchorMember.birthDate,
          deathDate: anchorMember.deathDate,
          lifeStatus: anchorMember.lifeStatus,
          fatherId: nextFatherId,
          motherId: nextMotherId,
        },
        {
          currentId: anchorId,
          father,
          mother,
        },
      );

      await this.prisma.member.update({
        where: { id: anchorId },
        data:
          dto.relationType === 'father'
            ? { fatherId: existingMemberId }
            : { motherId: existingMemberId },
      });

      await this.invalidateDashboardCache();
      await this.auditLogsService.log({
        operatorId,
        action: AuditAction.UPDATE,
        targetType: 'MEMBER',
        targetId: anchorId,
        metadata: {
          quickRelativeType: dto.relationType,
          linkedMemberId: existingMemberId,
          linkedExistingMember: true,
        },
      });

      return this.getById(existingMemberId);
    }

    const activeSpouses = await this.prisma.marriage.findMany({
      where: {
        isDeleted: false,
        status: MarriageStatus.ACTIVE,
        OR: [{ memberId: anchorId }, { spouseId: anchorId }],
      },
      include: {
        member: {
          select: { id: true, name: true, gender: true },
        },
        spouse: {
          select: { id: true, name: true, gender: true },
        },
      },
    });

    const onlyActiveSpouse =
      activeSpouses.length === 1
        ? activeSpouses[0].memberId === anchorId
          ? activeSpouses[0].spouse
          : activeSpouses[0].member
        : null;

    const preparedMemberData: CreateMemberDto = {
      ...dto.member,
      gender:
        dto.relationType === 'father'
          ? Gender.MALE
          : dto.relationType === 'mother'
            ? Gender.FEMALE
            : dto.member.gender,
      fatherId:
        dto.relationType === 'child' && anchorMember.gender === Gender.MALE
          ? anchorId
          : dto.relationType === 'sibling' && anchorMember.fatherId
            ? anchorMember.fatherId
            : dto.member.fatherId,
      motherId:
        dto.relationType === 'child' && anchorMember.gender === Gender.FEMALE
          ? anchorId
          : dto.relationType === 'sibling' && anchorMember.motherId
            ? anchorMember.motherId
            : dto.member.motherId,
    };

    if (dto.relationType === 'child') {
      if (anchorMember.gender === Gender.UNKNOWN) {
        throw new BadRequestException('当前成员性别未知，暂无法快速新增子女。');
      }

      if (anchorMember.gender === Gender.MALE && !preparedMemberData.motherId && onlyActiveSpouse) {
        preparedMemberData.motherId = onlyActiveSpouse.id;
      }

      if (
        anchorMember.gender === Gender.FEMALE &&
        !preparedMemberData.fatherId &&
        onlyActiveSpouse
      ) {
        preparedMemberData.fatherId = onlyActiveSpouse.id;
      }
    }

    if (dto.relationType === 'sibling' && !anchorMember.fatherId && !anchorMember.motherId) {
      throw new BadRequestException('当前成员尚未录入父母信息，暂无法快速新增兄弟姐妹。');
    }

    const { father, mother } = await this.ensureParentReferences(
      preparedMemberData.fatherId,
      preparedMemberData.motherId,
    );
    await this.validateMemberConsistency(preparedMemberData, {
      father,
      mother,
    });

    const familyId = this.currentFamilyId();
    const createdRelative = await this.prisma.$transaction(async (tx) => {
      const created = await tx.member.create({
        data: {
          familyId,
          name: preparedMemberData.name,
          gender: preparedMemberData.gender,
          birthDate: preparedMemberData.birthDate
            ? new Date(preparedMemberData.birthDate)
            : undefined,
          deathDate: preparedMemberData.deathDate
            ? new Date(preparedMemberData.deathDate)
            : undefined,
          lifeStatus: preparedMemberData.lifeStatus ?? LifeStatus.ALIVE,
          generationName: preparedMemberData.generationName,
          birthOrder: preparedMemberData.birthOrder,
          nativePlace: preparedMemberData.nativePlace,
          fatherId: preparedMemberData.fatherId,
          motherId: preparedMemberData.motherId,
          notes: preparedMemberData.notes,
        },
      });

      if (dto.relationType === 'father') {
        await tx.member.update({
          where: { id: anchorId },
          data: { fatherId: created.id },
        });
      }

      if (dto.relationType === 'mother') {
        await tx.member.update({
          where: { id: anchorId },
          data: { motherId: created.id },
        });
      }

      if (dto.relationType === 'spouse') {
        await tx.marriage.create({
          data: {
            familyId,
            pairKey: buildPairKey(anchorId, created.id),
            memberId: anchorId,
            spouseId: created.id,
            status: MarriageStatus.ACTIVE,
          },
        });
      }

      return created;
    });

    await this.invalidateDashboardCache();

    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.CREATE,
      targetType: 'MEMBER',
      targetId: createdRelative.id,
      after: createdRelative,
      metadata: {
        quickRelativeType: dto.relationType,
        anchorId,
      },
    });

    if (dto.relationType === 'father' || dto.relationType === 'mother') {
      await this.auditLogsService.log({
        operatorId,
        action: AuditAction.UPDATE,
        targetType: 'MEMBER',
        targetId: anchorId,
        metadata: {
          quickRelativeType: dto.relationType,
          linkedMemberId: createdRelative.id,
        },
      });
    }

    if (dto.relationType === 'spouse') {
      await this.auditLogsService.log({
        operatorId,
        action: AuditAction.CREATE,
        targetType: 'MARRIAGE',
        metadata: {
          anchorId,
          spouseId: createdRelative.id,
          quickRelativeType: dto.relationType,
        },
      });
    }

    return this.getById(createdRelative.id);
  }

  async update(id: string, dto: UpdateMemberDto, operatorId: string) {
    const existingMember = await this.prisma.member.findUnique({ where: { id } });

    if (!existingMember) {
      throw new NotFoundException('未找到对应成员。');
    }

    const nextFatherId = dto.fatherId ?? existingMember.fatherId ?? undefined;
    const nextMotherId = dto.motherId ?? existingMember.motherId ?? undefined;
    const { father, mother } = await this.ensureParentReferences(nextFatherId, nextMotherId, id);
    await this.validateMemberConsistency(
      {
        name: dto.name ?? existingMember.name,
        gender: dto.gender ?? existingMember.gender,
        fatherId: nextFatherId,
        motherId: nextMotherId,
        birthDate:
          dto.birthDate !== undefined
            ? dto.birthDate
            : existingMember.birthDate?.toISOString().slice(0, 10),
        deathDate:
          dto.deathDate !== undefined
            ? dto.deathDate
            : existingMember.deathDate?.toISOString().slice(0, 10),
        lifeStatus: dto.lifeStatus ?? existingMember.lifeStatus,
        generationName: dto.generationName ?? existingMember.generationName ?? undefined,
        birthOrder: dto.birthOrder ?? existingMember.birthOrder ?? undefined,
        nativePlace: dto.nativePlace ?? existingMember.nativePlace ?? undefined,
        notes: dto.notes ?? existingMember.notes ?? undefined,
      },
      {
        currentId: id,
        father,
        mother,
      },
    );

    const updated = await this.prisma.member.update({
      where: { id },
      data: {
        name: dto.name,
        gender: dto.gender,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        deathDate: dto.deathDate ? new Date(dto.deathDate) : undefined,
        lifeStatus: dto.lifeStatus,
        generationName: dto.generationName,
        birthOrder: dto.birthOrder,
        nativePlace: dto.nativePlace,
        fatherId: dto.fatherId,
        motherId: dto.motherId,
        notes: dto.notes,
      },
    });

    await this.invalidateDashboardCache();
    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.UPDATE,
      targetType: 'MEMBER',
      targetId: id,
      before: existingMember,
      after: updated,
    });

    return this.getById(id);
  }

  async assertMemberConsistencyForPatch(
    memberId: string,
    patch: Partial<CreateMemberDto> & {
      fatherId?: string;
      motherId?: string;
    },
  ) {
    const existingMember = await this.prisma.member.findUnique({ where: { id: memberId } });

    if (!existingMember) {
      throw new NotFoundException('未找到对应成员。');
    }

    const nextFatherId = patch.fatherId ?? existingMember.fatherId ?? undefined;
    const nextMotherId = patch.motherId ?? existingMember.motherId ?? undefined;
    const { father, mother } = await this.ensureParentReferences(
      nextFatherId,
      nextMotherId,
      memberId,
    );

    await this.validateMemberConsistency(
      {
        name: patch.name ?? existingMember.name,
        gender: patch.gender ?? existingMember.gender,
        fatherId: nextFatherId,
        motherId: nextMotherId,
        birthDate:
          patch.birthDate !== undefined
            ? patch.birthDate
            : existingMember.birthDate?.toISOString().slice(0, 10),
        deathDate:
          patch.deathDate !== undefined
            ? patch.deathDate
            : existingMember.deathDate?.toISOString().slice(0, 10),
        lifeStatus: patch.lifeStatus ?? existingMember.lifeStatus,
        generationName: patch.generationName ?? existingMember.generationName ?? undefined,
        birthOrder: patch.birthOrder ?? existingMember.birthOrder ?? undefined,
        nativePlace: patch.nativePlace ?? existingMember.nativePlace ?? undefined,
        notes: patch.notes ?? existingMember.notes ?? undefined,
      },
      {
        currentId: memberId,
        father,
        mother,
      },
    );
  }

  async remove(id: string, operatorId: string) {
    const existingMember = await this.prisma.member.findUnique({ where: { id } });

    if (!existingMember) {
      throw new NotFoundException('未找到对应成员。');
    }

    const updated = await this.prisma.member.update({
      where: { id },
      data: { isDeleted: true },
    });

    await this.invalidateDashboardCache();
    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.DELETE,
      targetType: 'MEMBER',
      targetId: id,
      before: existingMember,
      after: updated,
    });

    return { success: true };
  }

  async restore(id: string, operatorId: string) {
    const existingMember = await this.prisma.member.findUnique({ where: { id } });

    if (!existingMember) {
      throw new NotFoundException('未找到对应成员。');
    }

    const updated = await this.prisma.member.update({
      where: { id },
      data: { isDeleted: false },
    });

    await this.invalidateDashboardCache();
    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.RESTORE,
      targetType: 'MEMBER',
      targetId: id,
      before: existingMember,
      after: updated,
    });

    return this.getById(id);
  }

  async uploadPhoto(id: string, file: Express.Multer.File, operatorId: string) {
    if (!file) {
      throw new BadRequestException('请先选择要上传的头像文件。');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('仅支持上传图片格式文件。');
    }

    const member = await this.prisma.member.findUnique({ where: { id } });

    if (!member) {
      throw new NotFoundException('未找到对应成员。');
    }

    const uploadRoot = resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');
    const photoDirectory = resolve(uploadRoot, 'members');
    const extension = extname(file.originalname || '') || '.jpg';
    const relativePath = `members/${randomUUID()}${extension}`;
    const absolutePath = resolve(uploadRoot, relativePath);

    await mkdir(photoDirectory, { recursive: true });
    await writeFile(absolutePath, file.buffer);

    if (member.photoPath) {
      const oldPath = resolve(uploadRoot, member.photoPath);
      await unlink(oldPath).catch(() => undefined);
    }

    const updated = await this.prisma.member.update({
      where: { id },
      data: { photoPath: relativePath },
    });

    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.UPLOAD_PHOTO,
      targetType: 'MEMBER',
      targetId: id,
      before: { photoPath: member.photoPath },
      after: { photoPath: updated.photoPath },
    });

    return {
      photoPath: updated.photoPath,
      photoUrl: buildPhotoUrl(updated.photoPath),
    };
  }

  async uploadAssets(
    memberId: string,
    files: Express.Multer.File[],
    category: MemberAssetCategory,
    operatorId: string,
    metadata?: UploadMemberAssetsDto,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('请至少选择一个文件后再上传。');
    }

    const member = await this.prisma.member.findFirst({
      where: { id: memberId, isDeleted: false },
      select: { id: true, name: true },
    });

    if (!member) {
      throw new NotFoundException('未找到对应成员。');
    }

    const uploadRoot = resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');
    const directoryName =
      category === MemberAssetCategory.PHOTO ? 'member-assets/photos' : 'member-assets/documents';
    const saveDirectory = resolve(uploadRoot, directoryName);
    await mkdir(saveDirectory, { recursive: true });
    const normalizedAssetMetadata = this.normalizeAssetMetadata(metadata);

    const createdAssets: Array<{
      id: string;
      memberId: string;
      uploadedById: string | null;
      category: MemberAssetCategory;
      filePath: string;
      fileUrl: string | null;
      originalName: string;
      title: string | null;
      sourceType: string | null;
      source: string | null;
      description: string | null;
      tags: string[];
      checksum: string | null;
      mimeType: string;
      sizeBytes: number;
      isDeleted: boolean;
      createdAt: Date;
      updatedAt: Date;
    }> = [];
    for (const file of files) {
      this.validateAssetFile(file, category);

      const extension = extname(file.originalname || '') || '';
      const relativePath = `${directoryName}/${randomUUID()}${extension}`;
      const absolutePath = resolve(uploadRoot, relativePath);
      await writeFile(absolutePath, file.buffer);
      const checksum = buildFileChecksum(file.buffer);

      const created = await this.prisma.memberAsset.create({
        data: {
          memberId,
          uploadedById: operatorId,
          category,
          filePath: relativePath,
          originalName: file.originalname,
          checksum,
          title: normalizedAssetMetadata.title,
          sourceType: normalizedAssetMetadata.sourceType,
          source: normalizedAssetMetadata.source,
          description: normalizedAssetMetadata.description,
          tags: normalizedAssetMetadata.tags,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
      });

      createdAssets.push({
        ...created,
        fileUrl: buildUploadUrl(created.filePath),
      });
    }

    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.UPLOAD_PHOTO,
      targetType: 'MEMBER_ASSET',
      targetId: memberId,
      metadata: {
        category,
        count: createdAssets.length,
        title: normalizedAssetMetadata.title,
        sourceType: normalizedAssetMetadata.sourceType,
        source: normalizedAssetMetadata.source,
        tags: normalizedAssetMetadata.tags,
        hasDescription: Boolean(normalizedAssetMetadata.description),
      },
    });

    return createdAssets;
  }

  async updateAsset(
    memberId: string,
    assetId: string,
    dto: UpdateMemberAssetDto,
    operatorId: string,
  ) {
    const asset = await this.prisma.memberAsset.findFirst({
      where: {
        id: assetId,
        memberId,
        isDeleted: false,
      },
      include: {
        uploadedBy: {
          select: { id: true, username: true, role: true },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException('未找到对应资源文件。');
    }

    const data = this.buildAssetUpdateData(dto);
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('没有检测到可更新的资料信息。');
    }

    const updated = await this.prisma.memberAsset.update({
      where: { id: assetId },
      data,
      include: {
        uploadedBy: {
          select: { id: true, username: true, role: true },
        },
      },
    });

    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.UPDATE,
      targetType: 'MEMBER_ASSET',
      targetId: assetId,
      before: {
        title: asset.title,
        sourceType: asset.sourceType,
        source: asset.source,
        description: asset.description,
        tags: asset.tags,
      },
      after: {
        title: updated.title,
        sourceType: updated.sourceType,
        source: updated.source,
        description: updated.description,
        tags: updated.tags,
      },
    });

    return {
      ...updated,
      fileUrl: buildUploadUrl(updated.filePath),
    };
  }

  async removeAsset(memberId: string, assetId: string, operatorId: string) {
    const asset = await this.prisma.memberAsset.findFirst({
      where: {
        id: assetId,
        memberId,
        isDeleted: false,
      },
    });

    if (!asset) {
      throw new NotFoundException('未找到对应资源文件。');
    }

    const uploadRoot = resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');
    await unlink(resolve(uploadRoot, asset.filePath)).catch(() => undefined);

    await this.prisma.memberAsset.update({
      where: { id: assetId },
      data: { isDeleted: true },
    });

    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.DELETE,
      targetType: 'MEMBER_ASSET',
      targetId: assetId,
      metadata: {
        memberId,
        category: asset.category,
      },
    });

    return { success: true };
  }

  async createEvent(memberId: string, dto: CreateMemberEventDto, operatorId: string) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, isDeleted: false },
      select: { id: true, name: true },
    });

    if (!member) {
      throw new NotFoundException('未找到对应成员。');
    }

    const created = await this.prisma.memberEvent.create({
      data: {
        memberId,
        createdById: operatorId,
        eventType: dto.eventType,
        title: dto.title,
        description: dto.description,
        eventDate: new Date(dto.eventDate),
      },
      include: {
        createdBy: {
          select: { id: true, username: true, role: true },
        },
      },
    });

    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.CREATE,
      targetType: 'MEMBER_EVENT',
      targetId: created.id,
      after: {
        memberId,
        eventType: dto.eventType,
        title: dto.title,
        eventDate: dto.eventDate,
      },
    });

    return {
      ...created,
      source: 'custom',
    };
  }

  async removeEvent(memberId: string, eventId: string, operatorId: string) {
    const event = await this.prisma.memberEvent.findFirst({
      where: {
        id: eventId,
        memberId,
        isDeleted: false,
      },
    });

    if (!event) {
      throw new NotFoundException('未找到对应成员事件。');
    }

    await this.prisma.memberEvent.update({
      where: { id: eventId },
      data: { isDeleted: true },
    });

    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.DELETE,
      targetType: 'MEMBER_EVENT',
      targetId: eventId,
      metadata: { memberId },
    });

    return { success: true };
  }

  async createMarriage(memberId: string, dto: CreateMarriageDto, operatorId: string) {
    if (memberId === dto.spouseId) {
      throw new BadRequestException('成员不能与自己建立婚姻关系。');
    }

    const [member, spouse] = await this.prisma.$transaction([
      this.prisma.member.findUnique({ where: { id: memberId } }),
      this.prisma.member.findUnique({ where: { id: dto.spouseId } }),
    ]);

    if (!member || !spouse) {
      throw new NotFoundException('婚姻关系中的成员不存在。');
    }

    const pairKey = buildPairKey(memberId, dto.spouseId);
    const existingMarriage = await this.prisma.marriage.findUnique({
      where: { pairKey },
    });

    if (existingMarriage && !existingMarriage.isDeleted) {
      throw new ConflictException('这两位成员之间的婚姻关系已存在。');
    }

    const marriage =
      existingMarriage && existingMarriage.isDeleted
        ? await this.prisma.marriage.update({
            where: { id: existingMarriage.id },
            data: {
              isDeleted: false,
              status: dto.status ?? MarriageStatus.ACTIVE,
              startDate: dto.startDate ? new Date(dto.startDate) : existingMarriage.startDate,
              endDate: dto.endDate ? new Date(dto.endDate) : existingMarriage.endDate,
            },
          })
        : await this.prisma.marriage.create({
            data: {
              pairKey,
              memberId,
              spouseId: dto.spouseId,
              status: dto.status ?? MarriageStatus.ACTIVE,
              startDate: dto.startDate ? new Date(dto.startDate) : undefined,
              endDate: dto.endDate ? new Date(dto.endDate) : undefined,
            },
          });

    await this.invalidateDashboardCache();
    await this.auditLogsService.log({
      operatorId,
      action: existingMarriage ? AuditAction.RESTORE : AuditAction.CREATE,
      targetType: 'MARRIAGE',
      targetId: marriage.id,
      after: marriage,
    });

    return marriage;
  }

  async updateMarriage(
    memberId: string,
    marriageId: string,
    dto: UpdateMarriageDto,
    operatorId: string,
  ) {
    const marriage = await this.ensureMarriageBelongsToMember(memberId, marriageId);

    const updated = await this.prisma.marriage.update({
      where: { id: marriageId },
      data: {
        status: dto.status,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });

    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.UPDATE,
      targetType: 'MARRIAGE',
      targetId: marriageId,
      before: marriage,
      after: updated,
    });

    return updated;
  }

  async removeMarriage(memberId: string, marriageId: string, operatorId: string) {
    const marriage = await this.ensureMarriageBelongsToMember(memberId, marriageId);

    const updated = await this.prisma.marriage.update({
      where: { id: marriageId },
      data: { isDeleted: true },
    });

    await this.invalidateDashboardCache();
    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.DELETE,
      targetType: 'MARRIAGE',
      targetId: marriageId,
      before: marriage,
      after: updated,
    });

    return { success: true };
  }

  async restoreMarriage(memberId: string, marriageId: string, operatorId: string) {
    const marriage = await this.ensureMarriageBelongsToMember(memberId, marriageId);

    const updated = await this.prisma.marriage.update({
      where: { id: marriageId },
      data: { isDeleted: false },
    });

    await this.invalidateDashboardCache();
    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.RESTORE,
      targetType: 'MARRIAGE',
      targetId: marriageId,
      before: marriage,
      after: updated,
    });

    return updated;
  }

  async exportMembers(operatorId: string) {
    const members = await this.prisma.member.findMany({
      where: { isDeleted: false },
      include: {
        father: {
          select: { name: true },
        },
        mother: {
          select: { name: true },
        },
      },
      orderBy: [{ generationName: 'asc' }, { birthOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const marriages = await this.prisma.marriage.findMany({
      where: { isDeleted: false },
      include: {
        member: { select: { id: true, name: true } },
        spouse: { select: { id: true, name: true } },
      },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('家族成员');

    worksheet.columns = [
      { header: '姓名', key: 'name', width: 16 },
      { header: '性别', key: 'gender', width: 10 },
      { header: '生卒', key: 'life', width: 28 },
      { header: '父亲', key: 'father', width: 16 },
      { header: '母亲', key: 'mother', width: 16 },
      { header: '配偶', key: 'spouses', width: 22 },
      { header: '字辈', key: 'generationName', width: 12 },
      { header: '排行', key: 'birthOrder', width: 10 },
      { header: '籍贯', key: 'nativePlace', width: 20 },
      { header: '状态', key: 'lifeStatus', width: 12 },
      { header: '备注', key: 'notes', width: 32 },
    ];

    for (const member of members) {
      const spouseNames = marriages
        .filter((marriage) => marriage.memberId === member.id || marriage.spouseId === member.id)
        .map((marriage) =>
          marriage.memberId === member.id ? marriage.spouse.name : marriage.member.name,
        );

      worksheet.addRow({
        name: member.name,
        gender:
          member.gender === Gender.MALE ? '男' : member.gender === Gender.FEMALE ? '女' : '未知',
        life: [
          member.birthDate?.toISOString().slice(0, 10),
          member.deathDate?.toISOString().slice(0, 10),
        ]
          .filter(Boolean)
          .join(' / '),
        father: member.father?.name ?? '',
        mother: member.mother?.name ?? '',
        spouses: spouseNames.join('、'),
        generationName: member.generationName ?? '',
        birthOrder: member.birthOrder ?? '',
        nativePlace: member.nativePlace ?? '',
        lifeStatus:
          member.lifeStatus === LifeStatus.ALIVE
            ? '在世'
            : member.lifeStatus === LifeStatus.DECEASED
              ? '已故'
              : '未知',
        notes: member.notes ?? '',
      });
    }

    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.EXPORT,
      targetType: 'MEMBER',
      metadata: {
        count: members.length,
      },
    });

    return buffer;
  }

  async exportImportTemplate() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('成员导入模板');
    const guide = workbook.addWorksheet('填写说明');

    sheet.columns = [
      { header: '编号', key: 'code', width: 14 },
      { header: '姓名', key: 'name', width: 16 },
      { header: '性别', key: 'gender', width: 12 },
      { header: '出生日期', key: 'birthDate', width: 16 },
      { header: '去世日期', key: 'deathDate', width: 16 },
      { header: '生命状态', key: 'lifeStatus', width: 12 },
      { header: '字辈', key: 'generationName', width: 12 },
      { header: '排行', key: 'birthOrder', width: 10 },
      { header: '籍贯', key: 'nativePlace', width: 20 },
      { header: '父亲编号', key: 'fatherCode', width: 14 },
      { header: '母亲编号', key: 'motherCode', width: 14 },
      { header: '备注', key: 'notes', width: 28 },
    ];

    sheet.addRow({
      code: 'M001',
      name: '王国华',
      gender: '男',
      birthDate: '1965-03-15',
      deathDate: '',
      lifeStatus: '在世',
      generationName: '国',
      birthOrder: 1,
      nativePlace: '江苏徐州',
      fatherCode: 'M100',
      motherCode: 'M101',
      notes: '示例数据',
    });
    sheet.addRow({
      code: 'M100',
      name: '王振山',
      gender: '男',
      birthDate: '1938-05-03',
      deathDate: '',
      lifeStatus: '在世',
      generationName: '振',
      birthOrder: 1,
      nativePlace: '江苏徐州',
      fatherCode: '',
      motherCode: '',
      notes: '',
    });
    sheet.addRow({
      code: 'M101',
      name: '李秀兰',
      gender: '女',
      birthDate: '1940-10-12',
      deathDate: '',
      lifeStatus: '在世',
      generationName: '',
      birthOrder: '',
      nativePlace: '江苏徐州',
      fatherCode: '',
      motherCode: '',
      notes: '',
    });

    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    guide.columns = [
      { header: '项', key: 'item', width: 20 },
      { header: '说明', key: 'desc', width: 80 },
    ];
    guide.addRows([
      ['编号', '必填，导入文件内唯一，用于父亲编号/母亲编号关联。'],
      ['姓名', '必填。'],
      ['性别', '支持：男 / 女 / 未知，或 MALE / FEMALE / UNKNOWN。'],
      ['出生日期', '格式建议：YYYY-MM-DD。'],
      ['去世日期', '只有生命状态为“已故”时才填写。'],
      ['生命状态', '支持：在世 / 已故 / 未知，或 ALIVE / DECEASED / UNKNOWN。'],
      ['字辈', '选填。'],
      ['排行', '选填，填写正整数。'],
      ['籍贯', '选填。'],
      ['父亲编号', '填写本文件内另一条成员编号。'],
      ['母亲编号', '填写本文件内另一条成员编号。'],
      ['备注', '选填。'],
      ['注意', '当前版本导入关系仅支持通过“父亲编号/母亲编号”在同一文件内建立。'],
    ]);
    guide.getRow(1).font = { bold: true };

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async importMembers(file: Express.Multer.File, operatorId: string) {
    if (!file) {
      throw new BadRequestException('请先上传要导入的 Excel 文件。');
    }

    const workbook = new ExcelJS.Workbook();
    await (workbook.xlsx as { load: (buffer: unknown) => Promise<ExcelJS.Workbook> }).load(
      file.buffer,
    );
    const sheet = workbook.worksheets[0];

    if (!sheet) {
      throw new BadRequestException('导入文件中未找到有效工作表。');
    }

    type ImportRow = {
      rowNumber: number;
      code: string;
      name: string;
      gender: Gender;
      birthDate?: string;
      deathDate?: string;
      lifeStatus: LifeStatus;
      generationName?: string;
      birthOrder?: number;
      nativePlace?: string;
      fatherCode?: string;
      motherCode?: string;
      notes?: string;
    };

    const rows: ImportRow[] = [];
    const rowCodeSet = new Set<string>();

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const values = row.values as Array<string | number | undefined>;

      const code = this.normalizeCellValue(values[1]);
      const name = this.normalizeCellValue(values[2]);
      const genderRaw = this.normalizeCellValue(values[3]);
      const birthDate = this.normalizeCellValue(values[4]);
      const deathDate = this.normalizeCellValue(values[5]);
      const lifeStatusRaw = this.normalizeCellValue(values[6]);
      const generationName = this.normalizeCellValue(values[7]);
      const birthOrderRaw = this.normalizeCellValue(values[8]);
      const nativePlace = this.normalizeCellValue(values[9]);
      const fatherCode = this.normalizeCellValue(values[10]);
      const motherCode = this.normalizeCellValue(values[11]);
      const notes = this.normalizeCellValue(values[12]);

      if (
        !code &&
        !name &&
        !genderRaw &&
        !birthDate &&
        !deathDate &&
        !lifeStatusRaw &&
        !generationName &&
        !birthOrderRaw &&
        !nativePlace &&
        !fatherCode &&
        !motherCode &&
        !notes
      ) {
        continue;
      }

      if (!code) {
        throw new BadRequestException(`第 ${rowNumber} 行缺少“编号”。`);
      }

      if (!name) {
        throw new BadRequestException(`第 ${rowNumber} 行缺少“姓名”。`);
      }

      if (rowCodeSet.has(code)) {
        throw new BadRequestException(
          `第 ${rowNumber} 行编号 ${code} 重复，请保持文件内编号唯一。`,
        );
      }
      rowCodeSet.add(code);

      const gender = this.parseGenderInput(genderRaw);
      const lifeStatus = this.parseLifeStatusInput(lifeStatusRaw || '在世');
      const birthOrder = birthOrderRaw ? Number.parseInt(birthOrderRaw, 10) : undefined;

      if (birthOrderRaw && (!birthOrder || birthOrder < 1)) {
        throw new BadRequestException(`第 ${rowNumber} 行“排行”必须为正整数。`);
      }

      rows.push({
        rowNumber,
        code,
        name,
        gender,
        birthDate: birthDate || undefined,
        deathDate: deathDate || undefined,
        lifeStatus,
        generationName: generationName || undefined,
        birthOrder,
        nativePlace: nativePlace || undefined,
        fatherCode: fatherCode || undefined,
        motherCode: motherCode || undefined,
        notes: notes || undefined,
      });
    }

    if (rows.length === 0) {
      throw new BadRequestException('导入文件中没有可导入的成员数据。');
    }

    const rowMap = new Map(rows.map((row) => [row.code, row]));

    for (const row of rows) {
      if (row.fatherCode && !rowMap.has(row.fatherCode)) {
        throw new BadRequestException(
          `第 ${row.rowNumber} 行引用的父亲编号 ${row.fatherCode} 不存在于当前导入文件中。`,
        );
      }

      if (row.motherCode && !rowMap.has(row.motherCode)) {
        throw new BadRequestException(
          `第 ${row.rowNumber} 行引用的母亲编号 ${row.motherCode} 不存在于当前导入文件中。`,
        );
      }

      if (row.fatherCode && row.motherCode && row.fatherCode === row.motherCode) {
        throw new BadRequestException(`第 ${row.rowNumber} 行父亲编号与母亲编号不能相同。`);
      }

      await this.validateMemberConsistency(
        {
          name: row.name,
          gender: row.gender,
          birthDate: row.birthDate,
          deathDate: row.deathDate,
          lifeStatus: row.lifeStatus,
          generationName: row.generationName,
          birthOrder: row.birthOrder,
          nativePlace: row.nativePlace,
          fatherId: undefined,
          motherId: undefined,
          notes: row.notes,
        },
        {
          father: null,
          mother: null,
        },
      );
    }

    this.assertNoImportCycles(rows);

    const familyId = this.currentFamilyId();
    const createdCount = await this.prisma.$transaction(async (tx) => {
      const createdMap = new Map<string, { id: string; row: ImportRow }>();

      for (const row of rows) {
        const created = await tx.member.create({
          data: {
            familyId,
            name: row.name,
            gender: row.gender,
            birthDate: row.birthDate ? new Date(row.birthDate) : undefined,
            deathDate: row.deathDate ? new Date(row.deathDate) : undefined,
            lifeStatus: row.lifeStatus,
            generationName: row.generationName,
            birthOrder: row.birthOrder,
            nativePlace: row.nativePlace,
            notes: row.notes,
          },
        });

        createdMap.set(row.code, { id: created.id, row });
      }

      for (const { id, row } of createdMap.values()) {
        if (!row.fatherCode && !row.motherCode) {
          continue;
        }

        const fatherRecord = row.fatherCode ? createdMap.get(row.fatherCode) : undefined;
        const motherRecord = row.motherCode ? createdMap.get(row.motherCode) : undefined;

        await this.validateMemberConsistency(
          {
            name: row.name,
            gender: row.gender,
            birthDate: row.birthDate,
            deathDate: row.deathDate,
            lifeStatus: row.lifeStatus,
            generationName: row.generationName,
            birthOrder: row.birthOrder,
            nativePlace: row.nativePlace,
            fatherId: fatherRecord?.id,
            motherId: motherRecord?.id,
            notes: row.notes,
          },
          {
            currentId: id,
            father: fatherRecord
              ? ({
                  id: fatherRecord.id,
                  gender: fatherRecord.row.gender,
                  birthDate: fatherRecord.row.birthDate
                    ? new Date(fatherRecord.row.birthDate)
                    : null,
                } as Member)
              : null,
            mother: motherRecord
              ? ({
                  id: motherRecord.id,
                  gender: motherRecord.row.gender,
                  birthDate: motherRecord.row.birthDate
                    ? new Date(motherRecord.row.birthDate)
                    : null,
                } as Member)
              : null,
          },
        );

        await tx.member.update({
          where: { id },
          data: {
            fatherId: fatherRecord?.id,
            motherId: motherRecord?.id,
          },
        });
      }

      return createdMap.size;
    });

    await this.invalidateDashboardCache();
    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.CREATE,
      targetType: 'MEMBER_IMPORT',
      metadata: {
        createdCount,
        fileName: file.originalname,
      },
    });

    return {
      success: true,
      createdCount,
      message: `成功导入 ${createdCount} 位成员。`,
    };
  }

  private async ensureParentReferences(fatherId?: string, motherId?: string, currentId?: string) {
    if (fatherId && currentId && fatherId === currentId) {
      throw new BadRequestException('父亲不能指向当前成员本人。');
    }

    if (motherId && currentId && motherId === currentId) {
      throw new BadRequestException('母亲不能指向当前成员本人。');
    }

    if (fatherId && motherId && fatherId === motherId) {
      throw new BadRequestException('父亲和母亲不能设置为同一成员。');
    }

    const father = fatherId
      ? await this.prisma.member.findFirst({ where: { id: fatherId, isDeleted: false } })
      : null;
    const mother = motherId
      ? await this.prisma.member.findFirst({ where: { id: motherId, isDeleted: false } })
      : null;

    if (fatherId && !father) {
      throw new NotFoundException('指定的父亲成员不存在。');
    }

    if (motherId && !mother) {
      throw new NotFoundException('指定的母亲成员不存在。');
    }

    return {
      father,
      mother,
    };
  }

  private async validateMemberConsistency(
    dto: Omit<Partial<CreateMemberDto>, 'birthDate' | 'deathDate'> & {
      fatherId?: string | null;
      motherId?: string | null;
      birthDate?: string | Date | null;
      deathDate?: string | Date | null;
      lifeStatus?: LifeStatus;
    },
    options: {
      currentId?: string;
      father: Member | null;
      mother: Member | null;
    },
  ) {
    const errors: string[] = [];
    const birthDate = this.parseDateInput(dto.birthDate);
    const deathDate = this.parseDateInput(dto.deathDate);

    if (dto.lifeStatus !== LifeStatus.DECEASED && deathDate) {
      errors.push('只有生命状态为“已故”时才能填写去世日期。');
    }

    if (birthDate && deathDate && birthDate.getTime() > deathDate.getTime()) {
      errors.push('出生日期不能晚于去世日期。');
    }

    if (options.father?.gender === Gender.FEMALE) {
      errors.push('父亲关系不能选择女性成员。');
    }

    if (options.mother?.gender === Gender.MALE) {
      errors.push('母亲关系不能选择男性成员。');
    }

    if (
      birthDate &&
      options.father?.birthDate &&
      birthDate.getTime() <= options.father.birthDate.getTime()
    ) {
      errors.push('成员出生日期必须晚于父亲的出生日期。');
    }

    if (
      birthDate &&
      options.mother?.birthDate &&
      birthDate.getTime() <= options.mother.birthDate.getTime()
    ) {
      errors.push('成员出生日期必须晚于母亲的出生日期。');
    }

    if (options.currentId) {
      const descendantIds = await this.getDescendantIds(options.currentId);

      if (dto.fatherId && descendantIds.has(dto.fatherId)) {
        errors.push('父亲关系不能选择当前成员的后代。');
      }

      if (dto.motherId && descendantIds.has(dto.motherId)) {
        errors.push('母亲关系不能选择当前成员的后代。');
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors.join('；'));
    }
  }

  private parseDateInput(value?: string | Date | null) {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private normalizeCellValue(value: unknown) {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return value.trim();
    }

    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return value.toString().trim();
    }

    if (typeof value === 'object') {
      return JSON.stringify(value).trim();
    }

    return '';
  }

  private parseGenderInput(value: string) {
    const normalized = value.trim().toUpperCase();

    if (normalized === '男' || normalized === 'MALE') {
      return Gender.MALE;
    }

    if (normalized === '女' || normalized === 'FEMALE') {
      return Gender.FEMALE;
    }

    if (!normalized || normalized === '未知' || normalized === 'UNKNOWN') {
      return Gender.UNKNOWN;
    }

    throw new BadRequestException(`导入文件中的性别值“${value}”不合法。`);
  }

  private parseLifeStatusInput(value: string) {
    const normalized = value.trim().toUpperCase();

    if (!normalized || normalized === '在世' || normalized === 'ALIVE') {
      return LifeStatus.ALIVE;
    }

    if (normalized === '已故' || normalized === 'DECEASED') {
      return LifeStatus.DECEASED;
    }

    if (normalized === '未知' || normalized === 'UNKNOWN') {
      return LifeStatus.UNKNOWN;
    }

    throw new BadRequestException(`导入文件中的生命状态值“${value}”不合法。`);
  }

  private buildAssetWhereInput(
    query: Pick<
      MemberAssetLibraryQueryDto,
      | 'category'
      | 'keyword'
      | 'tag'
      | 'sourceType'
      | 'hasSource'
      | 'hasDescription'
      | 'hasTags'
      | 'importBatchId'
    >,
    importBatchAssetIds?: string[],
  ): Prisma.MemberAssetWhereInput {
    const normalizedKeyword = query.keyword?.trim();
    const normalizedTag = query.tag?.trim();
    const normalizedSourceType = query.sourceType?.trim();

    return {
      isDeleted: false,
      id: importBatchAssetIds
        ? {
            in: importBatchAssetIds.length > 0 ? importBatchAssetIds : ['__never__'],
          }
        : undefined,
      category: query.category,
      sourceType: normalizedSourceType || undefined,
      description:
        query.hasDescription === true
          ? {
              not: null,
            }
          : undefined,
      tags:
        query.hasTags === true
          ? normalizedTag
            ? {
                has: normalizedTag,
              }
            : {
                isEmpty: false,
              }
          : normalizedTag
            ? {
                has: normalizedTag,
              }
            : undefined,
      AND:
        query.hasSource === true
          ? [
              {
                OR: [
                  {
                    sourceType: {
                      not: null,
                    },
                  },
                  {
                    source: {
                      not: null,
                    },
                  },
                ],
              },
            ]
          : undefined,
      OR: normalizedKeyword
        ? [
            {
              originalName: {
                contains: normalizedKeyword,
                mode: 'insensitive',
              },
            },
            {
              title: {
                contains: normalizedKeyword,
                mode: 'insensitive',
              },
            },
            {
              sourceType: {
                contains: normalizedKeyword,
                mode: 'insensitive',
              },
            },
            {
              source: {
                contains: normalizedKeyword,
                mode: 'insensitive',
              },
            },
            {
              description: {
                contains: normalizedKeyword,
                mode: 'insensitive',
              },
            },
            {
              member: {
                name: {
                  contains: normalizedKeyword,
                  mode: 'insensitive',
                },
              },
            },
            {
              member: {
                generationName: {
                  contains: normalizedKeyword,
                  mode: 'insensitive',
                },
              },
            },
            {
              member: {
                nativePlace: {
                  contains: normalizedKeyword,
                  mode: 'insensitive',
                },
              },
            },
          ]
        : undefined,
    };
  }

  private normalizeAssetMetadata(metadata?: MemberAssetMetadataDto) {
    return {
      sourceType: this.normalizeNullableText(metadata?.sourceType) ?? null,
      title: this.normalizeNullableText(metadata?.title) ?? null,
      source: this.normalizeNullableText(metadata?.source) ?? null,
      description: this.normalizeNullableText(metadata?.description) ?? null,
      tags: this.normalizeAssetTags(metadata?.tags) ?? [],
    };
  }

  private buildAssetUpdateData(dto: UpdateMemberAssetDto): Prisma.MemberAssetUpdateInput {
    const data: Prisma.MemberAssetUpdateInput = {};

    if (dto.sourceType !== undefined) {
      data.sourceType = this.normalizeNullableText(dto.sourceType);
    }

    if (dto.title !== undefined) {
      data.title = this.normalizeNullableText(dto.title);
    }

    if (dto.source !== undefined) {
      data.source = this.normalizeNullableText(dto.source);
    }

    if (dto.description !== undefined) {
      data.description = this.normalizeNullableText(dto.description);
    }

    if (dto.tags !== undefined) {
      data.tags = {
        set: this.normalizeAssetTags(dto.tags) ?? [],
      };
    }

    return data;
  }

  private normalizeNullableText(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private deriveDefaultAssetTitle(originalName: string) {
    const normalized = originalName.trim();
    if (!normalized) {
      return '未命名资料';
    }

    return normalized.replace(/\.[^.]+$/, '').trim() || normalized;
  }

  private normalizeAssetTags(tags?: string[]) {
    if (tags === undefined) {
      return undefined;
    }

    return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).slice(0, 12);
  }

  private validateAssetFile(file: Express.Multer.File, category: MemberAssetCategory) {
    validateMemberAssetFile(file, category);
  }

  private assertNoImportCycles(
    rows: Array<{ rowNumber: number; code: string; fatherCode?: string; motherCode?: string }>,
  ) {
    const rowMap = new Map(rows.map((row) => [row.code, row]));
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const dfs = (code: string, path: string[]) => {
      if (visiting.has(code)) {
        throw new BadRequestException(
          `导入文件中的父母关系存在循环引用：${[...path, code].join(' -> ')}`,
        );
      }

      if (visited.has(code)) {
        return;
      }

      visiting.add(code);
      const row = rowMap.get(code);
      const parents = [row?.fatherCode, row?.motherCode].filter(Boolean) as string[];

      for (const parentCode of parents) {
        dfs(parentCode, [...path, code]);
      }

      visiting.delete(code);
      visited.add(code);
    };

    for (const row of rows) {
      dfs(row.code, []);
    }
  }

  private async getDescendantIds(memberId: string) {
    const members = await this.prisma.member.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        fatherId: true,
        motherId: true,
      },
    });

    const descendants = new Set<string>();
    const queue = [memberId];

    while (queue.length > 0) {
      const currentId = queue.shift();

      if (!currentId) {
        continue;
      }

      const children = members.filter(
        (member) => member.fatherId === currentId || member.motherId === currentId,
      );

      for (const child of children) {
        if (descendants.has(child.id)) {
          continue;
        }

        descendants.add(child.id);
        queue.push(child.id);
      }
    }

    return descendants;
  }

  private async ensureMarriageBelongsToMember(memberId: string, marriageId: string) {
    const marriage = await this.prisma.marriage.findFirst({
      where: {
        id: marriageId,
        OR: [{ memberId }, { spouseId: memberId }],
      },
    });

    if (!marriage) {
      throw new NotFoundException('未找到对应婚姻关系。');
    }

    return marriage;
  }

  private async invalidateDashboardCache() {
    await this.cacheManager.del(DASHBOARD_SUMMARY_CACHE_KEY);
  }

  private currentFamilyId() {
    return getTenantContext()?.familyId ?? undefined;
  }
}
