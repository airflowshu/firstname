import { Gender } from '@prisma/client';
import { resolveSiblingToken, type FamilyMemberSnapshot } from './family-tree.util';

function buildMember(id: string, gender: Gender, birthOrder: number): FamilyMemberSnapshot {
  return {
    id,
    name: id,
    gender,
    fatherId: 'father',
    motherId: 'mother',
    birthDate: null,
    birthOrder,
  };
}

describe('family-tree util', () => {
  it('resolves sibling tokens from the current member perspective by birth order', () => {
    const olderBrother = buildMember('older-brother', Gender.MALE, 1);
    const youngerBrother = buildMember('younger-brother', Gender.MALE, 2);
    const olderSister = buildMember('older-sister', Gender.FEMALE, 1);
    const youngerSister = buildMember('younger-sister', Gender.FEMALE, 2);

    expect(resolveSiblingToken(olderBrother, youngerBrother)).toBe('LB');
    expect(resolveSiblingToken(youngerBrother, olderBrother)).toBe('OB');
    expect(resolveSiblingToken(olderSister, youngerSister)).toBe('LS');
    expect(resolveSiblingToken(youngerSister, olderSister)).toBe('OS');
  });
});
