import type { AuditLogRecord } from './types';

const auditActionLabelMap: Record<string, string> = {
  LOGIN: '登录',
  LOGOUT: '退出登录',
  CREATE: '新增',
  UPDATE: '更新',
  DELETE: '删除',
  RESTORE: '恢复',
  EXPORT: '导出',
  UPLOAD_PHOTO: '上传',
  ROLE_CHANGE: '权限变更',
};

const auditTargetTypeLabelMap: Record<string, string> = {
  AUTH: '认证',
  USER: '用户',
  MEMBER: '成员',
  MARRIAGE: '婚姻关系',
  MEMBER_ASSET: '成员资料',
  MEMBER_ASSET_BATCH: '资料批量操作',
  MEMBER_ASSET_IMPORT_BATCH: '资料批量导入',
  MEMBER_EVENT: '成员时间线',
  MEMBER_IMPORT: '成员批量导入',
  ASSET_TAG: '资料标签',
  ASSET_SOURCE: '资料来源',
  KINSHIP_ALIAS: '称谓别名',
  INVITATION: '邀请',
  INVITATION_ACCEPT: '接受邀请',
  SUPPLEMENT_REQUEST: '变更申请',
};

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function pickText(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }
  return null;
}

function resolveNameFromSnapshot(snapshot: unknown): string | null {
  const record = toRecord(snapshot);
  if (!record) {
    return null;
  }
  return pickText(record.displayName, record.name, record.username, record.memberName);
}

function resolveNameFromMetadata(metadata: unknown): string | null {
  const record = toRecord(metadata);
  if (!record) {
    return null;
  }

  const targetMember = toRecord(record.targetMember);
  const relatedMember = toRecord(record.relatedMember);

  return pickText(
    record.memberName,
    record.targetMemberName,
    record.relatedMemberName,
    targetMember?.name,
    relatedMember?.name,
    record.username,
    record.displayName,
  );
}

export function getAuditActionLabel(action: string) {
  return auditActionLabelMap[action] ?? action;
}

export function getAuditTargetTypeLabel(targetType: string) {
  return auditTargetTypeLabelMap[targetType] ?? targetType;
}

export function getAuditOperatorName(log: AuditLogRecord) {
  return pickText(log.operator?.displayName, log.operator?.username) ?? '-';
}

export function getAuditTargetDisplay(log: AuditLogRecord) {
  const metadataName = resolveNameFromMetadata(log.metadata);
  const afterName = resolveNameFromSnapshot(log.after);
  const beforeName = resolveNameFromSnapshot(log.before);
  const preferredName = pickText(metadataName, afterName, beforeName);

  if (log.targetType === 'MEMBER') {
    if (preferredName) {
      return preferredName;
    }
    return log.targetId ? `成员(${log.targetId})` : '-';
  }

  if (log.targetType === 'USER') {
    if (preferredName) {
      return preferredName;
    }
    return log.targetId ? `用户(${log.targetId})` : '-';
  }

  if (preferredName) {
    return preferredName;
  }

  return log.targetId ?? '-';
}
