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
  type Member,
} from '@prisma/client';
import ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { buildPairKey, buildPhotoUrl, buildUploadUrl } from '../common/utils/family-tree.util';
import { DASHBOARD_SUMMARY_CACHE_KEY } from '../dashboard/dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateMarriageDto,
  CreateMemberDto,
  CreateMemberEventDto,
  CreateQuickRelativeDto,
  MemberDuplicateCheckDto,
  MemberQueryDto,
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

    const targetBirthDate = dto.birthDate ? new Date(dto.birthDate).toISOString().slice(0, 10) : null;
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

  async listAssets(memberId: string, category?: MemberAssetCategory) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, isDeleted: false },
      select: { id: true },
    });

    if (!member) {
      throw new NotFoundException('未找到对应成员。');
    }

    const assets = await this.prisma.memberAsset.findMany({
      where: {
        memberId,
        isDeleted: false,
        category,
      },
      include: {
        uploadedBy: {
          select: { id: true, username: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return assets.map((asset) => ({
      ...asset,
      fileUrl: buildUploadUrl(asset.filePath),
    }));
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

      if (anchorMember.gender === Gender.FEMALE && !preparedMemberData.fatherId && onlyActiveSpouse) {
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

    const createdRelative = await this.prisma.$transaction(async (tx) => {
      const created = await tx.member.create({
        data: {
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
    const { father, mother } = await this.ensureParentReferences(nextFatherId, nextMotherId, memberId);

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
    const directoryName = category === MemberAssetCategory.PHOTO ? 'member-assets/photos' : 'member-assets/documents';
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

      const created = await this.prisma.memberAsset.create({
        data: {
          memberId,
          uploadedById: operatorId,
          category,
          filePath: relativePath,
          originalName: file.originalname,
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
      },
    });

    return createdAssets;
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
        throw new BadRequestException(`第 ${rowNumber} 行编号 ${code} 重复，请保持文件内编号唯一。`);
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
        throw new BadRequestException(
          `第 ${row.rowNumber} 行父亲编号与母亲编号不能相同。`,
        );
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

    const createdCount = await this.prisma.$transaction(async (tx) => {
      const createdMap = new Map<string, { id: string; row: ImportRow }>();

      for (const row of rows) {
        const created = await tx.member.create({
          data: {
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
                  birthDate: fatherRecord.row.birthDate ? new Date(fatherRecord.row.birthDate) : null,
                } as Member)
              : null,
            mother: motherRecord
              ? ({
                  id: motherRecord.id,
                  gender: motherRecord.row.gender,
                  birthDate: motherRecord.row.birthDate ? new Date(motherRecord.row.birthDate) : null,
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
    dto: Partial<CreateMemberDto> & {
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

    if (birthDate && options.father?.birthDate && birthDate.getTime() <= options.father.birthDate.getTime()) {
      errors.push('成员出生日期必须晚于父亲的出生日期。');
    }

    if (birthDate && options.mother?.birthDate && birthDate.getTime() <= options.mother.birthDate.getTime()) {
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

    return String(value).trim();
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

  private validateAssetFile(file: Express.Multer.File, category: MemberAssetCategory) {
    if (category === MemberAssetCategory.PHOTO) {
      if (!file.mimetype.startsWith('image/')) {
        throw new BadRequestException(`文件 ${file.originalname} 不是合法的图片类型。`);
      }

      return;
    }

    const allowedDocumentMimeTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'application/zip',
      'application/x-zip-compressed',
    ]);

    if (!allowedDocumentMimeTypes.has(file.mimetype)) {
      throw new BadRequestException(`文件 ${file.originalname} 不是支持的附件类型。`);
    }
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
}
