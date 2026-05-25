import type { Gender, KinshipAlias, KinshipResult, MemberKinshipResponse } from '../types';
import { request } from './core';

export type MemberKinshipPayload = {
  sourceMemberId: string;
  targetMemberId: string;
};

export type PathKinshipPayload = {
  tokens: string[];
  subjectGender?: Gender;
  reverse?: boolean;
};

export type KinshipAliasPayload = {
  relationCode?: string;
  standardTerm?: string;
  familyAlias?: string;
  enabled?: boolean;
};

export const kinshipApi = {
  calcMemberKinship: (payload: MemberKinshipPayload) =>
    request<MemberKinshipResponse>('/kinship/member-to-member', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  calcPathKinship: (payload: PathKinshipPayload) =>
    request<KinshipResult>('/kinship/path-calc', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getKinshipAliases: () => request<KinshipAlias[]>('/kinship/aliases'),
  createKinshipAlias: (payload: KinshipAliasPayload) =>
    request<KinshipAlias>('/kinship/aliases', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateKinshipAlias: (id: string, payload: KinshipAliasPayload) =>
    request<KinshipAlias>(`/kinship/aliases/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};
