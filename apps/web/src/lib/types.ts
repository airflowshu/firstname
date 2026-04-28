export type UserRole = 'ADMIN' | 'VIEWER';
export type UserStatus = 'ACTIVE' | 'DISABLED';
export type Gender = 'MALE' | 'FEMALE' | 'UNKNOWN';
export type LifeStatus = 'ALIVE' | 'DECEASED' | 'UNKNOWN';
export type MarriageStatus = 'ACTIVE' | 'DIVORCED' | 'WIDOWED';
export type SupplementRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type SupplementRequestType = 'BASIC_INFO' | 'PHOTO' | 'DOCUMENT';
export type MemberEventType =
  | 'BIRTH'
  | 'MARRIAGE'
  | 'DIVORCE'
  | 'DEATH'
  | 'MOVE'
  | 'CAREER'
  | 'HONOR'
  | 'STORY'
  | 'OTHER';

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

export interface DuplicateMemberMatch {
  id: string;
  name: string;
  gender: Gender;
  birthDate: string | null;
  generationName: string | null;
  nativePlace: string | null;
  father?: {
    id: string;
    name: string;
  } | null;
  mother?: {
    id: string;
    name: string;
  } | null;
  score: number;
  matchedFields: string[];
}

export interface DuplicateMemberCheckResult {
  hasMatches: boolean;
  matches: DuplicateMemberMatch[];
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
  timeline: MemberTimelineEvent[];
}

export interface MembersResponse {
  total: number;
  page: number;
  pageSize: number;
  data: MemberListItem[];
}

export interface MemberImportResult {
  success: boolean;
  createdCount: number;
  message: string;
}

export type MemberAssetCategory = 'PHOTO' | 'DOCUMENT';

export interface AssetMetadataFields {
  sourceType?: string | null;
  title?: string | null;
  source?: string | null;
  description?: string | null;
  tags: string[];
}

export interface MemberAssetRecord extends AssetMetadataFields {
  id: string;
  memberId: string;
  uploadedById?: string | null;
  category: MemberAssetCategory;
  filePath: string;
  fileUrl: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  uploadedBy?: {
    id: string;
    username: string;
    role: UserRole;
  } | null;
}

export interface MemberAssetLibraryItem extends MemberAssetRecord {
  member: {
    id: string;
    name: string;
    gender: Gender;
    generationName?: string | null;
    nativePlace?: string | null;
  };
}

export interface MemberAssetLibraryResponse {
  total: number;
  page: number;
  pageSize: number;
  overview: {
    totalAssets: number;
    totalPhotos: number;
    totalDocuments: number;
    taggedAssets: number;
    sourcedAssets: number;
    describedAssets: number;
    linkedMembers: number;
  };
  tagBuckets: Array<{
    tag: string;
    count: number;
  }>;
  data: MemberAssetLibraryItem[];
}

export interface AssetTagRecord {
  id: string;
  name: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  useCount: number;
}

export interface AssetSourceRecord {
  id: string;
  name: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  useCount: number;
}

export type AssetBatchAction = 'APPEND_TAGS' | 'SET_SOURCE_TYPE' | 'DELETE';

export interface AssetImportFailure {
  originalName: string;
  message: string;
}

export interface AssetImportBatchResult {
  auditLogId: string;
  memberId: string;
  memberName: string;
  category: MemberAssetCategory;
  totalCount: number;
  successCount: number;
  failedCount: number;
  createdAt: string;
  createdAssets: MemberAssetRecord[];
  failures: AssetImportFailure[];
}

export interface AssetImportBatchView {
  batchId: string;
  memberName: string;
  createdAssetIds: string[];
}

export interface AssetImportBatchRecord {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  createdAt: string;
  operator: {
    id: string;
    username: string;
    role: UserRole;
  } | null;
  metadata: {
    memberId?: string;
    memberName?: string;
    category?: MemberAssetCategory;
    totalCount?: number;
    successCount?: number;
    failedCount?: number;
    sourceType?: string | null;
    source?: string | null;
    tags?: string[];
    titles?: string[];
    failures?: AssetImportFailure[];
    createdAssetIds?: string[];
  } | null;
}

export interface AssetImportBatchListResponse {
  total: number;
  page: number;
  pageSize: number;
  data: AssetImportBatchRecord[];
}

export interface SupplementRequestAssetRecord extends AssetMetadataFields {
  id: string;
  requestId: string;
  category: MemberAssetCategory;
  filePath: string;
  fileUrl: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemberTimelineEvent {
  id: string;
  source: 'system' | 'custom';
  eventType: MemberEventType;
  title: string;
  description?: string | null;
  eventDate: string;
  createdBy?: {
    id: string;
    username: string;
    role: UserRole;
  } | null;
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

export interface SupplementRequestPatch {
  name?: string;
  gender?: Gender;
  birthDate?: string;
  deathDate?: string;
  lifeStatus?: LifeStatus;
  generationName?: string;
  birthOrder?: number;
  nativePlace?: string;
  notes?: string;
}

export interface SupplementRequestRecord {
  id: string;
  requestType: SupplementRequestType;
  status: SupplementRequestStatus;
  reason?: string | null;
  reviewComment?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  patch: SupplementRequestPatch;
  assets: SupplementRequestAssetRecord[];
  member: {
    id: string;
    name: string;
    gender: Gender;
    nativePlace?: string | null;
    generationName?: string | null;
  };
  requester: {
    id: string;
    username: string;
    role: UserRole;
  };
  reviewer?: {
    id: string;
    username: string;
    role: UserRole;
  } | null;
}
