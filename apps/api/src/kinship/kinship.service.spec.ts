import { Gender } from '@prisma/client';
import { KinshipService } from './kinship.service';

describe('KinshipService', () => {
  const prisma = {
    kinshipAlias: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    member: {
      findMany: jest.fn(),
    },
    marriage: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const auditLogsService = {
    log: jest.fn(),
  };

  const service = new KinshipService(prisma as never, auditLogsService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should apply family alias for direct father token', async () => {
    prisma.kinshipAlias.findFirst.mockResolvedValue({
      familyAlias: '阿爸',
    });

    const result = await service.pathCalc({
      tokens: ['F'],
      subjectGender: Gender.MALE,
    });

    expect(result.standardTerm).toBe('爸爸');
    expect(result.displayTerm).toBe('阿爸');
    expect(result.relationCode).toBe('F');
  });

  it('should calculate member to member appellation in both directions', async () => {
    prisma.$transaction.mockResolvedValue([
      [
        {
          id: 'father',
          name: '王国华',
          gender: Gender.MALE,
          fatherId: 'grandpa',
          motherId: 'grandma',
          birthDate: new Date('1965-03-15'),
          birthOrder: 1,
        },
        {
          id: 'son',
          name: '王磊',
          gender: Gender.MALE,
          fatherId: 'father',
          motherId: 'mother',
          birthDate: new Date('1990-11-05'),
          birthOrder: 1,
        },
        {
          id: 'mother',
          name: '张美兰',
          gender: Gender.FEMALE,
          fatherId: null,
          motherId: null,
          birthDate: new Date('1967-01-23'),
          birthOrder: 1,
        },
        {
          id: 'grandpa',
          name: '王振山',
          gender: Gender.MALE,
          fatherId: null,
          motherId: null,
          birthDate: new Date('1938-05-03'),
          birthOrder: 1,
        },
        {
          id: 'grandma',
          name: '李秀兰',
          gender: Gender.FEMALE,
          fatherId: null,
          motherId: null,
          birthDate: new Date('1940-10-12'),
          birthOrder: 1,
        },
      ],
      [],
    ]);
    prisma.kinshipAlias.findFirst.mockResolvedValue(null);

    const result = await service.memberToMember({
      sourceMemberId: 'father',
      targetMemberId: 'son',
    });

    expect(result.sourceToTarget.standardTerm).toBe('儿子');
    expect(result.targetToSource.standardTerm).toBe('爸爸');
    expect(result.sourceToTarget.chainText).toBe('儿子');
    expect(result.targetToSource.chainText).toBe('爸爸');
  });
});
