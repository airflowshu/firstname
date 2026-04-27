'use client';

import { ClockCircleOutlined, TeamOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, List, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import { AuthGuard } from '@/components/auth-guard';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';

const { Text, Title } = Typography;

export default function DashboardPage() {
  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: api.getDashboardSummary,
  });

  const summary = summaryQuery.data;

  return (
    <AuthGuard>
      <div className="page-stack">
        <Card className="soft-panel">
          <Space direction="vertical" size={4}>
            <Title level={3} style={{ margin: 0 }}>
              首页统计
            </Title>
            <Text type="secondary">快速掌握当前家族谱系录入进度、代际结构和最近操作变化。</Text>
          </Space>
        </Card>

        <Row gutter={[16, 16]}>
          {[
            ['成员总数', summary?.stats.totalMembers, <TeamOutlined key="team" />],
            ['男性人数', summary?.stats.maleMembers, null],
            ['女性人数', summary?.stats.femaleMembers, null],
            ['在世成员', summary?.stats.aliveMembers, null],
            ['已故成员', summary?.stats.deceasedMembers, null],
            ['代际数量', summary?.stats.generationCount, null],
            ['婚配关系', summary?.stats.marriageCount, null],
          ].map(([title, value, icon]) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={String(title)}>
              <Card loading={summaryQuery.isLoading} className="stat-card">
                <Statistic
                  title={title as string}
                  value={value as number | undefined}
                  prefix={icon}
                />
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={10}>
            <Card
              title="最近新增成员"
              className="soft-panel"
              loading={summaryQuery.isLoading}
              extra={<Tag color="processing">最新 5 条</Tag>}
            >
              <List
                dataSource={summary?.recentMembers ?? []}
                locale={{ emptyText: '暂无新增成员记录' }}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<ClockCircleOutlined />}
                      title={item.name}
                      description={`${item.gender === 'MALE' ? '男' : item.gender === 'FEMALE' ? '女' : '未知'} · 创建于 ${formatDate(item.createdAt, 'YYYY-MM-DD HH:mm')}`}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col xs={24} lg={14}>
            <Card title="最近操作日志" className="soft-panel" loading={summaryQuery.isLoading}>
              <Table
                rowKey="id"
                pagination={false}
                size="small"
                dataSource={summary?.recentLogs ?? []}
                columns={[
                  {
                    title: '时间',
                    dataIndex: 'createdAt',
                    render: (value: string) => formatDate(value, 'MM-DD HH:mm'),
                  },
                  {
                    title: '操作人',
                    dataIndex: ['operator', 'username'],
                    render: (value?: string) => value ?? '-',
                  },
                  { title: '动作', dataIndex: 'action' },
                  { title: '对象', dataIndex: 'targetType' },
                  {
                    title: '目标ID',
                    dataIndex: 'targetId',
                    render: (value?: string | null) => value ?? '-',
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </div>
    </AuthGuard>
  );
}
