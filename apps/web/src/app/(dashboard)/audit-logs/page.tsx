'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, Input, Table, Typography } from 'antd';
import { useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';

const { Title, Text } = Typography;

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
              { title: '动作', dataIndex: 'action' },
              { title: '对象类型', dataIndex: 'targetType' },
              {
                title: '目标ID',
                dataIndex: 'targetId',
                render: (value?: string | null) => value ?? '-',
              },
              {
                title: '附加信息',
                dataIndex: 'metadata',
                render: (value: unknown) => (value ? JSON.stringify(value) : '-'),
              },
            ]}
          />
        </Card>
      </div>
    </AuthGuard>
  );
}
