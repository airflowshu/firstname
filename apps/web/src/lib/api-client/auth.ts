import type { AuthUser } from '../types';
import { clearStoredAuth, request, setRuntimeAccessToken } from './core';

export type LoginPayload = {
  username: string;
  password: string;
};

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

export type AcceptInvitationPayload = {
  phone: string;
  username: string;
  password: string;
  displayName?: string;
  familyName?: string;
};

export const authApi = {
  login: async (payload: LoginPayload) => {
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
  changePassword: (payload: ChangePasswordPayload) =>
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
};
