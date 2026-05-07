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
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { getTenantContext } from '../common/tenant/tenant-context';
import { validateMemberAssetFile } from '../common/utils/asset-file.util';
import { buildFileChecksum, buildUploadUrl } from '../common/utils/family-tree.util';
import { MembersService } from '../members/members.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAssetMetadataChangeRequestDto,
  CreateEventChangeRequestDto,
  CreateMarriageChangeRequestDto,
  CreateMemberCreateRequestDto,
  CreateMemberDeleteRequestDto,
  CreateMemberImportRequestDto,
  CreateMemberPhotoRequestDto,
  CreateMemberUpdateRequestDto,
  CreateQuickRelativeRequestDto,
  CreateSupplementAssetRequestDto,
  CreateSupplementRequestDto,
  ReviewSupplementRequestDto,
  SupplementRequestQueryDto,
} from './dto/supplement-request.dto';

type RequestWithAssets = Prisma.SupplementRequestGetPayload<{
  include: { assets: true };
}>;

type JsonRecord = Record<string, unknown>;

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
      status: query.status ? { equals: query.status } : undefined,
      requestType: query.requestType ? { equals: query.requestType } : undefined,
      requesterId: user.role === UserRole.ADMIN ? undefined : user.sub,
      OR: query.keyword
        ? [
            { member: { name: { contains: query.keyword, mode: 'insensitive' } } },
            { requester: { username: { contains: query.keyword, mode: 'insensitive' } } },
            { reason: { contains: query.keyword, mode: 'insensitive' } },
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
          requester: { select: { id: true, username: true, role: true } },
          reviewer: { select: { id: true, username: true, role: true } },
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
    return this.createMemberUpdateRequest(
      {
        memberId: dto.memberId,
        patch: dto.patch,
        reason: dto.reason,
      },
      user,
    );
  }

  async createMemberCreateRequest(dto: CreateMemberCreateRequestDto, user: AuthenticatedUser) {
    this.assertCanSubmitRequest(user);

    return this.createRequest({
      user,
      requestType: SupplementRequestType.MEMBER_CREATE,
      patch: dto.member,
      payload: { member: dto.member },
      afterSnapshot: dto.member,
      reason: dto.reason,
    });
  }

  async createMemberUpdateRequest(dto: CreateMemberUpdateRequestDto, user: AuthenticatedUser) {
    this.assertCanSubmitRequest(user);
    const beforeSnapshot = await this.getMemberSnapshot(dto.memberId);
    if (!beforeSnapshot) {
      throw new NotFoundException('未找到对应成员，无法提交变更申请。');
    }

    await this.membersService.assertMemberConsistencyForPatch(dto.memberId, {
      ...dto.patch,
      fatherId: dto.patch.fatherId ?? (beforeSnapshot.fatherId as string),
      motherId: dto.patch.motherId ?? (beforeSnapshot.motherId as string),
    });

    const patch = this.removeUnchangedValues(beforeSnapshot, dto.patch as JsonRecord);
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('没有检测到有效改动，请修改至少一个字段后再提交申请。');
    }

    return this.createRequest({
      user,
      memberId: dto.memberId,
      requestType: SupplementRequestType.MEMBER_UPDATE,
      patch,
      payload: { memberId: dto.memberId, patch },
      beforeSnapshot,
      afterSnapshot: { ...beforeSnapshot, ...patch },
      reason: dto.reason,
    });
  }

  async createMemberDeleteRequest(dto: CreateMemberDeleteRequestDto, user: AuthenticatedUser) {
    this.assertCanSubmitRequest(user);
    const beforeSnapshot = await this.getMemberSnapshot(dto.memberId);
    if (!beforeSnapshot) {
      throw new NotFoundException('未找到对应成员，无法提交删除申请。');
    }

    return this.createRequest({
      user,
      memberId: dto.memberId,
      requestType: SupplementRequestType.MEMBER_DELETE,
      patch: { isDeleted: true },
      payload: { memberId: dto.memberId },
      beforeSnapshot,
      afterSnapshot: { ...beforeSnapshot, isDeleted: true },
      reason: dto.reason,
    });
  }

  async createMemberRestoreRequest(dto: CreateMemberDeleteRequestDto, user: AuthenticatedUser) {
    this.assertCanSubmitRequest(user);
    const beforeSnapshot = await this.getMemberSnapshot(dto.memberId, true);
    if (!beforeSnapshot) {
      throw new NotFoundException('未找到对应成员，无法提交恢复申请。');
    }

    return this.createRequest({
      user,
      memberId: dto.memberId,
      requestType: SupplementRequestType.MEMBER_RESTORE,
      patch: { isDeleted: false },
      payload: { memberId: dto.memberId },
      beforeSnapshot,
      afterSnapshot: { ...beforeSnapshot, isDeleted: false },
      reason: dto.reason,
    });
  }

  async createQuickRelativeRequest(dto: CreateQuickRelativeRequestDto, user: AuthenticatedUser) {
    this.assertCanSubmitRequest(user);
    const beforeSnapshot = await this.getMemberSnapshot(dto.memberId);
    if (!beforeSnapshot) {
      throw new NotFoundException('未找到当前锚点成员，无法提交亲属关系申请。');
    }

    return this.createRequest({
      user,
      memberId: dto.memberId,
      requestType: SupplementRequestType.QUICK_RELATIVE,
      patch: dto.request,
      payload: { anchorId: dto.memberId, request: dto.request },
      beforeSnapshot,
      afterSnapshot: {
        operation: 'QUICK_RELATIVE',
        anchor: beforeSnapshot,
        request: dto.request,
      },
      reason: dto.reason,
    });
  }

  async createMarriageChangeRequest(dto: CreateMarriageChangeRequestDto, user: AuthenticatedUser) {
    this.assertCanSubmitRequest(user);
    const beforeSnapshot =
      dto.action === 'CREATE'
        ? await this.getMemberSnapshot(dto.memberId)
        : await this.getMarriageSnapshot(dto.memberId, dto.marriageId);
    if (!beforeSnapshot) {
      throw new NotFoundException('未找到对应成员或婚姻关系，无法提交婚姻变更申请。');
    }

    const requestType = {
      CREATE: SupplementRequestType.MARRIAGE_CREATE,
      UPDATE: SupplementRequestType.MARRIAGE_UPDATE,
      DELETE: SupplementRequestType.MARRIAGE_DELETE,
      RESTORE: SupplementRequestType.MARRIAGE_RESTORE,
    }[dto.action];
    const patch = (dto.action === 'CREATE' ? dto.create : dto.update) ?? {};

    return this.createRequest({
      user,
      memberId: dto.memberId,
      requestType,
      patch,
      payload: {
        memberId: dto.memberId,
        marriageId: dto.marriageId,
        dto: patch,
      },
      beforeSnapshot,
      afterSnapshot: { operation: dto.action, ...patch },
      reason: dto.reason,
    });
  }

  async createMemberPhotoRequest(
    dto: CreateMemberPhotoRequestDto,
    file: Express.Multer.File,
    user: AuthenticatedUser,
  ) {
    this.assertCanSubmitRequest(user);
    if (!file) {
      throw new BadRequestException('请先选择要上传的头像文件。');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('仅支持上传图片格式文件。');
    }

    const beforeSnapshot = await this.getMemberSnapshot(dto.memberId);
    if (!beforeSnapshot) {
      throw new NotFoundException('未找到对应成员，无法提交头像变更申请。');
    }
    const savedFile = await this.saveRequestFile(file, 'supplement-assets/member-photos');

    return this.createRequest({
      user,
      memberId: dto.memberId,
      requestType: SupplementRequestType.MEMBER_PHOTO,
      patch: { originalName: file.originalname },
      payload: savedFile,
      beforeSnapshot,
      afterSnapshot: { photoPath: savedFile.filePath, originalName: file.originalname },
      reason: dto.reason,
    });
  }

  async createAssetRequest(
    dto: CreateSupplementAssetRequestDto,
    files: Express.Multer.File[],
    user: AuthenticatedUser,
  ) {
    this.assertCanSubmitRequest(user);
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

    const requestType =
      dto.category === MemberAssetCategory.PHOTO
        ? SupplementRequestType.PHOTO
        : SupplementRequestType.DOCUMENT;
    const normalizedAssetMetadata = this.normalizeAssetMetadata(dto);
    const familyId = this.currentFamilyId();
    const directoryName =
      dto.category === MemberAssetCategory.PHOTO
        ? 'supplement-assets/photos'
        : 'supplement-assets/documents';

    const created = await this.prisma.$transaction(async (tx) => {
      const request = await tx.supplementRequest.create({
        data: {
          familyId,
          memberId: dto.memberId,
          requesterId: user.sub,
          requestType,
          reason: dto.reason,
          patch: {},
          beforeSnapshot: (await this.getMemberSnapshot(dto.memberId)) as Prisma.InputJsonValue,
          afterSnapshot: {
            category: dto.category,
            count: files.length,
            ...normalizedAssetMetadata,
          },
          payload: {
            category: dto.category,
            count: files.length,
            ...normalizedAssetMetadata,
          },
        },
      });

      for (const file of files) {
        this.validateSupplementAssetFile(file, dto.category);
        const savedFile = await this.saveRequestFile(file, directoryName);
        await tx.supplementRequestAsset.create({
          data: {
            familyId,
            requestId: request.id,
            category: dto.category,
            filePath: savedFile.filePath,
            originalName: savedFile.originalName,
            checksum: savedFile.checksum,
            title: normalizedAssetMetadata.title,
            sourceType: normalizedAssetMetadata.sourceType,
            source: normalizedAssetMetadata.source,
            description: normalizedAssetMetadata.description,
            tags: normalizedAssetMetadata.tags,
            mimeType: savedFile.mimeType,
            sizeBytes: savedFile.sizeBytes,
          },
        });
      }

      return tx.supplementRequest.findUnique({
        where: { id: request.id },
        include: { member: { select: { id: true, name: true } }, assets: true },
      });
    });

    await this.logRequestCreated(user, created?.id, {
      memberId: dto.memberId,
      requestType,
      count: files.length,
    });

    return created ? this.serializeRequest(created) : created;
  }

  async createAssetMetadataChangeRequest(
    dto: CreateAssetMetadataChangeRequestDto,
    user: AuthenticatedUser,
  ) {
    this.assertCanSubmitRequest(user);
    const beforeSnapshot = await this.getAssetSnapshot(dto.memberId, dto.assetId);
    if (!beforeSnapshot) {
      throw new NotFoundException('未找到对应资源文件，无法提交资料变更申请。');
    }
    if (dto.action === 'UPDATE' && (!dto.patch || Object.keys(dto.patch).length === 0)) {
      throw new BadRequestException('请填写要变更的资料信息。');
    }

    return this.createRequest({
      user,
      memberId: dto.memberId,
      requestType:
        dto.action === 'UPDATE'
          ? SupplementRequestType.ASSET_UPDATE
          : SupplementRequestType.ASSET_DELETE,
      patch: dto.patch ?? { isDeleted: true },
      payload: { memberId: dto.memberId, assetId: dto.assetId, patch: dto.patch },
      beforeSnapshot,
      afterSnapshot:
        dto.action === 'UPDATE' ? { ...beforeSnapshot, ...dto.patch } : { isDeleted: true },
      reason: dto.reason,
    });
  }

  async createEventChangeRequest(dto: CreateEventChangeRequestDto, user: AuthenticatedUser) {
    this.assertCanSubmitRequest(user);
    const beforeSnapshot =
      dto.action === 'DELETE'
        ? await this.getEventSnapshot(dto.memberId, dto.eventId)
        : await this.getMemberSnapshot(dto.memberId);
    if (!beforeSnapshot) {
      throw new NotFoundException('未找到对应成员或事件，无法提交时间线变更申请。');
    }
    if (dto.action === 'CREATE' && !dto.event) {
      throw new BadRequestException('请填写要新增的时间线事件。');
    }

    return this.createRequest({
      user,
      memberId: dto.memberId,
      requestType:
        dto.action === 'CREATE'
          ? SupplementRequestType.EVENT_CREATE
          : SupplementRequestType.EVENT_DELETE,
      patch: dto.event ?? { eventId: dto.eventId },
      payload: { memberId: dto.memberId, eventId: dto.eventId, event: dto.event },
      beforeSnapshot,
      afterSnapshot: dto.action === 'CREATE' ? dto.event : { isDeleted: true },
      reason: dto.reason,
    });
  }

  async createImportRequest(
    dto: CreateMemberImportRequestDto,
    file: Express.Multer.File,
    user: AuthenticatedUser,
  ) {
    this.assertCanSubmitRequest(user);
    if (!file) {
      throw new BadRequestException('请先上传要导入的 Excel 文件。');
    }
    const savedFile = await this.saveRequestFile(file, 'supplement-assets/imports');

    return this.createRequest({
      user,
      requestType: SupplementRequestType.MEMBER_IMPORT,
      patch: { originalName: file.originalname },
      payload: savedFile,
      afterSnapshot: { originalName: file.originalname, sizeBytes: file.size },
      reason: dto.reason,
    });
  }

  async review(id: string, dto: ReviewSupplementRequestDto, user: AuthenticatedUser) {
    const request = await this.prisma.supplementRequest.findUnique({
      where: { id },
      include: { assets: true },
    });

    if (!request) {
      throw new NotFoundException('未找到对应变更申请。');
    }
    if (request.status !== SupplementRequestStatus.PENDING) {
      throw new BadRequestException('该变更申请已处理，不能重复审核。');
    }

    if (dto.action === 'APPROVE') {
      await this.assertOfficialDataUnchanged(request);
      await this.applyApprovedRequest(request, user);
    }

    const updated = await this.prisma.supplementRequest.update({
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
          select: { id: true, name: true, gender: true, nativePlace: true, generationName: true },
        },
        requester: { select: { id: true, username: true, role: true } },
        reviewer: { select: { id: true, username: true, role: true } },
        assets: true,
      },
    });

    await this.auditLogsService.log({
      operatorId: user.sub,
      action: AuditAction.UPDATE,
      targetType: 'SUPPLEMENT_REQUEST',
      targetId: id,
      metadata: {
        action: dto.action,
        requestType: request.requestType,
        memberId: request.memberId,
        reviewComment: dto.reviewComment,
      },
    });

    return this.serializeRequest(updated);
  }

  private async applyApprovedRequest(request: RequestWithAssets, user: AuthenticatedUser) {
    const payload = (request.payload ?? {}) as JsonRecord;
    const patch = (request.patch ?? {}) as JsonRecord;

    switch (request.requestType) {
      case SupplementRequestType.BASIC_INFO:
      case SupplementRequestType.MEMBER_UPDATE:
        await this.membersService.update(request.memberId!, patch, user.sub);
        return;
      case SupplementRequestType.MEMBER_CREATE:
        await this.membersService.create(payload.member as never, user.sub);
        return;
      case SupplementRequestType.MEMBER_DELETE:
        await this.membersService.remove(request.memberId!, user.sub);
        return;
      case SupplementRequestType.MEMBER_RESTORE:
        await this.membersService.restore(request.memberId!, user.sub);
        return;
      case SupplementRequestType.QUICK_RELATIVE:
        await this.membersService.createQuickRelative(
          payload.anchorId as string,
          payload.request as never,
          user.sub,
        );
        return;
      case SupplementRequestType.MARRIAGE_CREATE:
        await this.membersService.createMarriage(request.memberId!, payload.dto as never, user.sub);
        return;
      case SupplementRequestType.MARRIAGE_UPDATE:
        await this.membersService.updateMarriage(
          request.memberId!,
          payload.marriageId as string,
          payload.dto as never,
          user.sub,
        );
        return;
      case SupplementRequestType.MARRIAGE_DELETE:
        await this.membersService.removeMarriage(
          request.memberId!,
          payload.marriageId as string,
          user.sub,
        );
        return;
      case SupplementRequestType.MARRIAGE_RESTORE:
        await this.membersService.restoreMarriage(
          request.memberId!,
          payload.marriageId as string,
          user.sub,
        );
        return;
      case SupplementRequestType.PHOTO:
      case SupplementRequestType.DOCUMENT:
        await this.approveAssetCreation(request);
        return;
      case SupplementRequestType.MEMBER_PHOTO:
        await this.approveMemberPhoto(request, user);
        return;
      case SupplementRequestType.ASSET_UPDATE:
        await this.membersService.updateAsset(
          request.memberId!,
          payload.assetId as string,
          patch,
          user.sub,
        );
        return;
      case SupplementRequestType.ASSET_DELETE:
        await this.membersService.removeAsset(
          request.memberId!,
          payload.assetId as string,
          user.sub,
        );
        return;
      case SupplementRequestType.EVENT_CREATE:
        await this.membersService.createEvent(request.memberId!, payload.event as never, user.sub);
        return;
      case SupplementRequestType.EVENT_DELETE:
        await this.membersService.removeEvent(
          request.memberId!,
          payload.eventId as string,
          user.sub,
        );
        return;
      case SupplementRequestType.MEMBER_IMPORT:
        await this.approveMemberImport(request, user);
        return;
      default:
        throw new BadRequestException('暂不支持审核该类型的变更申请。');
    }
  }

  private async approveAssetCreation(request: RequestWithAssets) {
    for (const asset of request.assets) {
      await this.prisma.memberAsset.create({
        data: {
          familyId: request.familyId,
          memberId: request.memberId!,
          uploadedById: request.requesterId,
          category: asset.category,
          filePath: asset.filePath,
          originalName: asset.originalName,
          checksum: asset.checksum,
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

  private async approveMemberPhoto(request: RequestWithAssets, user: AuthenticatedUser) {
    const payload = request.payload as JsonRecord;
    const buffer = await readFile(
      resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads', payload.filePath as string),
    );
    await this.membersService.uploadPhoto(
      request.memberId!,
      {
        buffer,
        originalname: payload.originalName as string,
        mimetype: payload.mimeType as string,
        size: payload.sizeBytes as number,
      } as Express.Multer.File,
      user.sub,
    );
  }

  private async approveMemberImport(request: RequestWithAssets, user: AuthenticatedUser) {
    const payload = request.payload as JsonRecord;
    const buffer = await readFile(
      resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads', payload.filePath as string),
    );
    await this.membersService.importMembers(
      {
        buffer,
        originalname: payload.originalName as string,
        mimetype: payload.mimeType as string,
        size: payload.sizeBytes as number,
      } as Express.Multer.File,
      user.sub,
    );
  }

  private async assertOfficialDataUnchanged(request: RequestWithAssets) {
    const before = request.beforeSnapshot;
    if (!before) {
      return;
    }

    const current =
      request.requestType === SupplementRequestType.MARRIAGE_UPDATE ||
      request.requestType === SupplementRequestType.MARRIAGE_DELETE ||
      request.requestType === SupplementRequestType.MARRIAGE_RESTORE
        ? await this.getMarriageSnapshot(
            request.memberId!,
            (request.payload as JsonRecord)?.marriageId,
          )
        : request.requestType === SupplementRequestType.ASSET_UPDATE ||
            request.requestType === SupplementRequestType.ASSET_DELETE
          ? await this.getAssetSnapshot(request.memberId!, (request.payload as JsonRecord)?.assetId)
          : request.requestType === SupplementRequestType.EVENT_DELETE
            ? await this.getEventSnapshot(
                request.memberId!,
                (request.payload as JsonRecord)?.eventId,
              )
            : request.memberId
              ? await this.getMemberSnapshot(request.memberId, true)
              : null;

    if (current && !this.isSnapshotEqual(current, before)) {
      throw new BadRequestException('正式数据已变化，请重新核对后再审核。');
    }
  }

  private async createRequest(params: {
    user: AuthenticatedUser;
    memberId?: string;
    requestType: SupplementRequestType;
    patch: unknown;
    payload?: unknown;
    beforeSnapshot?: unknown;
    afterSnapshot?: unknown;
    reason?: string;
  }) {
    const created = await this.prisma.supplementRequest.create({
      data: {
        familyId: this.currentFamilyId(),
        memberId: params.memberId,
        requesterId: params.user.sub,
        requestType: params.requestType,
        reason: params.reason,
        patch: this.toJsonRequired(params.patch),
        payload: this.toJson(params.payload),
        beforeSnapshot: this.toJson(params.beforeSnapshot),
        afterSnapshot: this.toJson(params.afterSnapshot),
      },
      include: {
        member: {
          select: { id: true, name: true, gender: true, nativePlace: true, generationName: true },
        },
        requester: { select: { id: true, username: true, role: true } },
        reviewer: { select: { id: true, username: true, role: true } },
        assets: true,
      },
    });

    await this.logRequestCreated(params.user, created.id, {
      memberId: params.memberId,
      requestType: params.requestType,
      reason: params.reason,
    });

    return this.serializeRequest(created as typeof created & { assets?: [] });
  }

  private assertCanSubmitRequest(user: AuthenticatedUser) {
    if (user.role !== UserRole.VIEWER) {
      throw new ForbiddenException('管理员请直接维护成员数据，无需提交变更申请。');
    }
  }

  private async logRequestCreated(user: AuthenticatedUser, id: string | undefined, after: unknown) {
    await this.auditLogsService.log({
      operatorId: user.sub,
      action: AuditAction.CREATE,
      targetType: 'SUPPLEMENT_REQUEST',
      targetId: id,
      after,
    });
  }

  private async getMemberSnapshot(memberId?: unknown, includeDeleted = false) {
    if (typeof memberId !== 'string' || !memberId) {
      return null;
    }
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, isDeleted: includeDeleted ? undefined : false },
      include: {
        father: { select: { id: true, name: true } },
        mother: { select: { id: true, name: true } },
      },
    });
    return member ? this.normalizeSnapshot(member) : null;
  }

  private async getMarriageSnapshot(memberId?: unknown, marriageId?: unknown) {
    if (typeof memberId !== 'string' || typeof marriageId !== 'string') {
      return null;
    }
    const marriage = await this.prisma.marriage.findFirst({
      where: { id: marriageId, OR: [{ memberId }, { spouseId: memberId }] },
      include: {
        member: { select: { id: true, name: true } },
        spouse: { select: { id: true, name: true } },
      },
    });
    return marriage ? this.normalizeSnapshot(marriage) : null;
  }

  private async getAssetSnapshot(memberId?: unknown, assetId?: unknown) {
    if (typeof memberId !== 'string' || typeof assetId !== 'string') {
      return null;
    }
    const asset = await this.prisma.memberAsset.findFirst({
      where: { id: assetId, memberId, isDeleted: false },
    });
    return asset ? this.normalizeSnapshot(asset) : null;
  }

  private async getEventSnapshot(memberId?: unknown, eventId?: unknown) {
    if (typeof memberId !== 'string' || typeof eventId !== 'string') {
      return null;
    }
    const event = await this.prisma.memberEvent.findFirst({
      where: { id: eventId, memberId, isDeleted: false },
    });
    return event ? this.normalizeSnapshot(event) : null;
  }

  private removeUnchangedValues(beforeSnapshot: JsonRecord, patch: JsonRecord) {
    const normalizedPatch: JsonRecord = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) {
        continue;
      }
      const beforeValue = beforeSnapshot[key];
      const normalizedBefore =
        beforeValue instanceof Date ? beforeValue.toISOString().slice(0, 10) : beforeValue;
      if (JSON.stringify(value ?? null) !== JSON.stringify(normalizedBefore ?? null)) {
        normalizedPatch[key] = value;
      }
    }
    return normalizedPatch;
  }

  private async saveRequestFile(file: Express.Multer.File, directoryName: string) {
    const uploadRoot = resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');
    const saveDirectory = resolve(uploadRoot, directoryName);
    await mkdir(saveDirectory, { recursive: true });

    const extension = extname(file.originalname || '') || '';
    const relativePath = `${directoryName}/${randomUUID()}${extension}`;
    await writeFile(resolve(uploadRoot, relativePath), file.buffer);

    return {
      filePath: relativePath,
      originalName: file.originalname,
      checksum: buildFileChecksum(file.buffer),
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }

  private serializeRequest<
    T extends Record<string, unknown> & {
      assets?: Array<{
        id: string;
        requestId: string;
        category: MemberAssetCategory;
        filePath: string;
        originalName: string;
        checksum: string | null;
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

  private validateSupplementAssetFile(file: Express.Multer.File, category: MemberAssetCategory) {
    validateMemberAssetFile(file, category);
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
    return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).slice(0, 12);
  }

  private currentFamilyId() {
    return getTenantContext()?.familyId ?? undefined;
  }

  private normalizeSnapshot(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as JsonRecord;
  }

  private isSnapshotEqual(left: unknown, right: unknown) {
    return (
      JSON.stringify(this.stabilizeSnapshot(left)) === JSON.stringify(this.stabilizeSnapshot(right))
    );
  }

  private stabilizeSnapshot(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.stabilizeSnapshot(item));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, itemValue]) => itemValue !== undefined)
          .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
          .map(([key, itemValue]) => [key, this.stabilizeSnapshot(itemValue)]),
      );
    }
    return value;
  }

  private toJson(value: unknown) {
    if (value === undefined) {
      return undefined;
    }
    return this.normalizeSnapshot(value) as Prisma.InputJsonValue;
  }

  private toJsonRequired(value: unknown) {
    return this.toJson(value) ?? {};
  }
}
