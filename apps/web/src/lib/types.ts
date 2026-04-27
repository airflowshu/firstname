export type UserRole = 'ADMIN' | 'VIEWER';
export type UserStatus = 'ACTIVE' | 'DISABLED';
export type Gender = 'MALE' | 'FEMALE' | 'UNKNOWN';
export type LifeStatus = 'ALIVE' | 'DECEASED' | 'UNKNOWN';
export type MarriageStatus = 'ACTIVE' | 'DIVORCED' | 'WIDOWED';

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  stats: {
    totalMembers: number;
    maleMembers: number;
    femaleMembers: number;
    aliveMembers: number;
    deceasedMembers: number;
    generationCount: number;
    marriageCount: number;
  };
  recentMembers: Array<{
    id: string;
    name: string;
    gender: Gender;
    createdAt: string;
  }>;
  recentLogs: AuditLogRecord[];
}

export interface MemberOption {
  id: string;
  name: string;
  gender: Gender;
  subtitle: string;
}

export interface MemberListItem {
  id: string;
  name: string;
  gender: Gender;
  birthDate: string | null;
  deathDate: string | null;
  lifeStatus: LifeStatus;
  generationName: string | null;
  birthOrder: number | null;
  nativePlace: string | null;
  fatherId: string | null;
  motherId: string | null;
  notes: string | null;
  photoPath?: string | null;
  photoUrl?: string | null;
  isDeleted: boolean;
  father?: {
    id: string;
    name: string;
  } | null;
  mother?: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberDetail extends MemberListItem {
  father?: {
    id: string;
    name: string;
    gender: Gender;
  } | null;
  mother?: {
    id: string;
    name: string;
    gender: Gender;
  } | null;
  children: Array<{
    id: string;
    name: string;
    gender: Gender;
    birthDate: string | null;
    generationName: string | null;
  }>;
  siblings: Array<{
    id: string;
    name: string;
    gender: Gender;
    birthDate: string | null;
    birthOrder: number | null;
  }>;
  marriages: Array<{
    id: string;
    status: MarriageStatus;
    startDate: string | null;
    endDate: string | null;
    spouse: {
      id: string;
      name: string;
      gender: Gender;
    };
  }>;
}

export interface MembersResponse {
  total: number;
  page: number;
  pageSize: number;
  data: MemberListItem[];
}

export interface GraphData {
  centerId: string;
  depth: number;
  nodes: Array<{
    id: string;
    label: string;
    gender: Gender;
    lifeStatus: LifeStatus;
    generationName: string | null;
    isCenter: boolean;
    photoUrl: string | null;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label: string;
    type: string;
  }>;
}

export interface KinshipResult {
  relationCode: string;
  chainText: string;
  candidates: string[];
  standardTerm: string;
  familyAlias: string | null;
  displayTerm: string;
  ambiguous: boolean;
  pathIds?: string[];
}

export interface MemberKinshipResponse {
  source: { id: string; name: string };
  target: { id: string; name: string };
  sourceToTarget: KinshipResult;
  targetToSource: KinshipResult;
}

export interface KinshipAlias {
  id: string;
  relationCode: string;
  standardTerm: string;
  familyAlias: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChangelogEntry {
  id: string;
  version: string;
  releaseDate: string;
  summary: string;
  changes: ChangelogChangeItem[];
}

export type ChangelogChangeType = 'feat' | 'fix' | 'perf' | 'docs' | 'chore';

export interface ChangelogChangeItem {
  type: ChangelogChangeType;
  content: string;
}

export interface UserRecord extends AuthUser {
  updatedAt?: string;
}

export interface AuditLogRecord {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  createdAt: string;
  operator: {
    id: string;
    username: string;
    role: UserRole;
  } | null;
}
