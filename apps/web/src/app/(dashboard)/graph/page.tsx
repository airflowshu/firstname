'use client';

import {
  AimOutlined,
  ApartmentOutlined,
  DeploymentUnitOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  InfoCircleOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Col,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useViewportMode } from '@/hooks/use-viewport-mode';
import { AuthGuard } from '@/components/auth-guard';
import { GraphViewer, type GraphViewerHandle } from '@/components/graph-viewer';
import { RemoteMemberSelect } from '@/components/remote-member-select';
import { api, ApiError } from '@/lib/api';
import type { MemberKinshipResponse } from '@/lib/types';

const { Paragraph, Text, Title } = Typography;

const depthOptions = [
  { label: '两层关系', value: 2 },
  { label: '三层关系', value: 3 },
  { label: '四层关系', value: 4 },
  { label: '五层关系', value: 5 },
  { label: '六层关系', value: 6 },
];

const graphLegend = [
  { type: 'dot', label: '中心人物', style: { background: '#7b1f1f' } },
  { type: 'dot', label: '路径目标', style: { background: '#0f766e' } },
  { type: 'dot', label: '男性', style: { background: '#4c78a8' } },
  { type: 'dot', label: '女性', style: { background: '#d66a7b' } },
  { type: 'dot', label: '已故', style: { background: '#8e8e8e' } },
  { type: 'line', label: '婚姻关系', style: { background: '#8a704f' } },
  { type: 'line', label: '血缘路径', style: { background: '#b45309' } },
];

export default function GraphPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMobile } = useViewportMode();
  const graphRef = useRef<GraphViewerHandle | null>(null);
  const graphShellRef = useRef<HTMLDivElement | null>(null);
  const [centerId, setCenterId] = useState<string | undefined>(searchParams.get('memberId') ?? undefined);
  const [compareId, setCompareId] = useState<string | undefined>(searchParams.get('compareId') ?? undefined);
  const [graphDepth, setGraphDepth] = useState<number>(Number(searchParams.get('depth') ?? 3));
  const [relationResult, setRelationResult] = useState<MemberKinshipResponse>();
  const [helpOpen, setHelpOpen] = useState(false);
  const [graphRevision, setGraphRevision] = useState(0);
  const [isGraphFullscreen, setIsGraphFullscreen] = useState(false);

  useEffect(() => {
    setCenterId(searchParams.get('memberId') ?? undefined);
    setCompareId(searchParams.get('compareId') ?? undefined);
    setGraphDepth(Math.max(2, Math.min(6, Number(searchParams.get('depth') ?? 3))));
  }, [searchParams]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsGraphFullscreen(document.fullscreenElement === graphShellRef.current);
      window.setTimeout(() => graphRef.current?.fitView(), 120);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const updateSearchParams = (patch: Record<string, string | undefined>) => {
    const nextParams = new URLSearchParams(searchParams.toString());

    Object.entries(patch).forEach(([key, value]) => {
      if (value) {
        nextParams.set(key, value);
      } else {
        nextParams.delete(key);
      }
    });

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  };

  const toggleGraphFullscreen = async () => {
    if (!graphShellRef.current) {
      return;
    }

    if (document.fullscreenElement === graphShellRef.current) {
      await document.exitFullscreen();
      return;
    }

    await graphShellRef.current.requestFullscreen();
  };

  const memberCalcMutation = useMutation({
    mutationFn: () =>
      api.calcMemberKinship({ sourceMemberId: centerId!, targetMemberId: compareId! }),
    onSuccess: (result) => setRelationResult(result),
    onError: (error) =>
      message.error(error instanceof ApiError ? error.message : '关系路径计算失败'),
  });

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

  const summaryCard = (
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
            <Text className="graph-summary-meta">代际：{centerNode.generationName ?? '未填写'}</Text>
            <Text className="graph-summary-stat">
              已渲染节点 {graphQuery.data?.nodes.length ?? 0} 个，边 {graphQuery.data?.edges.length ?? 0}{' '}
              条
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
            ) : (
              <Text className="graph-summary-meta">
                先选择第二成员并计算关系路径，右侧会给出双向称呼和路径说明。
              </Text>
            )}
          </>
        ) : (
          <Text className="graph-summary-meta">
            先搜索并选择中心成员，再开始浏览关系图谱和路径关系。
          </Text>
        )}
      </Space>
    </Card>
  );

  return (
    <AuthGuard>
      <div className="page-stack">
        <Card className="soft-panel">
          <div className="page-hero">
            <div className="page-hero-copy">
              <div className="page-eyebrow">Graph Explorer</div>
              <Title level={3} className="page-hero-title">
                人员节点图谱
              </Title>
              <Paragraph className="page-hero-desc">
                先定中心人物，再逐步放大层级、追踪关系路径。图谱页现在更偏探索工具，而不是一次性展示全部关系。
              </Paragraph>
            </div>
            <div className="page-hero-actions">
              <Button icon={<InfoCircleOutlined />} onClick={() => setHelpOpen(true)}>
                查看说明
              </Button>
            </div>
          </div>
        </Card>

        <Card className="soft-panel">
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div className="filter-grid">
              <RemoteMemberSelect
                value={centerId}
                placeholder="选择图谱中心成员"
                onChange={(value) => {
                  setCenterId(value);
                  setRelationResult(undefined);
                  updateSearchParams({ memberId: value });
                }}
              />
              <RemoteMemberSelect
                value={compareId}
                placeholder="选择第二成员并高亮最短关系路径"
                disabledIds={centerId ? [centerId] : []}
                onChange={(value) => {
                  setCompareId(value);
                  setRelationResult(undefined);
                  updateSearchParams({ compareId: value });
                }}
              />
              <Select
                value={graphDepth}
                options={depthOptions}
                onChange={(value) => {
                  setGraphDepth(value);
                  setGraphRevision((current) => current + 1);
                  updateSearchParams({ depth: String(value) });
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
                    updateSearchParams({ compareId: undefined });
                  }}
                >
                  清除路径
                </Button>
              </Space>
            </div>

            <div className="graph-toolbar">
              <Text className="results-hint">
                当前层级：{graphDepth} 层。建议先用 2-3 层快速定位，再逐步放大范围。
              </Text>
            </div>

          </Space>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={isMobile ? 24 : 17}>
            <div
              ref={graphShellRef}
              className={`graph-canvas-shell${isGraphFullscreen ? ' is-fullscreen' : ''}`}
            >
              <div className="graph-canvas-toolbar">
                <Tooltip title="适配画布" placement="left">
                  <Button
                    aria-label="适配画布"
                    icon={<AimOutlined />}
                    onClick={() => graphRef.current?.fitView()}
                  />
                </Tooltip>
                <Tooltip title="重置视图" placement="left">
                  <Button
                    aria-label="重置视图"
                    icon={<UndoOutlined />}
                    onClick={() => setGraphRevision((current) => current + 1)}
                  />
                </Tooltip>
                <Tooltip title="图例说明" placement="left">
                  <Button
                    aria-label="图例说明"
                    icon={<DeploymentUnitOutlined />}
                    onClick={() => setHelpOpen(true)}
                  />
                </Tooltip>
                <Tooltip title={isGraphFullscreen ? '退出全屏' : '全屏'} placement="left">
                  <Button
                    aria-label={isGraphFullscreen ? '退出全屏' : '全屏'}
                    icon={isGraphFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                    onClick={() => {
                      void toggleGraphFullscreen();
                    }}
                  />
                </Tooltip>
              </div>
              <div className="graph-canvas-legend">
                {graphLegend.map((item) => (
                  <span key={item.label} className="graph-legend-item">
                    <span
                      className={item.type === 'dot' ? 'graph-legend-dot' : 'graph-legend-line'}
                      style={item.style}
                    />
                    <span>{item.label}</span>
                  </span>
                ))}
              </div>
              <GraphViewer
                key={`${centerId ?? 'empty'}-${graphDepth}-${graphRevision}`}
                ref={graphRef}
                data={graphQuery.data}
                loading={graphQuery.isLoading}
                highlightedNodeIds={highlightedNodeIds}
                highlightedEdgeIds={highlightedEdgeIds}
                targetNodeId={compareId}
                onNodeClick={(id) => {
                  setCenterId(id);
                  setRelationResult(undefined);
                  updateSearchParams({ memberId: id });
                }}
              />
            </div>
          </Col>
          {!isMobile ? <Col xs={24} xl={7}>{summaryCard}</Col> : null}
        </Row>

        {isMobile ? summaryCard : null}

        <Modal
          title="图谱使用说明"
          open={helpOpen}
          footer={null}
          onCancel={() => setHelpOpen(false)}
        >
          <Space direction="vertical" size={12}>
            <Text>1. 先搜索中心人物，再决定是否需要选择第二成员来高亮路径。</Text>
            <Text>2. 默认建议从 2-3 层开始，避免一次渲染过多节点导致信息噪音。</Text>
            <Text>3. 适配画布用于把当前节点重新放回可视区域，重置视图会重新布局。</Text>
            <Text>4. 点击任意节点会将其切换为新的中心成员，适合顺着关系继续探索。</Text>
            <Button type="link" style={{ padding: 0 }}>
              <Link href="/kinship">
                <ApartmentOutlined /> 去称呼计算页继续查看更完整的双向称呼结果
              </Link>
            </Button>
          </Space>
        </Modal>
      </div>
    </AuthGuard>
  );
}
