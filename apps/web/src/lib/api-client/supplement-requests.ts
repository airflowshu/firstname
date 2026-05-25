import type {
  MemberAssetCategory,
  SupplementRequestRecord,
  SupplementRequestStatus,
  SupplementRequestType,
} from '../types';
import type { AssetMetadataPayload } from './assets';
import { request } from './core';
import type {
  CreateMemberEventPayload,
  MarriageMutationPayload,
  MemberMutationPayload,
  QuickRelativePayload,
} from './members';
import { withQuery } from './query';

export type SupplementRequestsQuery = {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: SupplementRequestStatus;
  requestType?: SupplementRequestType;
};

export type SupplementRequestPayload = {
  memberId: string;
  patch: MemberMutationPayload;
  reason?: string;
};

export type MemberCreateRequestPayload = {
  member: MemberMutationPayload;
  reason?: string;
};

export type MemberUpdateRequestPayload = {
  memberId: string;
  patch: MemberMutationPayload;
  reason?: string;
};

export type MemberDeleteRequestPayload = {
  memberId: string;
  reason?: string;
};

export type MemberRestoreRequestPayload = MemberDeleteRequestPayload;

export type QuickRelativeRequestPayload = {
  memberId: string;
  request: QuickRelativePayload;
  reason?: string;
};

export type MarriageChangeRequestPayload = {
  memberId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
  marriageId?: string;
  create?: MarriageMutationPayload;
  update?: MarriageMutationPayload;
  reason?: string;
};

export type MemberPhotoRequestPayload = {
  memberId: string;
  file: File;
  reason?: string;
};

export type SupplementAssetRequestPayload = AssetMetadataPayload & {
  memberId: string;
  category: MemberAssetCategory;
  reason?: string;
  files?: File[];
};

export type AssetMetadataChangeRequestPayload = {
  memberId: string;
  assetId: string;
  action: 'UPDATE' | 'DELETE';
  patch?: AssetMetadataPayload;
  reason?: string;
};

export type EventChangeRequestPayload = {
  memberId: string;
  action: 'CREATE' | 'DELETE';
  eventId?: string;
  event?: CreateMemberEventPayload;
  reason?: string;
};

export type ReviewSupplementRequestPayload = {
  action: 'APPROVE' | 'REJECT';
  reviewComment?: string;
};

function createMemberPhotoRequestFormData(payload: MemberPhotoRequestPayload) {
  const formData = new FormData();
  formData.append('memberId', payload.memberId);
  formData.append('file', payload.file);
  if (payload.reason) {
    formData.append('reason', payload.reason);
  }

  return formData;
}

function createSupplementAssetRequestFormData(
  payload: Omit<SupplementAssetRequestPayload, 'files'>,
  files: File[],
) {
  const formData = new FormData();
  formData.append('memberId', payload.memberId);
  formData.append('category', payload.category);
  if (payload.reason) {
    formData.append('reason', payload.reason);
  }
  if (payload.sourceType !== undefined) {
    formData.append('sourceType', payload.sourceType);
  }
  if (payload.title !== undefined) {
    formData.append('title', payload.title);
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
  files.forEach((file) => {
    formData.append('files', file);
  });

  return formData;
}

function createMemberImportRequestFormData(file: File, reason?: string) {
  const formData = new FormData();
  formData.append('file', file);
  if (reason) {
    formData.append('reason', reason);
  }

  return formData;
}

export const supplementRequestsApi = {
  getSupplementRequests: (params: SupplementRequestsQuery) =>
    request<{
      total: number;
      page: number;
      pageSize: number;
      data: SupplementRequestRecord[];
    }>(withQuery('/supplement-requests', params)),
  createSupplementRequest: (payload: SupplementRequestPayload) =>
    request<SupplementRequestRecord>('/supplement-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createMemberCreateRequest: (payload: MemberCreateRequestPayload) =>
    request<SupplementRequestRecord>('/supplement-requests/member-create', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createMemberUpdateRequest: (payload: MemberUpdateRequestPayload) =>
    request<SupplementRequestRecord>('/supplement-requests/member-update', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createMemberDeleteRequest: (payload: MemberDeleteRequestPayload) =>
    request<SupplementRequestRecord>('/supplement-requests/member-delete', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createMemberRestoreRequest: (payload: MemberRestoreRequestPayload) =>
    request<SupplementRequestRecord>('/supplement-requests/member-restore', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createQuickRelativeRequest: (payload: QuickRelativeRequestPayload) =>
    request<SupplementRequestRecord>('/supplement-requests/quick-relative', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createMarriageChangeRequest: (payload: MarriageChangeRequestPayload) =>
    request<SupplementRequestRecord>('/supplement-requests/marriage', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createMemberPhotoRequest: (payload: MemberPhotoRequestPayload) =>
    request<SupplementRequestRecord>('/supplement-requests/member-photo', {
      method: 'POST',
      body: createMemberPhotoRequestFormData(payload),
    }),
  createSupplementAssetRequest: (
    payload: Omit<SupplementAssetRequestPayload, 'files'>,
    files: File[],
  ) =>
    request<SupplementRequestRecord>('/supplement-requests/assets', {
      method: 'POST',
      body: createSupplementAssetRequestFormData(payload, files),
    }),
  createAssetMetadataChangeRequest: (payload: AssetMetadataChangeRequestPayload) =>
    request<SupplementRequestRecord>('/supplement-requests/asset-update', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createEventChangeRequest: (payload: EventChangeRequestPayload) =>
    request<SupplementRequestRecord>('/supplement-requests/event', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createMemberImportRequest: (file: File, reason?: string) =>
    request<SupplementRequestRecord>('/supplement-requests/import', {
      method: 'POST',
      body: createMemberImportRequestFormData(file, reason),
    }),
  reviewSupplementRequest: (id: string, payload: ReviewSupplementRequestPayload) =>
    request<SupplementRequestRecord>(`/supplement-requests/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
