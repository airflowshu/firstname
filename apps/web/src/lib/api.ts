'use client';

import type {
  AuditLogRecord,
  AssetSourceRecord,
  AssetTagRecord,
  AssetImportBatchListResponse,
  AssetImportBatchResult,
  AssetImportPrecheckResult,
  AuthUser,
  DashboardSummary,
  DemoResetPreviewResponse,
  DemoResetResult,
  DuplicateMemberCheckResult,
  GraphData,
  KinshipAlias,
  KinshipResult,
  MemberDetail,
  MemberAssetRecord,
  MemberAssetLibraryResponse,
  MemberTimelineEvent,
  MemberImportResult,
  SupplementRequestRecord,
  MemberKinshipResponse,
  MemberOption,
  MemberOptionsPageResponse,
  MembersResponse,
  InvitationInspectResult,
  InvitationResult,
  PlatformFamilyRecord,
  UserRecord,
} from './types';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = RequestInit & {
  token?: string | null;
  responseType?: 'json' | 'blob';
  skipAuthRefresh?: boolean;
};

let runtimeAccessToken: string | null = null;

export function getRuntimeAccessToken() {
  return runtimeAccessToken;
}

export function setRuntimeAccessToken(token: string | null) {
  runtimeAccessToken = token;
}

function getApiBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (typeof window === 'undefined') {
    return configuredUrl || 'http://localhost:3001';
  }

  const currentUrl = new URL(window.location.href);
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(currentUrl.hostname);

  if (configuredUrl) {
    try {
      const apiUrl = new URL(configuredUrl);
      const configuredPointsToCurrentFrontend =
        apiUrl.hostname === currentUrl.hostname && apiUrl.port === currentUrl.port;
      const configuredLocalhostFromRemotePage =
        ['localhost', '127.0.0.1', '::1'].includes(apiUrl.hostname) && !isLocalHost;

      if (configuredPointsToCurrentFrontend || configuredLocalhostFromRemotePage) {
        apiUrl.hostname = currentUrl.hostname;
        apiUrl.port = '3001';
        return apiUrl.origin;
      }

      return apiUrl.origin;
    } catch {
      return configuredUrl;
    }
  }

  if (!isLocalHost) {
    return `${currentUrl.protocol}//${currentUrl.hostname}:3001`;
  }

  return 'http://localhost:3001';
}

function clearStoredAuth() {
  setRuntimeAccessToken(null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('fisrtname:auth-cleared'));
  }
}

async function parseErrorMessage(response: Response) {
  let message = `请求失败：${response.status}`;

  try {
    const errorBody = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(errorBody.message)) {
      message = errorBody.message.join('；');
    } else if (errorBody.message) {
      message = errorBody.message;
    }
  } catch {
    // ignore parse failure
  }

  return message;
}

function shouldTryRefresh(path: string, options: RequestOptions) {
  if (options.skipAuthRefresh) {
    return false;
  }

  return path !== '/auth/login' && path !== '/auth/refresh';
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        credentials: 'include',
      });

      if (!response.ok) {
        clearStoredAuth();
        return null;
      }

      const payload = (await response.json()) as {
        accessToken: string;
        user?: AuthUser;
      };

      setRuntimeAccessToken(payload.accessToken);
      window.dispatchEvent(
        new CustomEvent('fisrtname:token-refreshed', {
          detail: {
            token: payload.accessToken,
            user: payload.user,
          },
        }),
      );
      return payload.accessToken;
    } catch {
      clearStoredAuth();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  const token = options.token ?? getRuntimeAccessToken();

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
    credentials: 'include',
  });

  if (response.status === 401 && shouldTryRefresh(path, options)) {
    const refreshedToken = await refreshAccessToken();

    if (refreshedToken) {
      return request<T>(path, {
        ...options,
        token: refreshedToken,
        skipAuthRefresh: true,
      });
    }
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new ApiError(message, response.status);
  }

  if (options.responseType === 'blob') {
    return (await response.blob()) as T;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  getSystemInfo: () =>
    request<{ name: string; version: string; status: string; timestamp: string }>('/'),
  login: async (payload: { username: string; password: string }) => {
    const result = await request<{ accessToken: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuthRefresh: true,
    });
    setRuntimeAccessToken(result.accessToken);
    return result;
  },
  refresh: async () => {
    const result = await request<{ accessToken: string; user: AuthUser }>('/auth/refresh', {
      method: 'POST',
      skipAuthRefresh: true,
    });
    setRuntimeAccessToken(result.accessToken);
    return result;
  },
  logout: async () => {
    try {
      return await request<{ success: boolean }>('/auth/logout', {
        method: 'POST',
      });
    } finally {
      clearStoredAuth();
    }
  },
  me: (token?: string | null) => request<AuthUser>('/auth/me', { token }),
  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    request<{ success: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuthRefresh: true,
    }),
  switchFamily: async (familyId: string) => {
    const result = await request<{ accessToken: string; user: AuthUser }>('/auth/switch-family', {
      method: 'POST',
      body: JSON.stringify({ familyId }),
    });
    setRuntimeAccessToken(result.accessToken);
    return result;
  },
  inspectInvitation: (code: string) =>
    request<InvitationInspectResult>(`/invitations/${encodeURIComponent(code)}`, {
      skipAuthRefresh: true,
    }),
  acceptInvitation: (
    code: string,
    payload: {
      phone: string;
      username: string;
      password: string;
      displayName?: string;
      familyName?: string;
    },
  ) =>
    request<{
      success: boolean;
      userId: string;
      family: { id: string; name: string };
      role: string;
    }>(`/invitations/${encodeURIComponent(code)}/accept`, {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuthRefresh: true,
    }),
  createFamilyAdminInvitation: (payload?: { expiresInDays?: number }) =>
    request<InvitationResult>('/platform/invitations/family-admin', {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }),
  createFamilyMemberInvitation: (payload?: { expiresInHours?: number }) =>
    request<InvitationResult>('/families/current/invitations/members', {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }),
  getPlatformFamilies: () => request<PlatformFamilyRecord[]>('/platform/families'),
  getDemoResetPreview: (familyId: string) =>
    request<DemoResetPreviewResponse>(
      `/platform/families/${encodeURIComponent(familyId)}/demo-reset-preview`,
    ),
  resetDemoFamily: (familyId: string, payload: { confirmationText: string }) =>
    request<DemoResetResult>(`/platform/families/${encodeURIComponent(familyId)}/demo-reset`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getDashboardSummary: () => request<DashboardSummary>('/dashboard/summary'),
  getMembers: (params: Record<string, string | number | boolean | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== null) {
        search.set(key, String(value));
      }
    });

    return request<MembersResponse>(`/members?${search.toString()}`);
  },
  getMember: (id: string) => request<MemberDetail>(`/members/${id}`),
  getMemberTimeline: (memberId: string) =>
    request<MemberTimelineEvent[]>(`/members/${memberId}/timeline`),
  getMemberAssets: (
    memberId: string,
    params?: {
      category?: 'PHOTO' | 'DOCUMENT';
      keyword?: string;
      tag?: string;
      sourceType?: string;
    },
  ) => {
    const search = new URLSearchParams();
    if (params?.category) {
      search.set('category', params.category);
    }
    if (params?.keyword) {
      search.set('keyword', params.keyword);
    }
    if (params?.tag) {
      search.set('tag', params.tag);
    }
    if (params?.sourceType) {
      search.set('sourceType', params.sourceType);
    }

    return request<MemberAssetRecord[]>(
      `/members/${memberId}/assets${search.toString() ? `?${search.toString()}` : ''}`,
    );
  },
  getAssetLibrary: (params: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    category?: 'PHOTO' | 'DOCUMENT';
    tag?: string;
    sourceType?: string;
    importBatchId?: string;
    hasSource?: boolean;
    hasDescription?: boolean;
    hasTags?: boolean;
  }) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== null) {
        search.set(key, String(value));
      }
    });

    return request<MemberAssetLibraryResponse>(`/assets?${search.toString()}`);
  },
  getAssetTags: (params?: { includeDisabled?: boolean }) => {
    const search = new URLSearchParams();
    if (params?.includeDisabled) {
      search.set('includeDisabled', 'true');
    }

    return request<AssetTagRecord[]>(
      `/assets/tags${search.toString() ? `?${search.toString()}` : ''}`,
    );
  },
  createAssetTag: (payload: { name: string; enabled?: boolean; sortOrder?: number }) =>
    request<AssetTagRecord>('/assets/tags', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAssetTag: (id: string, payload: { name: string; enabled?: boolean; sortOrder?: number }) =>
    request<AssetTagRecord>(`/assets/tags/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteAssetTag: (id: string) =>
    request<{ success: boolean }>(`/assets/tags/${id}`, {
      method: 'DELETE',
    }),
  getAssetSources: (params?: { includeDisabled?: boolean }) => {
    const search = new URLSearchParams();
    if (params?.includeDisabled) {
      search.set('includeDisabled', 'true');
    }

    return request<AssetSourceRecord[]>(
      `/assets/sources${search.toString() ? `?${search.toString()}` : ''}`,
    );
  },
  createAssetSource: (payload: { name: string; enabled?: boolean; sortOrder?: number }) =>
    request<AssetSourceRecord>('/assets/sources', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAssetSource: (
    id: string,
    payload: { name: string; enabled?: boolean; sortOrder?: number },
  ) =>
    request<AssetSourceRecord>(`/assets/sources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteAssetSource: (id: string) =>
    request<{ success: boolean }>(`/assets/sources/${id}`, {
      method: 'DELETE',
    }),
  importAssetsBatch: (payload: {
    memberId: string;
    category: 'PHOTO' | 'DOCUMENT';
    files: File[];
    sourceType?: string;
    source?: string;
    tags?: string[];
    description?: string;
    titles?: string[];
  }) => {
    const formData = new FormData();
    formData.append('memberId', payload.memberId);
    formData.append('category', payload.category);
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
    if (payload.titles) {
      formData.append('titles', JSON.stringify(payload.titles));
    }
    payload.files.forEach((file) => {
      formData.append('files', file);
    });

    return request<AssetImportBatchResult>('/assets/import-batch', {
      method: 'POST',
      body: formData,
    });
  },
  importAssetsPrecheck: (payload: {
    memberId: string;
    category: 'PHOTO' | 'DOCUMENT';
    files: File[];
    sourceType?: string;
    source?: string;
    tags?: string[];
    description?: string;
    titles?: string[];
  }) => {
    const formData = new FormData();
    formData.append('memberId', payload.memberId);
    formData.append('category', payload.category);
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
    if (payload.titles) {
      formData.append('titles', JSON.stringify(payload.titles));
    }
    payload.files.forEach((file) => {
      formData.append('files', file);
    });

    return request<AssetImportPrecheckResult>('/assets/import-precheck', {
      method: 'POST',
      body: formData,
    });
  },
  getAssetImportBatches: (params?: { page?: number; pageSize?: number }) => {
    const search = new URLSearchParams();
    if (params?.page) {
      search.set('page', String(params.page));
    }
    if (params?.pageSize) {
      search.set('pageSize', String(params.pageSize));
    }

    return request<AssetImportBatchListResponse>(
      `/assets/import-batches${search.toString() ? `?${search.toString()}` : ''}`,
    );
  },
  batchOperateAssets: (payload: {
    action: 'APPEND_TAGS' | 'SET_SOURCE_TYPE' | 'DELETE';
    assetIds: string[];
    tags?: string[];
    sourceType?: string;
  }) =>
    request<{ success: boolean; action: string; affectedCount: number }>('/assets/batch', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getMemberOptions: (keyword?: string) =>
    request<MemberOption[]>(
      `/members/options${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''}`,
    ),
  getMemberOptionsPage: ({
    keyword,
    page = 1,
    pageSize = 30,
  }: {
    keyword?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const search = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (keyword) {
      search.set('keyword', keyword);
    }

    return request<MemberOptionsPageResponse>(`/members/options-page?${search.toString()}`);
  },
  checkMemberDuplicates: (payload: unknown) =>
    request<DuplicateMemberCheckResult>('/members/duplicate-check', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createQuickRelative: (
    memberId: string,
    payload: {
      relationType: 'father' | 'mother' | 'spouse' | 'child' | 'sibling';
      existingMemberId?: string;
      member: Record<string, unknown>;
    },
  ) =>
    request<MemberDetail>(`/members/${memberId}/quick-relatives`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getSupplementRequests: (params: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        search.set(key, String(value));
      }
    });

    return request<{
      total: number;
      page: number;
      pageSize: number;
      data: SupplementRequestRecord[];
    }>(`/supplement-requests?${search.toString()}`);
  },
  createSupplementRequest: (payload: unknown) =>
    request<SupplementRequestRecord>('/supplement-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createMemberCreateRequest: (payload: { member: unknown; reason?: string }) =>
    request<SupplementRequestRecord>('/supplement-requests/member-create', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createMemberUpdateRequest: (payload: { memberId: string; patch: unknown; reason?: string }) =>
    request<SupplementRequestRecord>('/supplement-requests/member-update', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createMemberDeleteRequest: (payload: { memberId: string; reason?: string }) =>
    request<SupplementRequestRecord>('/supplement-requests/member-delete', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createMemberRestoreRequest: (payload: { memberId: string; reason?: string }) =>
    request<SupplementRequestRecord>('/supplement-requests/member-restore', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createQuickRelativeRequest: (payload: {
    memberId: string;
    request: {
      relationType: 'father' | 'mother' | 'spouse' | 'child' | 'sibling';
      existingMemberId?: string;
      member: Record<string, unknown>;
    };
    reason?: string;
  }) =>
    request<SupplementRequestRecord>('/supplement-requests/quick-relative', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createMarriageChangeRequest: (payload: {
    memberId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
    marriageId?: string;
    create?: unknown;
    update?: unknown;
    reason?: string;
  }) =>
    request<SupplementRequestRecord>('/supplement-requests/marriage', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createMemberPhotoRequest: (payload: { memberId: string; file: File; reason?: string }) => {
    const formData = new FormData();
    formData.append('memberId', payload.memberId);
    formData.append('file', payload.file);
    if (payload.reason) {
      formData.append('reason', payload.reason);
    }

    return request<SupplementRequestRecord>('/supplement-requests/member-photo', {
      method: 'POST',
      body: formData,
    });
  },
  createSupplementAssetRequest: (
    payload: {
      memberId: string;
      category: 'PHOTO' | 'DOCUMENT';
      reason?: string;
      sourceType?: string;
      title?: string;
      source?: string;
      tags?: string[];
      description?: string;
    },
    files: File[],
  ) => {
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

    return request<SupplementRequestRecord>('/supplement-requests/assets', {
      method: 'POST',
      body: formData,
    });
  },
  createAssetMetadataChangeRequest: (payload: {
    memberId: string;
    assetId: string;
    action: 'UPDATE' | 'DELETE';
    patch?: {
      title?: string;
      sourceType?: string;
      source?: string;
      tags?: string[];
      description?: string;
    };
    reason?: string;
  }) =>
    request<SupplementRequestRecord>('/supplement-requests/asset-update', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createEventChangeRequest: (payload: {
    memberId: string;
    action: 'CREATE' | 'DELETE';
    eventId?: string;
    event?: {
      eventType: MemberTimelineEvent['eventType'];
      title: string;
      description?: string;
      eventDate: string;
    };
    reason?: string;
  }) =>
    request<SupplementRequestRecord>('/supplement-requests/event', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createMemberImportRequest: (file: File, reason?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (reason) {
      formData.append('reason', reason);
    }

    return request<SupplementRequestRecord>('/supplement-requests/import', {
      method: 'POST',
      body: formData,
    });
  },
  reviewSupplementRequest: (
    id: string,
    payload: { action: 'APPROVE' | 'REJECT'; reviewComment?: string },
  ) =>
    request<SupplementRequestRecord>(`/supplement-requests/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  downloadMemberImportTemplate: () =>
    request<Blob>('/members/import-template', {
      responseType: 'blob',
    }),
  importMembers: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    return request<MemberImportResult>('/members/import', {
      method: 'POST',
      body: formData,
    });
  },
  createMember: (payload: unknown) =>
    request<MemberDetail>('/members', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateMember: (id: string, payload: unknown) =>
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
    category: 'PHOTO' | 'DOCUMENT',
    payload: {
      files: File[];
      sourceType?: string;
      title?: string;
      source?: string;
      tags?: string[];
      description?: string;
    },
  ) => {
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

    return request<MemberAssetRecord[]>(
      `/members/${id}/assets/${category === 'PHOTO' ? 'photos' : 'documents'}`,
      {
        method: 'POST',
        body: formData,
      },
    );
  },
  updateMemberAsset: (
    memberId: string,
    assetId: string,
    payload: {
      title?: string;
      sourceType?: string;
      source?: string;
      tags?: string[];
      description?: string;
    },
  ) =>
    request<MemberAssetRecord>(`/members/${memberId}/assets/${assetId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  createMemberEvent: (
    memberId: string,
    payload: {
      eventType: MemberTimelineEvent['eventType'];
      title: string;
      description?: string;
      eventDate: string;
    },
  ) =>
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
  createMarriage: (memberId: string, payload: unknown) =>
    request(`/members/${memberId}/marriages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateMarriage: (memberId: string, marriageId: string, payload: unknown) =>
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
  getGraph: (memberId: string, depth = 2) =>
    request<GraphData>(`/graph/member/${memberId}?depth=${depth}`),
  calcMemberKinship: (payload: { sourceMemberId: string; targetMemberId: string }) =>
    request<MemberKinshipResponse>('/kinship/member-to-member', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  calcPathKinship: (payload: { tokens: string[]; subjectGender?: string }) =>
    request<KinshipResult>('/kinship/path-calc', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getKinshipAliases: () => request<KinshipAlias[]>('/kinship/aliases'),
  createKinshipAlias: (payload: unknown) =>
    request<KinshipAlias>('/kinship/aliases', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateKinshipAlias: (id: string, payload: unknown) =>
    request<KinshipAlias>(`/kinship/aliases/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getUsers: () => request<UserRecord[]>('/users'),
  createUser: (payload: unknown) =>
    request<UserRecord>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateUser: (id: string, payload: unknown) =>
    request<UserRecord>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getAuditLogs: (params: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        search.set(key, String(value));
      }
    });

    return request<{
      total: number;
      page: number;
      pageSize: number;
      data: AuditLogRecord[];
    }>(`/audit-logs?${search.toString()}`);
  },
};
