import type {
  AssetImportBatchListResponse,
  AssetImportBatchResult,
  AssetImportPrecheckResult,
  AssetSourceRecord,
  AssetTagRecord,
  MemberAssetCategory,
  MemberAssetLibraryResponse,
} from '../types';
import { request } from './core';
import { withQuery } from './query';

export type AssetLibraryQuery = {
  page?: number;
  pageSize?: number;
  keyword?: string;
  category?: MemberAssetCategory;
  tag?: string;
  sourceType?: string;
  importBatchId?: string;
  hasSource?: boolean;
  hasDescription?: boolean;
  hasTags?: boolean;
};

export type AssetTagPayload = {
  name: string;
  enabled?: boolean;
  sortOrder?: number;
};

export type AssetSourcePayload = {
  name: string;
  enabled?: boolean;
  sortOrder?: number;
};

export type AssetMetadataPayload = {
  title?: string;
  sourceType?: string;
  source?: string;
  tags?: string[];
  description?: string;
};

export type AssetImportPayload = AssetMetadataPayload & {
  memberId: string;
  category: MemberAssetCategory;
  files: File[];
  titles?: string[];
};

export type AssetBatchOperationPayload = {
  action: 'APPEND_TAGS' | 'SET_SOURCE_TYPE' | 'DELETE';
  assetIds: string[];
  tags?: string[];
  sourceType?: string;
};

function createAssetImportFormData(payload: AssetImportPayload) {
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

  return formData;
}

export const assetsApi = {
  getAssetLibrary: (params: AssetLibraryQuery) =>
    request<MemberAssetLibraryResponse>(withQuery('/assets', params)),
  getAssetTags: (params?: { includeDisabled?: boolean }) =>
    request<AssetTagRecord[]>(
      withQuery('/assets/tags', {
        includeDisabled: params?.includeDisabled ? 'true' : undefined,
      }),
    ),
  createAssetTag: (payload: AssetTagPayload) =>
    request<AssetTagRecord>('/assets/tags', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAssetTag: (id: string, payload: AssetTagPayload) =>
    request<AssetTagRecord>(`/assets/tags/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteAssetTag: (id: string) =>
    request<{ success: boolean }>(`/assets/tags/${id}`, {
      method: 'DELETE',
    }),
  getAssetSources: (params?: { includeDisabled?: boolean }) =>
    request<AssetSourceRecord[]>(
      withQuery('/assets/sources', {
        includeDisabled: params?.includeDisabled ? 'true' : undefined,
      }),
    ),
  createAssetSource: (payload: AssetSourcePayload) =>
    request<AssetSourceRecord>('/assets/sources', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAssetSource: (id: string, payload: AssetSourcePayload) =>
    request<AssetSourceRecord>(`/assets/sources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteAssetSource: (id: string) =>
    request<{ success: boolean }>(`/assets/sources/${id}`, {
      method: 'DELETE',
    }),
  importAssetsBatch: (payload: AssetImportPayload) =>
    request<AssetImportBatchResult>('/assets/import-batch', {
      method: 'POST',
      body: createAssetImportFormData(payload),
    }),
  importAssetsPrecheck: (payload: AssetImportPayload) =>
    request<AssetImportPrecheckResult>('/assets/import-precheck', {
      method: 'POST',
      body: createAssetImportFormData(payload),
    }),
  getAssetImportBatches: (params?: { page?: number; pageSize?: number }) =>
    request<AssetImportBatchListResponse>(withQuery('/assets/import-batches', params ?? {})),
  batchOperateAssets: (payload: AssetBatchOperationPayload) =>
    request<{ success: boolean; action: string; affectedCount: number }>('/assets/batch', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
