'use client';

import { Empty, Spin } from 'antd';
import { useEffect, useRef, useState } from 'react';
import type { GraphData } from '@/lib/types';

function formatEdgeLabel(edge: GraphData['edges'][number]) {
  if (edge.type === 'marriage') {
    return '配偶';
  }

  return edge.label;
}

export function GraphViewer({
  data,
  loading,
  onNodeClick,
  highlightedNodeIds = [],
  highlightedEdgeIds = [],
  targetNodeId,
}: {
  data?: GraphData;
  loading?: boolean;
  onNodeClick?: (id: string) => void;
  highlightedNodeIds?: string[];
  highlightedEdgeIds?: string[];
  targetNodeId?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data || !containerRef.current) {
      return;
    }

    let destroyed = false;
    let graph: {
      destroy?: () => void;
      render?: () => Promise<void>;
      fitView?: () => void;
      on?: (name: string, cb: (event: unknown) => void) => void;
    } | null = null;

    const renderGraph = async () => {
      try {
        const { Graph } = await import('@antv/g6');
        if (destroyed || !containerRef.current) {
          return;
        }

        graph = new Graph({
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
                style: {
                  labelText: node.label,
                  size: node.isCenter ? 72 : 52,
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
                  labelFontSize: node.isCenter ? 16 : isSpecialNode ? 14 : 13,
                  labelFontWeight: 700,
                  labelLineWidth: isSpecialNode ? 5 : 4,
                  labelStroke: 'rgba(48, 32, 18, 0.38)',
                  labelPlacement: 'center',
                  labelOffsetX: 0,
                  labelOffsetY: 0,
                  labelMaxWidth: '78%',
                  labelWordWrap: true,
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
            linkDistance: 150,
          },
          behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
        } as never);

        graph.on?.('node:click', (event: unknown) => {
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

        await graph.render?.();
        graph.fitView?.();
      } catch (renderError) {
        setError(renderError instanceof Error ? renderError.message : '图谱渲染失败');
      }
    };

    void renderGraph();

    return () => {
      destroyed = true;
      graph?.destroy?.();
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
        <Empty description="请选择一个成员开始浏览关系图谱" />
      </div>
    );
  }

  return <div ref={containerRef} className="graph-panel" />;
}
