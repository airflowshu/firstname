import type { DemoResetPreviewResponse, DemoResetResult, PlatformFamilyRecord } from '../types';
import { request } from './core';

export type DemoResetPayload = {
  confirmationText: string;
};

export const platformApi = {
  getPlatformFamilies: () => request<PlatformFamilyRecord[]>('/platform/families'),
  getDemoResetPreview: (familyId: string) =>
    request<DemoResetPreviewResponse>(
      `/platform/families/${encodeURIComponent(familyId)}/demo-reset-preview`,
    ),
  resetDemoFamily: (familyId: string, payload: DemoResetPayload) =>
    request<DemoResetResult>(`/platform/families/${encodeURIComponent(familyId)}/demo-reset`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
