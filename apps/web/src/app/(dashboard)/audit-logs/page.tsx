'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, Input, Space, Table, Tag, Typography } from 'antd';
import { useState, type ReactNode } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { api } from '@/lib/api';
import { getAuditDetailView } from '@/lib/audit-log-detail-display';
import {
  getAuditActionLabel,
  getAuditOperatorName,
  getAuditTargetDisplay,
  getAuditTargetTypeLabel,
} from '@/lib/audit-log-display';
import { formatDate } from '@/lib/format';
import type { AuditLogRecord } from '@/lib/types';

const { Title, Text } = Typography;

function renderAuditDetail(record: AuditLogRecord): ReactNode {
  const { detail, badges } = getAuditDetailView(record, 'full');

  if (badges.length === 0) {
    return detail;
  }

  return (
    <Space size={[6, 6]} wrap>
      {badges.map((badge) => (
        <Tag key={`${record.id}-${badge.key}`} color={badge.color}>
          {badge.label}
        </Tag>
      ))}
      <span>{detail}</span>
    </Space>
  );
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
            placeholder="搜索操作人 / 动作 / 对象"
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
                render: (_: unknown, record) => getAuditOperatorName(record),
              },
              {
                title: '动作',
                dataIndex: 'action',
                render: (value: string) => getAuditActionLabel(value),
              },
              {
                title: '对象',
                dataIndex: 'targetType',
                render: (value: string) => getAuditTargetTypeLabel(value),
              },
              {
                title: '目标对象',
                render: (_: unknown, record) => getAuditTargetDisplay(record),
              },
              {
                title: '操作详情',
                render: (_: unknown, record: AuditLogRecord) => renderAuditDetail(record),
              },
            ]}
          />
        </Card>
      </div>
    </AuthGuard>
  );
}
