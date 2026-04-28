'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { App, Button, Card, Col, Row, Space, Tag, Typography } from 'antd';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { GraphViewer } from '@/components/graph-viewer';
import { RemoteMemberSelect } from '@/components/remote-member-select';
import { api, ApiError } from '@/lib/api';
import type { MemberKinshipResponse } from '@/lib/types';

const { Paragraph, Text, Title } = Typography;

export default function GraphPage() {
  const { message } = App.useApp();
  const [centerId, setCenterId] = useState<string>();
  const [compareId, setCompareId] = useState<string>();
  const [relationResult, setRelationResult] = useState<MemberKinshipResponse>();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const initialCenterId = params.get('memberId') ?? undefined;
    const initialCompareId = params.get('compareId') ?? undefined;

    if (initialCenterId) {
      setCenterId((current) => current ?? initialCenterId);
    }

    if (initialCompareId) {
      setCompareId((current) => current ?? initialCompareId);
    }
  }, []);

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

  const memberCalcMutation = useMutation({
    mutationFn: () =>
      api.calcMemberKinship({ sourceMemberId: centerId!, targetMemberId: compareId! }),
    onSuccess: (result) => setRelationResult(result),
    onError: (error) =>
      message.error(error instanceof ApiError ? error.message : '关系路径计算失败'),
  });

  const graphDepth = useMemo(() => {
    const pathLength = relationResult?.sourceToTarget.pathIds?.length ?? 0;
    return Math.max(2, Math.min(6, pathLength > 0 ? pathLength - 1 : 2));
  }, [relationResult]);

  const graphQuery = useQuery({
    queryKey: ['graph', centerId, graphDepth],
    queryFn: () => api.getGraph(centerId!, graphDepth),
    enabled: Boolean(centerId),
  });

  const centerNode = graphQuery.data?.nodes.find((node) => node.isCenter);
  const highlightedNodeIds = relationResult?.sourceToTarget.pathIds ?? [];
  const highlightedEdgeIds = useMemo(() => {
    const pathIds = relationResult?.sourceToTarget.pathIds ?? [];

    return pathIds.slice(0, -1).map((sourceId, index) => {
      const targetId = pathIds[index + 1];
      return [sourceId, targetId].sort().join(':');
    });
  }, [relationResult]);

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
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <RemoteMemberSelect
                  value={centerId}
                  placeholder="选择图谱中心成员"
                  onChange={(value) => {
                    setCenterId(value);
                    setRelationResult(undefined);
                  }}
                />
                <RemoteMemberSelect
                  value={compareId}
                  placeholder="选择第二成员并高亮最短关系路径"
                  disabledIds={centerId ? [centerId] : []}
                  onChange={(value) => {
                    setCompareId(value);
                    setRelationResult(undefined);
                  }}
                />
                <Space wrap>
                  <Button
                    type="primary"
                    disabled={!centerId || !compareId}
                    loading={memberCalcMutation.isPending}
                    onClick={() => {
                      if (!centerId || !compareId) {
                        message.warning('请先选择两位成员后再计算关系路径');
                        return;
                      }

                      memberCalcMutation.mutate();
                    }}
                  >
                    高亮关系路径
                  </Button>
                  <Button
                    onClick={() => {
                      setCompareId(undefined);
                      setRelationResult(undefined);
                    }}
                  >
                    清除路径
                  </Button>
                </Space>
              </Space>
            </Col>
          </Row>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={17}>
            <GraphViewer
              data={graphQuery.data}
              loading={graphQuery.isLoading}
              highlightedNodeIds={highlightedNodeIds}
              highlightedEdgeIds={highlightedEdgeIds}
              targetNodeId={compareId}
              onNodeClick={(id) => {
                setCenterId(id);
                setRelationResult(undefined);
              }}
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
                    {relationResult ? (
                      <>
                        <div className="graph-summary-divider" />
                        <Text strong className="graph-summary-title">
                          路径关系结果
                        </Text>
                        <Text className="graph-summary-meta">
                          {relationResult.source.name} 如何称呼 {relationResult.target.name}：
                          {relationResult.sourceToTarget.displayTerm}
                        </Text>
                        <Text className="graph-summary-meta">
                          {relationResult.target.name} 如何称呼 {relationResult.source.name}：
                          {relationResult.targetToSource.displayTerm}
                        </Text>
                        <Text className="graph-summary-meta">
                          关系路径：{relationResult.sourceToTarget.chainText}
                        </Text>
                        <Text className="graph-summary-stat">
                          已高亮 {relationResult.sourceToTarget.pathIds?.length ?? 0} 个路径节点
                        </Text>
                        <Button type="link" style={{ padding: 0 }}>
                          <Link
                            href={`/kinship?left=${relationResult.source.id}&right=${relationResult.target.id}`}
                          >
                            去称呼计算页查看完整结果
                          </Link>
                        </Button>
                      </>
                    ) : null}
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
