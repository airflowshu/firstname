import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { AuditAction, Gender, LifeStatus, MarriageStatus, Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { buildPairKey, buildPhotoUrl } from '../common/utils/family-tree.util';
import { DASHBOARD_SUMMARY_CACHE_KEY } from '../dashboard/dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateMarriageDto,
  CreateMemberDto,
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

    return {
      ...member,
      photoUrl: buildPhotoUrl(member.photoPath),
      children,
      siblings,
      marriages: marriages.map((marriage) => ({
        id: marriage.id,
        status: marriage.status,
        startDate: marriage.startDate,
        endDate: marriage.endDate,
        spouse: marriage.memberId === id ? marriage.spouse : marriage.member,
      })),
    };
  }

  async create(dto: CreateMemberDto, operatorId: string) {
    await this.ensureParentReferences(dto.fatherId, dto.motherId);

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

  async update(id: string, dto: UpdateMemberDto, operatorId: string) {
    const existingMember = await this.prisma.member.findUnique({ where: { id } });

    if (!existingMember) {
      throw new NotFoundException('未找到对应成员。');
    }

    await this.ensureParentReferences(dto.fatherId, dto.motherId, id);

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
