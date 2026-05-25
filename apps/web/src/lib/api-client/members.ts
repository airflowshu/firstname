import type {
  DuplicateMemberCheckResult,
  Gender,
  LifeStatus,
  MarriageStatus,
  MemberAssetCategory,
  MemberAssetRecord,
  MemberDetail,
  MemberEventType,
  MemberImportResult,
  MemberOption,
  MemberOptionsPageResponse,
  MemberTimelineEvent,
  MembersResponse,
} from '../types';
import type { AssetMetadataPayload } from './assets';
import { request } from './core';
import { withQuery } from './query';

export type MemberQuery = {
  page?: number;
  pageSize?: number;
  keyword?: string;
  generationName?: string;
  birthYearFrom?: number;
  birthYearTo?: number;
  nativePlace?: string;
  gender?: Gender;
  lifeStatus?: LifeStatus;
  hasPhoto?: boolean;
  hasAssets?: boolean;
  includeDeleted?: boolean;
  sortBy?: MemberSortBy;
  sortOrder?: MemberSortOrder;
};

export type MemberSortBy = 'name' | 'birthDate' | 'generationName' | 'createdAt' | 'updatedAt';
export type MemberSortOrder = 'asc' | 'desc';

export type MemberMutationPayload = {
  existingMemberId?: string;
  name?: string;
  gender?: Gender;
  birthDate?: string | null;
  deathDate?: string | null;
  lifeStatus?: LifeStatus;
  cemeteryLatitude?: number | null;
  cemeteryLongitude?: number | null;
  cemeteryName?: string | null;
  cemeteryAddress?: string | null;
  cemeteryPoiId?: string | null;
  cemeteryRemark?: string | null;
  generationName?: string;
  birthOrder?: number;
  nativePlace?: string;
  fatherId?: string;
  motherId?: string;
  notes?: string;
};

export type MemberDuplicateCheckPayload = MemberMutationPayload & {
  excludeId?: string;
};

export type MemberAssetQuery = {
  category?: MemberAssetCategory;
  keyword?: string;
  tag?: string;
  sourceType?: string;
};

export type MemberOptionsPageQuery = {
  keyword?: string;
  page?: number;
  pageSize?: number;
};

export type QuickRelativeType = 'father' | 'mother' | 'spouse' | 'child' | 'sibling';

export type QuickRelativePayload = {
  relationType: QuickRelativeType;
  existingMemberId?: string;
  member: MemberMutationPayload;
};

export type UploadMemberAssetsPayload = AssetMetadataPayload & {
  files: File[];
};

export type CreateMemberEventPayload = {
  eventType: MemberEventType;
  title: string;
  description?: string;
  eventDate: string;
};

export type MarriageMutationPayload = {
  spouseId?: string;
  status?: MarriageStatus;
  startDate?: string | null;
  endDate?: string | null;
};

function createMemberImportFormData(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return formData;
}

function createMemberAssetFormData(payload: UploadMemberAssetsPayload) {
  const formData = new FormData();
  payload.files.forEach((file) => {
    formData.append('files', file);
  });
  if (payload.title !== undefined) {
    formData.append('title', payload.title);
  }
  if (payload.sourceType !== undefined) {
    formData.append('sourceType', payload.sourceType);
  }
  if (payload.source !== undefined) {
    formData.append('source', payload.source);
  }
  if (payload.description !== undefined) {
    formData.append('description', payload.description);
  }
  if (payload.tags) {
    formData.append('tags', JSON.stringify(payload.tags));
  }

  return formData;
}

export const membersApi = {
  getMembers: (params: MemberQuery) => request<MembersResponse>(withQuery('/members', params)),
  getMember: (id: string) => request<MemberDetail>(`/members/${id}`),
  getMemberTimeline: (memberId: string) =>
    request<MemberTimelineEvent[]>(`/members/${memberId}/timeline`),
  getMemberAssets: (memberId: string, params?: MemberAssetQuery) =>
    request<MemberAssetRecord[]>(withQuery(`/members/${memberId}/assets`, params ?? {})),
  getMemberOptions: (keyword?: string) =>
    request<MemberOption[]>(withQuery('/members/options', { keyword })),
  getMemberOptionsPage: ({ keyword, page = 1, pageSize = 30 }: MemberOptionsPageQuery) =>
    request<MemberOptionsPageResponse>(
      withQuery('/members/options-page', {
        keyword,
        page,
        pageSize,
      }),
    ),
  checkMemberDuplicates: (payload: MemberDuplicateCheckPayload) =>
    request<DuplicateMemberCheckResult>('/members/duplicate-check', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createQuickRelative: (memberId: string, payload: QuickRelativePayload) =>
    request<MemberDetail>(`/members/${memberId}/quick-relatives`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  downloadMemberImportTemplate: () =>
    request<Blob>('/members/import-template', {
      responseType: 'blob',
    }),
  importMembers: (file: File) =>
    request<MemberImportResult>('/members/import', {
      method: 'POST',
      body: createMemberImportFormData(file),
    }),
  createMember: (payload: MemberMutationPayload) =>
    request<MemberDetail>('/members', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateMember: (id: string, payload: MemberMutationPayload) =>
    request<MemberDetail>(`/members/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteMember: (id: string) =>
    request<{ success: boolean }>(`/members/${id}`, {
      method: 'DELETE',
    }),
  restoreMember: (id: string) =>
    request<MemberDetail>(`/members/${id}/restore`, {
      method: 'POST',
    }),
  uploadMemberPhoto: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    return request<{ photoPath: string; photoUrl: string }>(`/members/${id}/photo`, {
      method: 'POST',
      body: formData,
    });
  },
  uploadMemberAssets: (
    id: string,
    category: MemberAssetCategory,
    payload: UploadMemberAssetsPayload,
  ) =>
    request<MemberAssetRecord[]>(
      `/members/${id}/assets/${category === 'PHOTO' ? 'photos' : 'documents'}`,
      {
        method: 'POST',
        body: createMemberAssetFormData(payload),
      },
    ),
  updateMemberAsset: (memberId: string, assetId: string, payload: AssetMetadataPayload) =>
    request<MemberAssetRecord>(`/members/${memberId}/assets/${assetId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  createMemberEvent: (memberId: string, payload: CreateMemberEventPayload) =>
    request<MemberTimelineEvent>(`/members/${memberId}/events`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteMemberEvent: (memberId: string, eventId: string) =>
    request<{ success: boolean }>(`/members/${memberId}/events/${eventId}`, {
      method: 'DELETE',
    }),
  deleteMemberAsset: (memberId: string, assetId: string) =>
    request<{ success: boolean }>(`/members/${memberId}/assets/${assetId}`, {
      method: 'DELETE',
    }),
  createMarriage: (memberId: string, payload: MarriageMutationPayload) =>
    request(`/members/${memberId}/marriages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateMarriage: (memberId: string, marriageId: string, payload: MarriageMutationPayload) =>
    request(`/members/${memberId}/marriages/${marriageId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteMarriage: (memberId: string, marriageId: string) =>
    request(`/members/${memberId}/marriages/${marriageId}`, {
      method: 'DELETE',
    }),
  restoreMarriage: (memberId: string, marriageId: string) =>
    request(`/members/${memberId}/marriages/${marriageId}/restore`, {
      method: 'POST',
    }),
  exportMembers: () =>
    request<Blob>('/members/export', {
      responseType: 'blob',
    }),
};
