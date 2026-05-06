import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FamiliesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlatformFamilies() {
    const families = await this.prisma.family.findMany({
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

    return families.map((family) => ({
      id: family.id,
      name: family.name,
      status: family.status,
      createdAt: family.createdAt,
      updatedAt: family.updatedAt,
      membershipCount: family._count.memberships,
      memberCount: family._count.members,
    }));
  }
}
