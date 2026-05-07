'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, Input, Table, Typography } from 'antd';
import { useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';

const { Title, Text } = Typography;

const auditActionLabelMap: Record<string, string> = {
  LOGIN: '登录',
  LOGOUT: '退出登录',
  CREATE: '新增',
  UPDATE: '更新',
  DELETE: '删除',
  RESTORE: '恢复',
  EXPORT: '导出',
  UPLOAD_PHOTO: '上传照片',
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

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatMetadataValue(item)).join('、') || '-';
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(
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
  if (!value || typeof value !== 'object') {
    return '-';
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, itemValue]) => itemValue !== undefined && itemValue !== null && itemValue !== '',
  );
  if (entries.length === 0) {
    return '-';
  }
  return entries
    .map(([key, itemValue]) => `${metadataLabelMap[key] ?? key}：${formatMetadataValue(itemValue)}`)
    .join('；');
}

export default function AuditLogsPage() {
  const [keyword, setKeyword] = useState('');

  const logsQuery = useQuery({
    queryKey: ['audit-logs', keyword],
    queryFn: () => api.getAuditLogs({ page: 1, pageSize: 50, keyword }),
  });

  return (
    <AuthGuard requireAdmin>
      <div className="page-stack">
        <Card className="soft-panel">
          <Title level={3} style={{ marginBottom: 8 }}>
            操作日志
          </Title>
          <Text type="secondary">
            记录登录、成员编辑、头像上传、婚姻关系变更、权限调整等关键操作。
          </Text>
        </Card>

        <Card className="soft-panel">
          <Input.Search
            allowClear
            placeholder="搜索操作人 / 对象类型 / 目标ID"
            onSearch={setKeyword}
            style={{ maxWidth: 320, marginBottom: 16 }}
          />
          <Table
            rowKey="id"
            loading={logsQuery.isLoading}
            dataSource={logsQuery.data?.data ?? []}
            scroll={{ x: 1080 }}
            columns={[
              {
                title: '时间',
                dataIndex: 'createdAt',
                render: (value: string) => formatDate(value, 'YYYY-MM-DD HH:mm:ss'),
              },
              {
                title: '操作人',
                dataIndex: ['operator', 'username'],
                render: (value?: string) => value ?? '-',
              },
              {
                title: '动作',
                dataIndex: 'action',
                render: (value: string) => auditActionLabelMap[value] ?? value,
              },
              {
                title: '对象类型',
                dataIndex: 'targetType',
                render: (value: string) => auditTargetTypeLabelMap[value] ?? value,
              },
              {
                title: '目标ID',
                dataIndex: 'targetId',
                render: (value?: string | null) => value ?? '-',
              },
              {
                title: '附加信息',
                dataIndex: 'metadata',
                render: (value: unknown) => formatMetadata(value),
              },
            ]}
          />
        </Card>
      </div>
    </AuthGuard>
  );
}
