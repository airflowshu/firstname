'use client';

import type {
  AuditLogRecord,
  AuthUser,
  DashboardSummary,
  DuplicateMemberCheckResult,
  GraphData,
  KinshipAlias,
  KinshipResult,
  MemberDetail,
  MemberAssetRecord,
  MemberTimelineEvent,
  MemberImportResult,
  SupplementRequestRecord,
  MemberKinshipResponse,
  MemberOption,
  MembersResponse,
  UserRecord,
} from './types';
import { TOKEN_STORAGE_KEY } from './constants';

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
};

function getStoredToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  const token = options.token ?? getStoredToken();

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${path}`,
    {
      ...options,
      headers,
      cache: 'no-store',
    },
  );

  if (!response.ok) {
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
  login: (payload: { username: string; password: string }) =>
    request<{ accessToken: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  logout: () =>
    request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    }),
  me: (token?: string | null) => request<AuthUser>('/auth/me', { token }),
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
  getMemberAssets: (memberId: string, category?: 'PHOTO' | 'DOCUMENT') =>
    request<MemberAssetRecord[]>(
      `/members/${memberId}/assets${category ? `?category=${category}` : ''}`,
    ),
  getMemberOptions: (keyword?: string) =>
    request<MemberOption[]>(
      `/members/options${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''}`,
    ),
  checkMemberDuplicates: (payload: unknown) =>
    request<DuplicateMemberCheckResult>('/members/duplicate-check', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createQuickRelative: (
    memberId: string,
    payload: {
      relationType: 'father' | 'mother' | 'spouse' | 'child' | 'sibling';
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
  createSupplementAssetRequest: (
    payload: {
      memberId: string;
      category: 'PHOTO' | 'DOCUMENT';
      reason?: string;
    },
    files: File[],
  ) => {
    const formData = new FormData();
    formData.append('memberId', payload.memberId);
    formData.append('category', payload.category);
    if (payload.reason) {
      formData.append('reason', payload.reason);
    }
    files.forEach((file) => {
      formData.append('files', file);
    });

    return request<SupplementRequestRecord>('/supplement-requests/assets', {
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
  uploadMemberAssets: (id: string, category: 'PHOTO' | 'DOCUMENT', files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    return request<MemberAssetRecord[]>(
      `/members/${id}/assets/${category === 'PHOTO' ? 'photos' : 'documents'}`,
      {
        method: 'POST',
        body: formData,
      },
    );
  },
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
