import { Gender, MarriageStatus } from '@prisma/client';
import { createHash } from 'node:crypto';

export interface FamilyMemberSnapshot {
  id: string;
  name: string;
  gender: Gender;
  fatherId: string | null;
  motherId: string | null;
  birthDate: Date | null;
  birthOrder: number | null;
  lifeStatus?: string | null;
  generationName?: string | null;
  photoPath?: string | null;
}

export interface FamilyMarriageSnapshot {
  id: string;
  memberId: string;
  spouseId: string;
  status: MarriageStatus;
  isDeleted: boolean;
}

export function buildPairKey(firstId: string, secondId: string) {
  return [firstId, secondId].sort().join(':');
}

export function toSexValue(gender: Gender | null | undefined): -1 | 0 | 1 {
  if (gender === Gender.MALE) {
    return 1;
  }

  if (gender === Gender.FEMALE) {
    return 0;
  }

  return -1;
}

export function tokenToLabel(token: string) {
  const tokenMap: Record<string, string> = {
    F: '爸爸',
    M: '妈妈',
    H: '丈夫',
    W: '妻子',
    S: '儿子',
    D: '女儿',
    OB: '哥哥',
    LB: '弟弟',
    OS: '姐姐',
    LS: '妹妹',
    B: '兄弟',
    Z: '姐妹',
    SELF: '自己',
  };

  return tokenMap[token] ?? token;
}

export function tokensToChainText(tokens: string[]) {
  if (tokens.length === 0) {
    return '自己';
  }

  return tokens.map(tokenToLabel).join('的');
}

export function buildPhotoUrl(photoPath: string | null | undefined) {
  if (!photoPath) {
    return null;
  }

  return `/uploads/${photoPath.replace(/\\/g, '/')}`;
}

export function buildUploadUrl(filePath: string | null | undefined) {
  if (!filePath) {
    return null;
  }

  return `/uploads/${filePath.replace(/\\/g, '/')}`;
}

export function buildFileChecksum(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function compareByBirthOrder(left: FamilyMemberSnapshot, right: FamilyMemberSnapshot) {
  if (left.birthOrder && right.birthOrder) {
    return left.birthOrder - right.birthOrder;
  }

  if (left.birthDate && right.birthDate) {
    return left.birthDate.getTime() - right.birthDate.getTime();
  }

  return 0;
}

export function sharesParent(
  current: FamilyMemberSnapshot,
  candidate: FamilyMemberSnapshot,
): boolean {
  if (current.id === candidate.id) {
    return false;
  }

  return Boolean(
    (current.fatherId && current.fatherId === candidate.fatherId) ||
    (current.motherId && current.motherId === candidate.motherId),
  );
}

export function resolveSiblingToken(current: FamilyMemberSnapshot, sibling: FamilyMemberSnapshot) {
  const orderComparison = compareByBirthOrder(current, sibling);

  if (sibling.gender === Gender.MALE) {
    if (orderComparison < 0) {
      return 'LB';
    }

    if (orderComparison > 0) {
      return 'OB';
    }

    return 'B';
  }

  if (sibling.gender === Gender.FEMALE) {
    if (orderComparison < 0) {
      return 'LS';
    }

    if (orderComparison > 0) {
      return 'OS';
    }

    return 'Z';
  }

  return 'B';
}
