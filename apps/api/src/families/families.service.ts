import { FamilyType } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FamiliesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlatformFamilies() {
    const families = await this.prisma.family.findMany({
      where: {
        familyType: {
          not: FamilyType.TEMPLATE,
        },
      },
      include: {
        _count: {
          select: {
            memberships: true,
            members: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return families
      .filter((family) => family.familyType !== FamilyType.TEMPLATE)
      .map((family) => ({
        id: family.id,
        name: family.name,
        status: family.status,
        familyType: family.familyType,
        resetTemplateKey: family.resetTemplateKey,
        canResetDemoData:
          family.familyType === FamilyType.DEMO && Boolean(family.resetTemplateKey),
        createdAt: family.createdAt,
        updatedAt: family.updatedAt,
        membershipCount: family._count.memberships,
        memberCount: family._count.members,
      }));
  }
}
