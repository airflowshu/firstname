import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Gender } from '@prisma/client';
import relationship from 'relationship.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  FamilyMarriageSnapshot,
  FamilyMemberSnapshot,
  resolveSiblingToken,
  sharesParent,
  toSexValue,
  tokensToChainText,
} from '../common/utils/family-tree.util';
import { PrismaService } from '../prisma/prisma.service';
import { MemberToMemberDto, PathCalcDto, UpsertKinshipAliasDto } from './dto/kinship.dto';

export interface KinshipResolution {
  relationCode: string;
  chainText: string;
  candidates: string[];
  standardTerm: string;
  familyAlias: string | null;
  displayTerm: string;
  ambiguous: boolean;
  pathIds?: string[];
}

@Injectable()
export class KinshipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async listAliases() {
    return this.prisma.kinshipAlias.findMany({
      orderBy: [{ enabled: 'desc' }, { relationCode: 'asc' }],
    });
  }

  async createAlias(dto: UpsertKinshipAliasDto, operatorId: string) {
    const existing = await this.prisma.kinshipAlias.findUnique({
      where: { relationCode: dto.relationCode },
    });

    if (existing) {
      throw new ConflictException('该关系编码已存在，请直接编辑现有别名。');
    }

    const alias = await this.prisma.kinshipAlias.create({
      data: {
        relationCode: dto.relationCode,
        standardTerm: dto.standardTerm,
        familyAlias: dto.familyAlias,
        enabled: dto.enabled ?? true,
      },
    });

    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.CREATE,
      targetType: 'KINSHIP_ALIAS',
      targetId: alias.id,
      after: alias,
    });

    return alias;
  }

  async updateAlias(id: string, dto: UpsertKinshipAliasDto, operatorId: string) {
    const existing = await this.prisma.kinshipAlias.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('未找到对应的家族称呼别名。');
    }

    const updated = await this.prisma.kinshipAlias.update({
      where: { id },
      data: {
        relationCode: dto.relationCode,
        standardTerm: dto.standardTerm,
        familyAlias: dto.familyAlias,
        enabled: dto.enabled,
      },
    });

    await this.auditLogsService.log({
      operatorId,
      action: AuditAction.UPDATE,
      targetType: 'KINSHIP_ALIAS',
      targetId: id,
      before: existing,
      after: updated,
    });

    return updated;
  }

  async memberToMember(dto: MemberToMemberDto) {
    const [members, marriages] = await this.loadFamilyGraph();

    const memberMap = new Map(members.map((member) => [member.id, member]));
    const source = memberMap.get(dto.sourceMemberId);
    const target = memberMap.get(dto.targetMemberId);

    if (!source || !target) {
      throw new NotFoundException('参与称呼计算的成员不存在。');
    }

    const sourceToTarget = await this.resolveBetween(source, target, members, marriages);
    const targetToSource = await this.resolveBetween(target, source, members, marriages);

    return {
      source: { id: source.id, name: source.name },
      target: { id: target.id, name: target.name },
      sourceToTarget,
      targetToSource,
    };
  }

  async pathCalc(dto: PathCalcDto) {
    const relationCode = dto.tokens.join('>');
    const chainText = tokensToChainText(dto.tokens);
    const candidates = this.resolveCandidates(
      chainText,
      dto.subjectGender ? toSexValue(dto.subjectGender) : -1,
    );
    const standardTerm =
      candidates.find((item) => item !== '自己') ?? candidates[0] ?? '待人工确认';
    const alias = await this.findAlias(relationCode, standardTerm);

    return {
      relationCode,
      chainText,
      candidates,
      standardTerm,
      familyAlias: alias?.familyAlias ?? null,
      displayTerm: alias?.familyAlias ?? standardTerm,
      ambiguous: candidates.length > 1,
    };
  }

  private async resolveBetween(
    source: FamilyMemberSnapshot,
    target: FamilyMemberSnapshot,
    members: FamilyMemberSnapshot[],
    marriages: FamilyMarriageSnapshot[],
  ): Promise<KinshipResolution> {
    if (source.id === target.id) {
      const selfAlias = await this.findAlias('SELF', '自己');
      return {
        relationCode: 'SELF',
        chainText: '自己',
        candidates: ['自己'],
        standardTerm: '自己',
        familyAlias: selfAlias?.familyAlias ?? null,
        displayTerm: selfAlias?.familyAlias ?? '自己',
        ambiguous: false,
        pathIds: [source.id],
      };
    }

    const path = this.findShortestPath(source.id, target.id, members, marriages);

    if (!path) {
      return {
        relationCode: 'UNKNOWN',
        chainText: '关系待补录',
        candidates: [],
        standardTerm: '待人工确认',
        familyAlias: null,
        displayTerm: '待人工确认',
        ambiguous: false,
      };
    }

    const chainText = tokensToChainText(path.tokens);
    const relationCode = path.tokens.join('>');
    const candidates = this.resolveCandidates(chainText, toSexValue(source.gender));
    const standardTerm =
      candidates.find((item) => item !== '自己') ?? candidates[0] ?? '待人工确认';
    const alias = await this.findAlias(relationCode, standardTerm);

    return {
      relationCode,
      chainText,
      candidates,
      standardTerm,
      familyAlias: alias?.familyAlias ?? null,
      displayTerm: alias?.familyAlias ?? standardTerm,
      ambiguous: candidates.length > 1,
      pathIds: path.pathIds,
    };
  }

  private resolveCandidates(chainText: string, sex: -1 | 0 | 1) {
    const result = relationship({
      text: chainText,
      sex,
      optimal: true,
    });

    return Array.from(new Set(result.filter(Boolean)));
  }

  private async findAlias(relationCode: string, standardTerm: string) {
    return this.prisma.kinshipAlias.findFirst({
      where: {
        enabled: true,
        OR: [{ relationCode }, { standardTerm }],
      },
      orderBy: [{ relationCode: 'asc' }],
    });
  }

  private async loadFamilyGraph() {
    return this.prisma.$transaction([
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
  }

  private findShortestPath(
    sourceId: string,
    targetId: string,
    members: FamilyMemberSnapshot[],
    marriages: FamilyMarriageSnapshot[],
  ) {
    const visited = new Set<string>([sourceId]);
    const queue: Array<{ memberId: string; tokens: string[]; pathIds: string[] }> = [
      {
        memberId: sourceId,
        tokens: [],
        pathIds: [sourceId],
      },
    ];

    while (queue.length > 0) {
      const current = queue.shift();

      if (!current) {
        continue;
      }

      if (current.memberId === targetId) {
        return current;
      }

      if (current.tokens.length >= 6) {
        continue;
      }

      const member = members.find((item) => item.id === current.memberId);

      if (!member) {
        continue;
      }

      for (const neighbor of this.getNeighbors(member, members, marriages)) {
        if (visited.has(neighbor.memberId)) {
          continue;
        }

        visited.add(neighbor.memberId);
        queue.push({
          memberId: neighbor.memberId,
          tokens: [...current.tokens, neighbor.token],
          pathIds: [...current.pathIds, neighbor.memberId],
        });
      }
    }

    return null;
  }

  private getNeighbors(
    member: FamilyMemberSnapshot,
    members: FamilyMemberSnapshot[],
    marriages: FamilyMarriageSnapshot[],
  ) {
    const neighbors: Array<{ memberId: string; token: string }> = [];
    const memberMap = new Map(members.map((item) => [item.id, item]));

    if (member.fatherId && memberMap.has(member.fatherId)) {
      neighbors.push({ memberId: member.fatherId, token: 'F' });
    }

    if (member.motherId && memberMap.has(member.motherId)) {
      neighbors.push({ memberId: member.motherId, token: 'M' });
    }

    const spouses = marriages
      .filter((marriage) => marriage.memberId === member.id || marriage.spouseId === member.id)
      .map((marriage) => (marriage.memberId === member.id ? marriage.spouseId : marriage.memberId));

    for (const spouseId of spouses) {
      const spouse = memberMap.get(spouseId);

      if (!spouse) {
        continue;
      }

      neighbors.push({
        memberId: spouseId,
        token: spouse.gender === Gender.MALE ? 'H' : 'W',
      });
    }

    const children = members.filter(
      (candidate) => candidate.fatherId === member.id || candidate.motherId === member.id,
    );

    for (const child of children) {
      neighbors.push({
        memberId: child.id,
        token: child.gender === Gender.MALE ? 'S' : 'D',
      });
    }

    const siblings = members.filter((candidate) => sharesParent(member, candidate));

    for (const sibling of siblings) {
      neighbors.push({
        memberId: sibling.id,
        token: resolveSiblingToken(member, sibling),
      });
    }

    return neighbors;
  }
}
