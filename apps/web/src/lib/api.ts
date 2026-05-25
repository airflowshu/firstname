'use client';

import { assetsApi } from './api-client/assets';
import { auditLogsApi } from './api-client/audit-logs';
import { authApi } from './api-client/auth';
import { dashboardApi } from './api-client/dashboard';
import { graphApi } from './api-client/graph';
import { invitationsApi } from './api-client/invitations';
import { kinshipApi } from './api-client/kinship';
import { membersApi } from './api-client/members';
import { platformApi } from './api-client/platform';
import { systemApi } from './api-client/system';
import { supplementRequestsApi } from './api-client/supplement-requests';
import { usersApi } from './api-client/users';

export { ApiError, getRuntimeAccessToken, setRuntimeAccessToken } from './api-client/core';
export type {
  AcceptInvitationPayload,
  ChangePasswordPayload,
  LoginPayload,
} from './api-client/auth';
export type {
  AssetBatchOperationPayload,
  AssetImportPayload,
  AssetLibraryQuery,
  AssetMetadataPayload,
  AssetSourcePayload,
  AssetTagPayload,
} from './api-client/assets';
export type { AuditLogQuery } from './api-client/audit-logs';
export type {
  KinshipAliasPayload,
  MemberKinshipPayload,
  PathKinshipPayload,
} from './api-client/kinship';
export type {
  CreateMemberEventPayload,
  MarriageMutationPayload,
  MemberAssetQuery,
  MemberDuplicateCheckPayload,
  MemberMutationPayload,
  MemberOptionsPageQuery,
  MemberQuery,
  MemberSortBy,
  MemberSortOrder,
  QuickRelativePayload,
  QuickRelativeType,
  UploadMemberAssetsPayload,
} from './api-client/members';
export type { DemoResetPayload } from './api-client/platform';
export type {
  AssetMetadataChangeRequestPayload,
  EventChangeRequestPayload,
  MarriageChangeRequestPayload,
  MemberCreateRequestPayload,
  MemberDeleteRequestPayload,
  MemberPhotoRequestPayload,
  MemberRestoreRequestPayload,
  MemberUpdateRequestPayload,
  QuickRelativeRequestPayload,
  ReviewSupplementRequestPayload,
  SupplementAssetRequestPayload,
  SupplementRequestPayload,
  SupplementRequestsQuery,
} from './api-client/supplement-requests';
export type { UserMutationPayload } from './api-client/users';

export const api = {
  ...systemApi,
  ...authApi,
  ...invitationsApi,
  ...platformApi,
  ...dashboardApi,
  ...membersApi,
  ...assetsApi,
  ...supplementRequestsApi,
  ...graphApi,
  ...kinshipApi,
  ...usersApi,
  ...auditLogsApi,
};

export {
  assetsApi,
  auditLogsApi,
  authApi,
  dashboardApi,
  graphApi,
  invitationsApi,
  kinshipApi,
  membersApi,
  platformApi,
  systemApi,
  supplementRequestsApi,
  usersApi,
};
