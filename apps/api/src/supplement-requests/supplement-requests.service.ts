import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  MemberAssetCategory,
  Prisma,
  SupplementRequestStatus,
  SupplementRequestType,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { buildUploadUrl } from '../common/utils/family-tree.util';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMemberDto } from '../members/dto/member.dto';
import { MembersService } from '../members/members.service';
import {
  CreateSupplementAssetRequestDto,
  CreateSupplementRequestDto,
  ReviewSupplementRequestDto,
  SupplementRequestQueryDto,
} from './dto/supplement-request.dto';

@Injectable()
export class SupplementRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membersService: MembersService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async list(query: SupplementRequestQueryDto, user: AuthenticatedUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where: Prisma.SupplementRequestWhereInput = {
      status: query.status
        ? {
            equals: query.status,
          }
        : undefined,
      requestType: query.requestType
        ? {
            equals: query.requestType,
          }
        : undefined,
      requesterId: user.role === UserRole.ADMIN ? undefined : user.sub,
      OR: query.keyword
        ? [
            {
              member: {
                name: {
                  contains: query.keyword,
                  mode: 'insensitive',
                },
              },
            },
            {
              requester: {
                username: {
                  contains: query.keyword,
                  mode: 'insensitive',
                },
              },
            },
            {
              reason: {
                contains: query.keyword,
                mode: 'insensitive',
              },
            },
          ]
        : undefined,
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.supplementRequest.count({ where }),
      this.prisma.supplementRequest.findMany({
        where,
        include: {
          member: {
            select: { id: true, name: true, gender: true, nativePlace: true, generationName: true },
          },
          requester: {
            select: { id: true, username: true, role: true },
          },
          reviewer: {
            select: { id: true, username: true, role: true },
          },
          assets: true,
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      data: data.map((request) => this.serializeRequest(request)),
    };
  }

  async create(dto: CreateSupplementRequestDto, user: AuthenticatedUser) {
    if (user.role !== UserRole.VIEWER) {
      throw new ForbiddenException('管理员请直接编辑成员资料，无需提交补充申请。');
    }

    const member = await this.prisma.member.findFirst({
      where: { id: dto.memberId, isDeleted: false },
      select: {
        id: true,
        name: true,
        gender: true,
        birthDate: true,
        deathDate: true,
        lifeStatus: true,
        generationName: true,
        birthOrder: true,
        nativePlace: true,
        notes: true,
        fatherId: true,
        motherId: true,
      },
    });

    if (!member) {
      throw new NotFoundException('未找到对应成员，无法提交补充申请。');
    }

    const patch = this.buildNormalizedPatch(member, dto.patch as Record<string, unknown>);
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('没有检测到有效改动，请修改至少一个字段后再提交申请。');
    }

    await this.membersService.assertMemberConsistencyForPatch(dto.memberId, {
      ...patch,
      fatherId: member.fatherId ?? undefined,
      motherId: member.motherId ?? undefined,
    } as Partial<CreateMemberDto>);

    const created = await this.prisma.supplementRequest.create({
      data: {
        memberId: dto.memberId,
        requesterId: user.sub,
        requestType: SupplementRequestType.BASIC_INFO,
        reason: dto.reason,
        patch: patch as Prisma.InputJsonValue,
      },
      include: {
        member: {
          select: { id: true, name: true },
        },
      },
    });

    await this.auditLogsService.log({
      operatorId: user.sub,
      action: AuditAction.CREATE,
      targetType: 'SUPPLEMENT_REQUEST',
      targetId: created.id,
      after: {
        memberId: dto.memberId,
        patch,
        reason: dto.reason,
      },
    });

    return {
      ...created,
      assets: [],
    };
  }

  async createAssetRequest(
    dto: CreateSupplementAssetRequestDto,
    files: Express.Multer.File[],
    user: AuthenticatedUser,
  ) {
    if (user.role !== UserRole.VIEWER) {
      throw new ForbiddenException('管理员请直接维护成员资料，无需提交附件补充申请。');
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('请至少选择一个文件后再提交补充申请。');
    }

    const member = await this.prisma.member.findFirst({
      where: { id: dto.memberId, isDeleted: false },
      select: { id: true, name: true },
    });

    if (!member) {
      throw new NotFoundException('未找到对应成员，无法提交附件补充申请。');
    }

    const uploadRoot = resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');
    const directoryName =
      dto.category === MemberAssetCategory.PHOTO
        ? 'supplement-assets/photos'
        : 'supplement-assets/documents';
    const saveDirectory = resolve(uploadRoot, directoryName);
    await mkdir(saveDirectory, { recursive: true });

    const requestType =
      dto.category === MemberAssetCategory.PHOTO
        ? SupplementRequestType.PHOTO
        : SupplementRequestType.DOCUMENT;
    const normalizedAssetMetadata = this.normalizeAssetMetadata(dto);

    const created = await this.prisma.$transaction(async (tx) => {
      const request = await tx.supplementRequest.create({
        data: {
          memberId: dto.memberId,
          requesterId: user.sub,
          requestType,
          reason: dto.reason,
          patch: {} as Prisma.InputJsonValue,
        },
      });

      for (const file of files) {
        this.validateSupplementAssetFile(file, dto.category);

        const extension = extname(file.originalname || '') || '';
        const relativePath = `${directoryName}/${randomUUID()}${extension}`;
        const absolutePath = resolve(uploadRoot, relativePath);
        await writeFile(absolutePath, file.buffer);

        await tx.supplementRequestAsset.create({
          data: {
            requestId: request.id,
            category: dto.category,
            filePath: relativePath,
            originalName: file.originalname,
            title: normalizedAssetMetadata.title,
            sourceType: normalizedAssetMetadata.sourceType,
            source: normalizedAssetMetadata.source,
            description: normalizedAssetMetadata.description,
            tags: normalizedAssetMetadata.tags,
            mimeType: file.mimetype,
            sizeBytes: file.size,
          },
        });
      }

      return tx.supplementRequest.findUnique({
        where: { id: request.id },
        include: {
          member: {
            select: { id: true, name: true },
          },
          assets: true,
        },
      });
    });

    await this.auditLogsService.log({
      operatorId: user.sub,
      action: AuditAction.CREATE,
      targetType: 'SUPPLEMENT_REQUEST',
      targetId: created?.id,
      after: {
        memberId: dto.memberId,
        requestType,
        category: dto.category,
        count: files.length,
        reason: dto.reason,
        title: normalizedAssetMetadata.title,
        sourceType: normalizedAssetMetadata.sourceType,
        source: normalizedAssetMetadata.source,
        tags: normalizedAssetMetadata.tags,
        hasDescription: Boolean(normalizedAssetMetadata.description),
      },
    });

    return created ? this.serializeRequest(created) : created;
  }

  async review(id: string, dto: ReviewSupplementRequestDto, user: AuthenticatedUser) {
    const request = await this.prisma.supplementRequest.findUnique({
      where: { id },
      include: {
        member: true,
        assets: true,
      },
    });

    if (!request) {
      throw new NotFoundException('未找到对应补充申请。');
    }

    if (request.status !== SupplementRequestStatus.PENDING) {
      throw new BadRequestException('该补充申请已处理，不能重复审核。');
    }

    if (dto.action === 'APPROVE') {
      await this.membersService.assertMemberConsistencyForPatch(request.memberId, {
        ...(request.patch as Record<string, unknown>),
        fatherId: request.member.fatherId ?? undefined,
        motherId: request.member.motherId ?? undefined,
      } as Partial<CreateMemberDto>);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.action === 'APPROVE') {
        if (request.requestType === SupplementRequestType.BASIC_INFO) {
          const patch = request.patch as Prisma.MemberUpdateInput;
          await tx.member.update({
            where: { id: request.memberId },
            data: {
              ...patch,
              birthDate:
                typeof patch.birthDate === 'string'
                  ? new Date(patch.birthDate)
                  : patch.birthDate,
              deathDate:
                typeof patch.deathDate === 'string'
                  ? new Date(patch.deathDate)
                  : patch.deathDate,
            },
          });
        } else {
          for (const asset of request.assets) {
            await tx.memberAsset.create({
              data: {
                memberId: request.memberId,
                uploadedById: request.requesterId,
                category: asset.category,
                filePath: asset.filePath,
                originalName: asset.originalName,
                title: asset.title,
                sourceType: asset.sourceType,
                source: asset.source,
                description: asset.description,
                tags: asset.tags,
                mimeType: asset.mimeType,
                sizeBytes: asset.sizeBytes,
              },
            });
          }
        }
      }

      return tx.supplementRequest.update({
        where: { id },
        data: {
          status:
            dto.action === 'APPROVE'
              ? SupplementRequestStatus.APPROVED
              : SupplementRequestStatus.REJECTED,
          reviewerId: user.sub,
          reviewComment: dto.reviewComment,
          reviewedAt: new Date(),
        },
        include: {
          member: {
            select: { id: true, name: true },
          },
          requester: {
            select: { id: true, username: true, role: true },
          },
          reviewer: {
            select: { id: true, username: true, role: true },
          },
          assets: true,
        },
      });
    });

    await this.auditLogsService.log({
      operatorId: user.sub,
      action: AuditAction.UPDATE,
      targetType: 'SUPPLEMENT_REQUEST',
      targetId: id,
      metadata: {
        action: dto.action,
        memberId: request.memberId,
        reviewComment: dto.reviewComment,
      },
    });

    return this.serializeRequest(updated);
  }

  private serializeRequest<
    T extends {
      assets?: Array<{
        id: string;
        requestId: string;
        category: MemberAssetCategory;
        filePath: string;
        originalName: string;
        title: string | null;
        sourceType: string | null;
        source: string | null;
        description: string | null;
        tags: string[];
        mimeType: string;
        sizeBytes: number;
        createdAt: Date;
        updatedAt: Date;
      }>;
    },
  >(request: T) {
    return {
      ...request,
      assets:
        request.assets?.map((asset) => ({
          ...asset,
          fileUrl: buildUploadUrl(asset.filePath),
        })) ?? [],
    };
  }

  private validateSupplementAssetFile(
    file: Express.Multer.File,
    category: MemberAssetCategory,
  ) {
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

  private normalizeAssetMetadata(dto: CreateSupplementAssetRequestDto) {
    return {
      sourceType: this.normalizeNullableText(dto.sourceType) ?? null,
      title: this.normalizeNullableText(dto.title) ?? null,
      source: this.normalizeNullableText(dto.source) ?? null,
      description: this.normalizeNullableText(dto.description) ?? null,
      tags: this.normalizeAssetTags(dto.tags) ?? [],
    };
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

  private normalizeAssetTags(tags?: string[]) {
    if (tags === undefined) {
      return undefined;
    }

    return Array.from(
      new Set(
        tags
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    ).slice(0, 12);
  }

  private buildNormalizedPatch(
    member: {
      name: string;
      gender: string;
      birthDate: Date | null;
      deathDate: Date | null;
      lifeStatus: string;
      generationName: string | null;
      birthOrder: number | null;
      nativePlace: string | null;
      notes: string | null;
    },
    patch: Record<string, unknown>,
  ) {
    const normalizedPatch: Record<string, unknown> = {};

    const normalizeDate = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
    const normalizeString = (value: unknown) =>
      typeof value === 'string' ? value.trim() || undefined : undefined;
    const normalizeNumber = (value: unknown) =>
      typeof value === 'number' && Number.isFinite(value) ? value : undefined;

    const candidateValues = {
      name: normalizeString(patch.name),
      gender: typeof patch.gender === 'string' ? patch.gender : undefined,
      birthDate: normalizeDate(patch.birthDate),
      deathDate: normalizeDate(patch.deathDate),
      lifeStatus: typeof patch.lifeStatus === 'string' ? patch.lifeStatus : undefined,
      generationName: normalizeString(patch.generationName),
      birthOrder: normalizeNumber(patch.birthOrder),
      nativePlace: normalizeString(patch.nativePlace),
      notes: normalizeString(patch.notes),
    };

    if (candidateValues.name && candidateValues.name !== member.name) normalizedPatch.name = candidateValues.name;
    if (candidateValues.gender && candidateValues.gender !== member.gender) normalizedPatch.gender = candidateValues.gender;

    const memberBirthDate = member.birthDate?.toISOString().slice(0, 10);
    const memberDeathDate = member.deathDate?.toISOString().slice(0, 10);

    if (candidateValues.birthDate && candidateValues.birthDate !== memberBirthDate) {
      normalizedPatch.birthDate = candidateValues.birthDate;
    }

    if (candidateValues.deathDate && candidateValues.deathDate !== memberDeathDate) {
      normalizedPatch.deathDate = candidateValues.deathDate;
    }

    if (candidateValues.lifeStatus && candidateValues.lifeStatus !== member.lifeStatus) {
      normalizedPatch.lifeStatus = candidateValues.lifeStatus;
    }

    if (
      candidateValues.generationName &&
      candidateValues.generationName !== (member.generationName ?? undefined)
    ) {
      normalizedPatch.generationName = candidateValues.generationName;
    }

    if (
      candidateValues.birthOrder !== undefined &&
      candidateValues.birthOrder !== (member.birthOrder ?? undefined)
    ) {
      normalizedPatch.birthOrder = candidateValues.birthOrder;
    }

    if (
      candidateValues.nativePlace &&
      candidateValues.nativePlace !== (member.nativePlace ?? undefined)
    ) {
      normalizedPatch.nativePlace = candidateValues.nativePlace;
    }

    if (candidateValues.notes && candidateValues.notes !== (member.notes ?? undefined)) {
      normalizedPatch.notes = candidateValues.notes;
    }

    return normalizedPatch;
  }
}
