'use client';

import { Empty, Spin } from 'antd';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { GraphData } from '@/lib/types';

function formatEdgeLabel(edge: GraphData['edges'][number]) {
  if (edge.type === 'marriage') {
    return '配偶';
  }

  return edge.label;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatGender(gender: GraphData['nodes'][number]['gender']) {
  return gender === 'MALE' ? '男' : gender === 'FEMALE' ? '女' : '未知';
}

function formatLifeStatus(status: GraphData['nodes'][number]['lifeStatus']) {
  return status === 'ALIVE' ? '在世' : status === 'DECEASED' ? '已故' : '未知';
}

function getNodeSize(node: GraphData['nodes'][number], highlighted: boolean) {
  const nameLength = Array.from(node.label).length;

  if (node.isCenter) {
    return Math.max(76, nameLength >= 4 ? 84 : 76);
  }

  if (highlighted) {
    return Math.max(64, nameLength >= 4 ? 72 : 64);
  }

  return Math.max(56, nameLength >= 4 ? 68 : nameLength >= 3 ? 62 : 56);
}

export interface GraphViewerHandle {
  fitView: () => void;
}

export const GraphViewer = forwardRef<
  GraphViewerHandle,
  {
    data?: GraphData;
    loading?: boolean;
    onNodeClick?: (id: string) => void;
    highlightedNodeIds?: string[];
    highlightedEdgeIds?: string[];
    targetNodeId?: string;
  }
>(function GraphViewer(
  {
    data,
    loading,
    onNodeClick,
    highlightedNodeIds = [],
    highlightedEdgeIds = [],
    targetNodeId,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<{
    destroy?: () => void;
    render?: () => Promise<void>;
    fitView?: () => void;
    on?: (name: string, cb: (event: unknown) => void) => void;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    fitView: () => {
      graphRef.current?.fitView?.();
    },
  }));

  useEffect(() => {
    setError(null);
  }, [data, highlightedEdgeIds, highlightedNodeIds, targetNodeId]);

  useEffect(() => {
    if (!data || !containerRef.current) {
      return;
    }

    let destroyed = false;

    const renderGraph = async () => {
      try {
        const { Graph } = await import('@antv/g6');
        if (destroyed || !containerRef.current) {
          return;
        }

        graphRef.current = new Graph({
          container: containerRef.current,
          autoResize: true,
          data: {
            nodes: data.nodes.map((node) => {
              const isDeceased = node.lifeStatus === 'DECEASED';
              const isPathNode = highlightedNodeIds.includes(node.id);
              const isTargetNode = targetNodeId === node.id;
              const isSpecialNode = isPathNode || isTargetNode;

              return {
                id: node.id,
                data: {
                  label: node.label,
                  gender: node.gender,
                  lifeStatus: node.lifeStatus,
                  generationName: node.generationName,
                  isCenter: node.isCenter,
                  isTarget: isTargetNode,
                },
                style: {
                  labelText: node.label,
                  size: getNodeSize(node, isSpecialNode),
                  fill: isDeceased
                    ? node.isCenter
                      ? '#6f6f6f'
                      : '#8e8e8e'
                    : node.isCenter
                      ? '#7b1f1f'
                      : isTargetNode
                        ? '#0f766e'
                        : node.gender === 'MALE'
                          ? '#4c78a8'
                          : '#d66a7b',
                  stroke: isPathNode ? '#fbbf24' : isDeceased ? '#e3ddd3' : '#f3e6d0',
                  lineWidth: node.isCenter ? 4 : isSpecialNode ? 4 : 2,
                  labelFill: '#fffaf0',
                  labelFontSize: node.isCenter ? 16 : isSpecialNode ? 13 : 13,
                  labelFontWeight: 700,
                  labelLineWidth: isSpecialNode ? 5 : 4,
                  labelStroke: 'rgba(48, 32, 18, 0.38)',
                  labelPlacement: 'center',
                  labelOffsetX: 0,
                  labelOffsetY: 0,
                  labelMaxWidth: '92%',
                  labelWordWrap: false,
                  labelTextAlign: 'center',
                  labelTextBaseline: 'middle',
                },
              };
            }),
            edges: data.edges.map((edge) => {
              const isMarriage = edge.type === 'marriage';
              const isSibling = edge.type === 'sibling';
              const isHighlighted = highlightedEdgeIds.includes(edge.id);

              return {
                id: edge.id,
                source: edge.source,
                target: edge.target,
                type: isMarriage ? 'line' : 'quadratic',
                style: {
                  labelText: formatEdgeLabel(edge),
                  labelBackground: true,
                  stroke: isHighlighted ? '#b45309' : '#c7ae87',
                  lineWidth: isHighlighted ? 3.5 : isMarriage ? 2.5 : 1.5,
                  curveOffset: isSibling ? 22 : isMarriage ? 0 : 10,
                  endArrow: !isMarriage,
                  startArrow: isMarriage,
                  endArrowFill: isHighlighted ? '#b45309' : '#8a704f',
                  startArrowFill: isHighlighted ? '#b45309' : '#8a704f',
                  labelFill: isHighlighted ? '#7c2d12' : '#5a3d28',
                  labelBackgroundFill: isHighlighted
                    ? 'rgba(255, 247, 213, 0.96)'
                    : 'rgba(255, 248, 236, 0.9)',
                  labelBackgroundRadius: 6,
                  labelBackgroundPadding: [3, 6, 3, 6],
                  labelFontSize: 12,
                  labelFontWeight: 700,
                  labelPlacement: 'center',
                  labelOffsetX: 0,
                  labelOffsetY: isMarriage ? -12 : isSibling ? 12 : -8,
                  labelAutoRotate: false,
                },
              };
            }),
          },
          layout: {
            type: 'force',
            preventOverlap: true,
            linkDistance: 165,
          },
          plugins: [
            {
              type: 'tooltip',
              trigger: 'hover',
              enable: (_event: unknown, items: Array<{ data?: Record<string, unknown> }>) =>
                Boolean(items[0]?.data?.label),
              getContent: async (_event: unknown, items: Array<{ data?: Record<string, unknown> }>) => {
                const item = items[0]?.data;
                if (!item) {
                  return '';
                }

                const label = String(item.label ?? '');
                const gender = item.gender as GraphData['nodes'][number]['gender'];
                const lifeStatus = item.lifeStatus as GraphData['nodes'][number]['lifeStatus'];
                const generationName = item.generationName ? String(item.generationName) : '未填写';
                const roleTags = [
                  item.isCenter ? '中心人物' : null,
                  item.isTarget ? '路径目标' : null,
                ].filter(Boolean);

                return `
                  <div class="graph-node-tooltip">
                    <div class="graph-node-tooltip-name">${escapeHtml(label)}</div>
                    <div class="graph-node-tooltip-meta">${escapeHtml(formatGender(gender))} · 生命状态：${escapeHtml(formatLifeStatus(lifeStatus))}</div>
                    <div class="graph-node-tooltip-meta">代际：${escapeHtml(generationName)}</div>
                    ${
                      roleTags.length
                        ? `<div class="graph-node-tooltip-tags">${roleTags
                            .map((tag) => `<span>${escapeHtml(String(tag))}</span>`)
                            .join('')}</div>`
                        : ''
                    }
                  </div>
                `;
              },
            },
          ],
          behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
        } as never);

        graphRef.current.on?.('node:click', (event: unknown) => {
          const payload = event as {
            data?: { target?: { id?: string }; data?: { id?: string } };
            target?: { id?: string; attributes?: { id?: string } };
          };
          const nodeId =
            payload.data?.data?.id ??
            payload.data?.target?.id ??
            payload.target?.id ??
            payload.target?.attributes?.id;

          if (nodeId) {
            onNodeClick?.(nodeId);
          }
        });

        await graphRef.current.render?.();
        graphRef.current.fitView?.();
      } catch (renderError) {
        setError(renderError instanceof Error ? renderError.message : '图谱渲染失败');
      }
    };

    void renderGraph();

    return () => {
      destroyed = true;
      graphRef.current?.destroy?.();
      graphRef.current = null;
    };
  }, [data, highlightedEdgeIds, highlightedNodeIds, onNodeClick, targetNodeId]);

  if (loading) {
    return (
      <div className="page-center graph-panel">
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="graph-panel page-center">
        <Empty description={error} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="graph-panel page-center">
        <Empty description="请选择中心成员开始浏览关系图谱" />
      </div>
    );
  }

  return <div ref={containerRef} className="graph-panel" />;
});
