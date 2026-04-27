'use client';

import { ClockCircleOutlined } from '@ant-design/icons';
import { Card, Empty, Space, Tag, Timeline, Typography } from 'antd';
import { AuthGuard } from '@/components/auth-guard';
import { changelogEntries } from '@/lib/changelog';
import { formatDate } from '@/lib/format';
import type { ChangelogChangeType } from '@/lib/types';

const { Paragraph, Text, Title } = Typography;

const CHANGE_TAG_META: Record<ChangelogChangeType, { label: string; color: string }> = {
  feat: { label: 'feat 新增', color: 'blue' },
  fix: { label: 'fix 修复', color: 'red' },
  perf: { label: 'perf 优化', color: 'purple' },
  docs: { label: 'docs 文档', color: 'gold' },
  chore: { label: 'chore 维护', color: 'default' },
};

export default function ChangelogPage() {
  return (
    <AuthGuard>
      <div className="page-stack">
        <Card className="soft-panel">
          <Space direction="vertical" size={4}>
            <Title level={3} style={{ margin: 0 }}>
              版本更新日志
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              以时间线方式查看系统版本迭代记录与每次更新内容。
            </Paragraph>
          </Space>
        </Card>

        <Card className="soft-panel">
          {changelogEntries.length === 0 ? (
            <div className="changelog-empty">
              <Empty description="暂无版本更新记录" />
            </div>
          ) : (
            <Timeline
              className="changelog-timeline"
              items={changelogEntries.map((entry) => ({
                dot: <ClockCircleOutlined className="changelog-timeline-dot" />,
                children: (
                  <Card size="small" className="changelog-entry-card">
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      <div className="changelog-entry-header">
                        <Text strong className="changelog-entry-version">
                          {entry.version}
                        </Text>
                        <Tag color="processing">{formatDate(entry.releaseDate, 'YYYY-MM-DD')}</Tag>
                      </div>
                      <Text className="changelog-entry-summary">{entry.summary}</Text>
                      <div className="changelog-entry-changes">
                        <Text type="secondary">本次更新：</Text>
                        <ul>
                          {entry.changes.map((item) => (
                            <li key={`${item.type}-${item.content}`} className="changelog-change-item">
                              <Tag color={CHANGE_TAG_META[item.type].color} className="changelog-change-tag">
                                {CHANGE_TAG_META[item.type].label}
                              </Tag>
                              <span>{item.content}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Space>
                  </Card>
                ),
              }))}
            />
          )}
        </Card>
      </div>
    </AuthGuard>
  );
}
