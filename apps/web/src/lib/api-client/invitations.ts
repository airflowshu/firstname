import type { InvitationInspectResult, InvitationResult } from '../types';
import type { AcceptInvitationPayload } from './auth';
import { request } from './core';

export const invitationsApi = {
  inspectInvitation: (code: string) =>
    request<InvitationInspectResult>(`/invitations/${encodeURIComponent(code)}`, {
      skipAuthRefresh: true,
    }),
  acceptInvitation: (code: string, payload: AcceptInvitationPayload) =>
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
};
