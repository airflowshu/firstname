import type { AuditLogRecord } from './types';

const metadataLabelMap: Record<string, string> = {
  action: '操作',
  requestType: '申请类型',
  memberId: '成员',
  memberName: '成员姓名',
  familyId: '家族',
  familyName: '家族名称',
  category: '资料类型',
  totalCount: '总数',
  successCount: '成功数',
  failedCount: '失败数',
  sourceType: '来源类型',
  source: '来源说明',
  tags: '标签',
  titles: '标题',
  failures: '失败明细',
  reviewComment: '审核说明',
  quickRelativeType: '亲属关系类型',
  anchorId: '当前成员',
  spouseId: '配偶',
  linkedMemberId: '已绑定成员',
  linkedExistingMember: '绑定已有成员',
};

const metadataValueLabelMap: Record<string, string> = {
  PHOTO: '照片',
  DOCUMENT: '附件',
  APPROVE: '通过',
  REJECT: '驳回',
  FAMILY_ADMIN: '建家族管理员邀请',
  FAMILY_MEMBER: '加入家族邀请',
  father: '父亲',
  mother: '母亲',
  spouse: '配偶',
  child: '子女',
  sibling: '兄弟姐妹',
  true: '是',
  false: '否',
};

type RecordLike = Record<string, unknown>;

export type AuditDetailMode = 'full' | 'compact';

export type AuditDetailBadge = {
  key: string;
  label: string;
  color: string;
};

export type AuditDetailView = {
  detail: string;
  badges: AuditDetailBadge[];
};

function toRecord(value: unknown): RecordLike | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as RecordLike;
}

function toText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatMetadataValue(item)).join('、') || '-';
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as RecordLike).filter(
      ([, itemValue]) => itemValue !== undefined && itemValue !== null && itemValue !== '',
    );
    if (entries.length === 0) {
      return '-';
    }
    return entries
      .slice(0, 6)
      .map(([key, itemValue]) => `${metadataLabelMap[key] ?? key}：${formatMetadataValue(itemValue)}`)
      .join('；');
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  const text = String(value);
  return metadataValueLabelMap[text] ?? text;
}

function formatMetadata(value: unknown): string {
  const record = toRecord(value);
  if (!record) {
    return '-';
  }
  const entries = Object.entries(record).filter(
    ([, itemValue]) => itemValue !== undefined && itemValue !== null && itemValue !== '',
  );
  if (entries.length === 0) {
    return '-';
  }
  return entries
    .map(([key, itemValue]) => `${metadataLabelMap[key] ?? key}：${formatMetadataValue(itemValue)}`)
    .join('；');
}

function getActionFallbackBadges(action: string): AuditDetailBadge[] {
  if (action === 'CREATE') {
    return [{ key: 'action', label: '新增', color: 'success' }];
  }
  if (action === 'UPDATE') {
    return [{ key: 'action', label: '更新', color: 'processing' }];
  }
  if (action === 'DELETE') {
    return [{ key: 'action', label: '删除', color: 'error' }];
  }
  if (action === 'RESTORE') {
    return [{ key: 'action', label: '恢复', color: 'cyan' }];
  }
  return [];
}

function buildBadges(record: AuditLogRecord, metadata: RecordLike | null): AuditDetailBadge[] {
  const badges: AuditDetailBadge[] = [];

  if (record.targetType === 'MEMBER_ASSET_IMPORT_BATCH' && metadata) {
    const successCount = toNumber(metadata.successCount);
    const failedCount = toNumber(metadata.failedCount);
    if (successCount !== null && successCount > 0) {
      badges.push({ key: 'success', label: `成功 ${successCount}`, color: 'success' });
    }
    if (failedCount !== null && failedCount > 0) {
      badges.push({ key: 'failed', label: `失败 ${failedCount}`, color: 'warning' });
    }
  }

  if (record.targetType === 'SUPPLEMENT_REQUEST' && metadata) {
    const action = toText(metadata.action);
    if (action === 'APPROVE') {
      badges.push({ key: 'review', label: '已通过', color: 'success' });
    } else if (action === 'REJECT') {
      badges.push({ key: 'review', label: '已驳回', color: 'error' });
    }
  }

  if (badges.length > 0) {
    return badges;
  }

  return getActionFallbackBadges(record.action);
}

function buildDetail(
  record: AuditLogRecord,
  metadata: RecordLike | null,
  mode: AuditDetailMode,
): string {
  if (!metadata) {
    return '-';
  }

  const memberName = toText(metadata.memberName) ?? toText(metadata.targetMemberName);
  const category = toText(formatMetadataValue(metadata.category));

  if (record.targetType === 'MEMBER_ASSET_IMPORT_BATCH') {
    const totalCount = toNumber(metadata.totalCount);
    const successCount = toNumber(metadata.successCount);
    const failedCount = toNumber(metadata.failedCount);
    const parts = [
      memberName ? `成员：${memberName}` : null,
      mode === 'full' && category && category !== '-' ? `类型：${category}` : null,
      totalCount !== null ? `共 ${totalCount} 项` : null,
      successCount !== null ? `成功 ${successCount} 项` : null,
      failedCount !== null ? `失败 ${failedCount} 项` : null,
    ].filter(Boolean);
    return parts.join('，') || '-';
  }

  if (record.targetType === 'MEMBER_ASSET_BATCH') {
    const actionText = toText(formatMetadataValue(metadata.action));
    const affectedCount = toNumber(metadata.affectedCount) ?? toNumber(metadata.count);
    const parts = [
      actionText ? `批量操作：${actionText}` : null,
      affectedCount !== null ? `影响 ${affectedCount} 项` : null,
      memberName ? `成员：${memberName}` : null,
    ].filter(Boolean);
    return parts.join('，') || '-';
  }

  if (record.targetType === 'MEMBER_IMPORT') {
    const createdCount = toNumber(metadata.createdCount);
    const fileName = toText(metadata.fileName);
    const parts = [
      createdCount !== null ? `成功导入 ${createdCount} 位成员` : null,
      mode === 'full' && fileName ? `文件：${fileName}` : null,
    ].filter(Boolean);
    return parts.join('，') || '-';
  }

  if (record.targetType === 'SUPPLEMENT_REQUEST') {
    const requestType = toText(formatMetadataValue(metadata.requestType));
    const actionText = toText(formatMetadataValue(metadata.action));
    const reviewComment = toText(metadata.reviewComment);
    const parts = [
      requestType ? `申请类型：${requestType}` : null,
      actionText ? `处理结果：${actionText}` : null,
      reviewComment ? `备注：${reviewComment}` : null,
    ].filter(Boolean);
    return parts.join('，') || '-';
  }

  if (record.targetType === 'MEMBER' && metadata.quickRelativeType !== undefined) {
    const relation = toText(formatMetadataValue(metadata.quickRelativeType)) ?? '亲属';
    const linkedExisting = Boolean(metadata.linkedExistingMember);
    return linkedExisting ? `补充${relation}关系（绑定已有成员）` : `补充${relation}关系`;
  }

  if (mode === 'compact') {
    return '-';
  }

  const conciseKeys = [
    'memberName',
    'requestType',
    'action',
    'category',
    'sourceType',
    'source',
    'tags',
    'reviewComment',
    'quickRelativeType',
  ];
  const conciseEntries = conciseKeys
    .map((key) => [key, metadata[key]] as const)
    .filter(([, value]) => value !== undefined && value !== null && value !== '');

  if (conciseEntries.length > 0) {
    return conciseEntries
      .map(([key, value]) => `${metadataLabelMap[key] ?? key}：${formatMetadataValue(value)}`)
      .join('；');
  }

  return formatMetadata(metadata);
}

export function getAuditDetailView(record: AuditLogRecord, mode: AuditDetailMode = 'full'): AuditDetailView {
  const metadata = toRecord(record.metadata);
  return {
    detail: buildDetail(record, metadata, mode),
    badges: buildBadges(record, metadata),
  };
}
