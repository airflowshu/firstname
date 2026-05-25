import type { UserRecord, UserRole, UserStatus } from '../types';
import { request } from './core';

export type UserMutationPayload = {
  username?: string;
  password?: string;
  role?: UserRole;
  status?: UserStatus;
};

export const usersApi = {
  getUsers: () => request<UserRecord[]>('/users'),
  createUser: (payload: UserMutationPayload) =>
    request<UserRecord>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateUser: (id: string, payload: UserMutationPayload) =>
    request<UserRecord>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};
