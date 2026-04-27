import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FamilyMarriageSnapshot,
  FamilyMemberSnapshot,
  buildPhotoUrl,
  resolveSiblingToken,
  sharesParent,
  tokenToLabel,
} from '../common/utils/family-tree.util';

interface GraphNeighbor {
  memberId: string;
  label: string;
  type: string;
}

@Injectable()
export class GraphService {
  constructor(private readonly prisma: PrismaService) {}

  async getMemberGraph(centerId: string, depth = 2) {
    const [members, marriages] = await this.prisma.$transaction([
      this.prisma.member.findMany({
        where: { isDeleted: false },
        select: {
          id: true,
          name: true,
          gender: true,
          fatherId: true,
          motherId: true,
          birthDate: true,
          birthOrder: true,
          lifeStatus: true,
          generationName: true,
          photoPath: true,
        },
      }),
      this.prisma.marriage.findMany({
        where: { isDeleted: false },
        select: {
          id: true,
          memberId: true,
          spouseId: true,
          status: true,
          isDeleted: true,
        },
      }),
    ]);

    const memberMap = new Map<string, FamilyMemberSnapshot>(
      members.map((member) => [member.id, member]),
    );
    const center = memberMap.get(centerId);

    if (!center) {
      throw new NotFoundException('未找到图谱中心成员。');
    }

    const queue: Array<{ memberId: string; depth: number }> = [{ memberId: centerId, depth: 0 }];
    const visited = new Set<string>([centerId]);
    const nodes = new Map<string, Record<string, unknown>>();
    const edges = new Map<string, Record<string, unknown>>();

    while (queue.length > 0) {
      const current = queue.shift();

      if (!current) {
        continue;
      }

      const member = memberMap.get(current.memberId);

      if (!member) {
        continue;
      }

      nodes.set(member.id, {
        id: member.id,
        label: member.name,
        gender: member.gender,
        lifeStatus: member.lifeStatus,
        generationName: member.generationName,
        isCenter: member.id === centerId,
        photoUrl: buildPhotoUrl(member.photoPath),
      });

      if (current.depth >= depth) {
        continue;
      }

      for (const neighbor of this.getNeighbors(member, members, marriages)) {
        const neighborMember = memberMap.get(neighbor.memberId);

        if (!neighborMember) {
          continue;
        }

        const edgeKey = [member.id, neighbor.memberId].sort().join(':');
        if (!edges.has(edgeKey)) {
          edges.set(edgeKey, {
            id: edgeKey,
            source: member.id,
            target: neighbor.memberId,
            label: neighbor.label,
            type: neighbor.type,
          });
        }

        if (!visited.has(neighbor.memberId)) {
          visited.add(neighbor.memberId);
          queue.push({
            memberId: neighbor.memberId,
            depth: current.depth + 1,
          });
        }
      }
    }

    return {
      centerId,
      depth,
      nodes: Array.from(nodes.values()),
      edges: Array.from(edges.values()),
    };
  }

  private getNeighbors(
    member: FamilyMemberSnapshot,
    allMembers: FamilyMemberSnapshot[],
    marriages: FamilyMarriageSnapshot[],
  ): GraphNeighbor[] {
    const neighbors: GraphNeighbor[] = [];
    const memberMap = new Map(allMembers.map((item) => [item.id, item]));

    if (member.fatherId && memberMap.has(member.fatherId)) {
      neighbors.push({ memberId: member.fatherId, label: '父亲', type: 'parent' });
    }

    if (member.motherId && memberMap.has(member.motherId)) {
      neighbors.push({ memberId: member.motherId, label: '母亲', type: 'parent' });
    }

    const spouses = marriages
      .filter((marriage) => marriage.memberId === member.id || marriage.spouseId === member.id)
      .map((marriage) => (marriage.memberId === member.id ? marriage.spouseId : marriage.memberId));

    for (const spouseId of spouses) {
      neighbors.push({
        memberId: spouseId,
        label: '配偶',
        type: 'marriage',
      });
    }

    const children = allMembers.filter(
      (child) => child.fatherId === member.id || child.motherId === member.id,
    );

    for (const child of children) {
      neighbors.push({
        memberId: child.id,
        label: child.gender === 'MALE' ? '儿子' : child.gender === 'FEMALE' ? '女儿' : '子女',
        type: 'child',
      });
    }

    const siblings = allMembers.filter((candidate) => sharesParent(member, candidate));

    for (const sibling of siblings) {
      neighbors.push({
        memberId: sibling.id,
        label: tokenToLabel(resolveSiblingToken(member, sibling)),
        type: 'sibling',
      });
    }

    return neighbors;
  }
}
