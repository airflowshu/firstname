'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Space, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { GraphViewer } from '@/components/graph-viewer';
import { RemoteMemberSelect } from '@/components/remote-member-select';
import { api } from '@/lib/api';

const { Paragraph, Text, Title } = Typography;

export default function GraphPage() {
  const [centerId, setCenterId] = useState<string>();

  useEffect(() => {
    if (centerId) {
      return;
    }

    api.getMemberOptions().then((result) => {
      if (result[0]) {
        setCenterId(result[0].id);
      }
    });
  }, [centerId]);

  const graphQuery = useQuery({
    queryKey: ['graph', centerId],
    queryFn: () => api.getGraph(centerId!, 2),
    enabled: Boolean(centerId),
  });

  const centerNode = graphQuery.data?.nodes.find((node) => node.isCenter);

  return (
    <AuthGuard>
      <div className="page-stack">
        <Card className="soft-panel">
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} lg={12}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Title level={3} style={{ margin: 0 }}>
                  人员节点图谱
                </Title>
                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  搜索成员后即可查看中心人物关系图谱；点击任意节点，会自动切换为新的中心人物并重新布局。
                </Paragraph>
              </Space>
            </Col>
            <Col xs={24} lg={12}>
              <RemoteMemberSelect
                value={centerId}
                placeholder="搜索成员并切换图谱中心"
                onChange={(value) => setCenterId(value)}
              />
            </Col>
          </Row>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={17}>
            <GraphViewer
              data={graphQuery.data}
              loading={graphQuery.isLoading}
              onNodeClick={(id) => setCenterId(id)}
            />
          </Col>
          <Col xs={24} xl={7}>
            <Card className="soft-panel graph-summary-card">
              <Space direction="vertical" size={12}>
                <Title level={4} style={{ margin: 0 }} className="graph-summary-title">
                  当前中心成员
                </Title>
                <Text strong className="graph-summary-name">
                  {centerNode?.label ?? '未选择成员'}
                </Text>
                {centerNode ? (
                  <>
                    <Tag
                      color={
                        centerNode.gender === 'MALE'
                          ? 'blue'
                          : centerNode.gender === 'FEMALE'
                            ? 'magenta'
                            : 'default'
                      }
                    >
                      {centerNode.gender === 'MALE'
                        ? '男'
                        : centerNode.gender === 'FEMALE'
                          ? '女'
                          : '未知'}
                    </Tag>
                    <Text className="graph-summary-meta">
                      生命状态：
                      {centerNode.lifeStatus === 'ALIVE'
                        ? '在世'
                        : centerNode.lifeStatus === 'DECEASED'
                          ? '已故'
                          : '未知'}
                    </Text>
                    <Text className="graph-summary-meta">
                      代际：{centerNode.generationName ?? '未填写'}
                    </Text>
                    <Text className="graph-summary-stat">
                      已渲染节点 {graphQuery.data?.nodes.length ?? 0} 个，边{' '}
                      {graphQuery.data?.edges.length ?? 0} 条
                    </Text>
                  </>
                ) : (
                  <Text className="graph-summary-meta">
                    左侧图谱选中节点后，这里会展示当前中心人物的摘要。
                  </Text>
                )}
              </Space>
            </Card>
          </Col>
        </Row>
      </div>
    </AuthGuard>
  );
}
