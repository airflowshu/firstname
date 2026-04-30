'use client';

import { HistoryOutlined, LinkOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Col,
  Divider,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { RemoteMemberSelect } from '@/components/remote-member-select';
import { api, ApiError } from '@/lib/api';
import { kinshipTokenOptions } from '@/lib/constants';
import type { KinshipResult, MemberKinshipResponse } from '@/lib/types';

const { Paragraph, Text, Title } = Typography;

const pathPresets = [
  { label: '父亲', tokens: ['F'] },
  { label: '母亲', tokens: ['M'] },
  { label: '爷爷', tokens: ['F', 'F'] },
  { label: '奶奶', tokens: ['F', 'M'] },
  { label: '外公', tokens: ['M', 'F'] },
  { label: '姐姐', tokens: ['OS'] },
];

function ResultCard({ title, result }: { title: string; result?: KinshipResult }) {
  return (
    <Card className="soft-panel" title={title}>
      {result ? (
        <Space direction="vertical" size={8}>
          <Text strong style={{ fontSize: 18 }}>
            {result.displayTerm}
          </Text>
          <Text type="secondary">标准称呼：{result.standardTerm}</Text>
          <Text type="secondary">家族称呼别名：{result.familyAlias ?? '未设置'}</Text>
          <Text type="secondary">关系路径：{result.chainText}</Text>
          <Text type="secondary">关系编码：{result.relationCode}</Text>
          {result.candidates.length > 1 ? (
            <div>
              <Text type="secondary">可能结果：</Text>
              <Space wrap style={{ marginTop: 8 }}>
                {result.candidates.map((item) => (
                  <Tag key={item}>{item}</Tag>
                ))}
              </Space>
            </div>
          ) : null}
        </Space>
      ) : (
        <Text type="secondary">请先完成一次计算。</Text>
      )}
    </Card>
  );
}

export default function KinshipPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [leftMemberId, setLeftMemberId] = useState<string | undefined>(
    searchParams.get('left') ?? undefined,
  );
  const [rightMemberId, setRightMemberId] = useState<string | undefined>(
    searchParams.get('right') ?? undefined,
  );
  const [tokens, setTokens] = useState<string[]>([]);
  const [subjectGender, setSubjectGender] = useState<'MALE' | 'FEMALE' | 'UNKNOWN'>('MALE');
  const [memberResult, setMemberResult] = useState<MemberKinshipResponse>();
  const [pathResult, setPathResult] = useState<KinshipResult>();
  const [recentSummary, setRecentSummary] = useState<string | null>(null);

  useEffect(() => {
    setLeftMemberId(searchParams.get('left') ?? undefined);
    setRightMemberId(searchParams.get('right') ?? undefined);
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setRecentSummary(window.localStorage.getItem('fisrtname:last-kinship-summary'));
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

  const memberCalcMutation = useMutation({
    mutationFn: () =>
      api.calcMemberKinship({ sourceMemberId: leftMemberId!, targetMemberId: rightMemberId! }),
    onSuccess: (result) => {
      setMemberResult(result);
      if (typeof window !== 'undefined') {
        const summary = `${result.source.name} -> ${result.target.name}：${result.sourceToTarget.displayTerm}`;
        window.localStorage.setItem('fisrtname:last-kinship-summary', summary);
        setRecentSummary(summary);
      }
    },
    onError: (error) =>
      message.error(error instanceof ApiError ? error.message : '成员称呼计算失败'),
  });

  const pathCalcMutation = useMutation({
    mutationFn: () => api.calcPathKinship({ tokens, subjectGender }),
    onSuccess: (result) => {
      setPathResult(result);
      if (typeof window !== 'undefined') {
        const summary = `路径 ${result.chainText}：${result.displayTerm}`;
        window.localStorage.setItem('fisrtname:last-kinship-summary', summary);
        setRecentSummary(summary);
      }
    },
    onError: (error) =>
      message.error(error instanceof ApiError ? error.message : '路径称呼计算失败'),
  });

  return (
    <AuthGuard>
      <div className="page-stack">
        <Card className="soft-panel">
          <div className="page-hero">
            <div className="page-hero-copy">
              <div className="page-eyebrow">Kinship Lab</div>
              <Title level={3} className="page-hero-title">
                亲戚称呼计算
              </Title>
              <Paragraph className="page-hero-desc">
                既可以按两位成员自动互算，也可以从“我”的角度逐步拼装关系路径，适合核对称呼和回看路径依据。
              </Paragraph>
            </div>
            <div className="page-hero-actions">
              {recentSummary ? (
                <Tag icon={<HistoryOutlined />} color="processing">
                  最近一次：{recentSummary}
                </Tag>
              ) : null}
            </div>
          </div>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <Card
              className="soft-panel"
              title="成员互算"
              extra={
                <Button
                  type="primary"
                  onClick={() => {
                    if (!leftMemberId || !rightMemberId) {
                      message.warning('请先选择左右两个成员');
                      return;
                    }

                    memberCalcMutation.mutate();
                  }}
                  loading={memberCalcMutation.isPending}
                >
                  开始计算
                </Button>
              }
            >
              <Row gutter={[12, 12]}>
                <Col xs={24} sm={12}>
                  <div className="kinship-member-side kinship-member-side-left">
                    <div className="kinship-member-side-title">左侧成员（称呼发起方）</div>
                    <RemoteMemberSelect
                      value={leftMemberId}
                      onChange={(value) => {
                        setLeftMemberId(value);
                        updateSearchParams({ left: value });
                      }}
                      placeholder="例如：我"
                    />
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <div className="kinship-member-side kinship-member-side-right">
                    <div className="kinship-member-side-title">右侧成员（被称呼对象）</div>
                    <RemoteMemberSelect
                      value={rightMemberId}
                      onChange={(value) => {
                        setRightMemberId(value);
                        updateSearchParams({ right: value });
                      }}
                      placeholder="例如：某位亲属"
                    />
                  </div>
                </Col>
              </Row>
              <Divider />
              {leftMemberId && rightMemberId ? (
                <Button type="link" style={{ padding: 0, marginBottom: 12 }}>
                  <Link href={`/graph?memberId=${leftMemberId}&compareId=${rightMemberId}`}>
                    <LinkOutlined /> 在图谱中查看两人关系路径
                  </Link>
                </Button>
              ) : null}
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <ResultCard
                    title="左侧成员如何称呼右侧成员"
                    result={memberResult?.sourceToTarget}
                  />
                </Col>
                <Col xs={24} md={12}>
                  <ResultCard
                    title="右侧成员如何称呼左侧成员"
                    result={memberResult?.targetToSource}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} xl={12}>
            <Card
              className="soft-panel"
              title="关系路径计算"
              extra={
                <Button
                  type="primary"
                  onClick={() => {
                    if (tokens.length === 0) {
                      message.warning('请先选择至少一个关系路径节点');
                      return;
                    }

                    pathCalcMutation.mutate();
                  }}
                  loading={pathCalcMutation.isPending}
                >
                  计算称呼
                </Button>
              }
            >
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Select
                  value={subjectGender}
                  onChange={setSubjectGender}
                  options={[
                    { label: '我（男性）', value: 'MALE' },
                    { label: '我（女性）', value: 'FEMALE' },
                    { label: '我（未知）', value: 'UNKNOWN' },
                  ]}
                />

                <div>
                  <Text type="secondary">常用预设：</Text>
                  <div className="kinship-preset-row" style={{ marginTop: 12 }}>
                    {pathPresets.map((preset) => (
                      <Button key={preset.label} onClick={() => setTokens(preset.tokens)}>
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Text type="secondary">逐步选择关系路径：</Text>
                  <Space wrap style={{ marginTop: 12 }}>
                    {kinshipTokenOptions.map((token) => (
                      <Button
                        key={token.value}
                        onClick={() => setTokens((current) => [...current, token.value])}
                      >
                        {token.label}
                      </Button>
                    ))}
                    <Button onClick={() => setTokens((current) => current.slice(0, -1))}>
                      回退一步
                    </Button>
                    <Button danger onClick={() => setTokens([])}>
                      清空路径
                    </Button>
                  </Space>
                </div>
                <Card size="small">
                  <Text strong>当前路径：</Text>
                  <div style={{ marginTop: 8 }}>
                    {tokens.length > 0
                      ? tokens
                          .map(
                            (token) =>
                              kinshipTokenOptions.find((item) => item.value === token)?.label ??
                              token,
                          )
                          .join(' 的 ')
                      : '暂无路径'}
                  </div>
                </Card>
                <ResultCard title="路径计算结果" result={pathResult} />
              </Space>
            </Card>
          </Col>
        </Row>
      </div>
    </AuthGuard>
  );
}
