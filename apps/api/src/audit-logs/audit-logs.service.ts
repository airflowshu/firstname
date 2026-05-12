import { Injectable } from '@nestjs/common';
import { AuditAction, PlatformRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, pageSize = 10, keyword?: string) {
    const where: Prisma.AuditLogWhereInput = keyword
      ? {
          OR: [
            { targetType: { contains: keyword, mode: 'insensitive' } },
            { targetId: { contains: keyword, mode: 'insensitive' } },
            {
              operator: {
                is: {
                  OR: [
                    {
                      username: {
                        contains: keyword,
                        mode: 'insensitive',
                      },
                    },
                    {
                      displayName: {
                        contains: keyword,
                        mode: 'insensitive',
                      },
                    },
                  ],
                },
              },
            },
          ],
        }
      : {};

    const [total, data] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          operator: {
            select: {
              id: true,
              username: true,
              displayName: true,
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

  async log(params: {
    familyId?: string | null;
    operatorId?: string;
    action: AuditAction;
    targetType: string;
    targetId?: string;
    before?: unknown;
    after?: unknown;
    metadata?: unknown;
  }) {
    if (params.operatorId) {
      const operator = await this.prisma.user.findUnique({
        where: { id: params.operatorId },
        select: { platformRole: true },
      });

      if (operator?.platformRole === PlatformRole.SUPER) {
        return null;
      }
    }

    return this.prisma.auditLog.create({
      data: {
        familyId: params.familyId ?? undefined,
        operatorId: params.operatorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        before: this.normalizeJson(params.before),
        after: this.normalizeJson(params.after),
        metadata: this.normalizeJson(params.metadata),
      },
    });
  }

  private normalizeJson(value: unknown) {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(JSON.stringify(value));
  }
}
