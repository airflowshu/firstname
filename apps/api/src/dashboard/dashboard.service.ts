import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { Gender, LifeStatus, MarriageStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const DASHBOARD_SUMMARY_CACHE_KEY = 'dashboard:summary';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getSummary(familyId?: string | null) {
    const cacheKey = `${DASHBOARD_SUMMARY_CACHE_KEY}:${familyId ?? 'platform'}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached;
    }

    const [
      totalMembers,
      maleMembers,
      femaleMembers,
      aliveMembers,
      deceasedMembers,
      generations,
      marriages,
    ] = await this.prisma.$transaction([
      this.prisma.member.count({ where: { isDeleted: false } }),
      this.prisma.member.count({
        where: { isDeleted: false, gender: Gender.MALE },
      }),
      this.prisma.member.count({
        where: { isDeleted: false, gender: Gender.FEMALE },
      }),
      this.prisma.member.count({
        where: { isDeleted: false, lifeStatus: LifeStatus.ALIVE },
      }),
      this.prisma.member.count({
        where: { isDeleted: false, lifeStatus: LifeStatus.DECEASED },
      }),
      this.prisma.member.findMany({
        where: {
          isDeleted: false,
          generationName: {
            not: null,
          },
        },
        distinct: ['generationName'],
        select: {
          generationName: true,
        },
      }),
      this.prisma.marriage.count({
        where: { isDeleted: false, status: MarriageStatus.ACTIVE },
      }),
    ]);

    const [recentMembers, recentLogs] = await this.prisma.$transaction([
      this.prisma.member.findMany({
        where: { isDeleted: false },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          createdAt: true,
          gender: true,
        },
      }),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          operator: {
            select: {
              id: true,
              username: true,
              role: true,
            },
          },
        },
      }),
    ]);

    const summary = {
      stats: {
        totalMembers,
        maleMembers,
        femaleMembers,
        aliveMembers,
        deceasedMembers,
        generationCount: generations.length,
        marriageCount: marriages,
      },
      recentMembers,
      recentLogs,
    };

    await this.cacheManager.set(cacheKey, summary, 60_000);

    return summary;
  }
}
