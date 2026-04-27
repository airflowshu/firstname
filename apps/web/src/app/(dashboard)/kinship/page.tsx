'use client';

import { useMutation } from '@tanstack/react-query';
import { App, Button, Card, Col, Divider, Row, Select, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { RemoteMemberSelect } from '@/components/remote-member-select';
import { api, ApiError } from '@/lib/api';
import { kinshipTokenOptions } from '@/lib/constants';
import type { KinshipResult, MemberKinshipResponse } from '@/lib/types';

const { Paragraph, Text, Title } = Typography;

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
  const [leftMemberId, setLeftMemberId] = useState<string>();
  const [rightMemberId, setRightMemberId] = useState<string>();
  const [tokens, setTokens] = useState<string[]>([]);
  const [subjectGender, setSubjectGender] = useState<'MALE' | 'FEMALE' | 'UNKNOWN'>('MALE');
  const [memberResult, setMemberResult] = useState<MemberKinshipResponse>();
  const [pathResult, setPathResult] = useState<KinshipResult>();

  const memberCalcMutation = useMutation({
    mutationFn: () =>
      api.calcMemberKinship({ sourceMemberId: leftMemberId!, targetMemberId: rightMemberId! }),
    onSuccess: (result) => setMemberResult(result),
    onError: (error) =>
      message.error(error instanceof ApiError ? error.message : '成员称呼计算失败'),
  });

  const pathCalcMutation = useMutation({
    mutationFn: () => api.calcPathKinship({ tokens, subjectGender }),
    onSuccess: (result) => setPathResult(result),
    onError: (error) =>
      message.error(error instanceof ApiError ? error.message : '路径称呼计算失败'),
  });

  return (
    <AuthGuard>
      <div className="page-stack">
        <Card className="soft-panel">
          <Space direction="vertical" size={4}>
            <Title level={3} style={{ margin: 0 }}>
              亲戚称呼计算
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              支持“成员对成员”自动推算，也支持以“我”为起点的关系路径选择器计算。
            </Paragraph>
          </Space>
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
                      onChange={setLeftMemberId}
                      placeholder="例如：我"
                    />
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <div className="kinship-member-side kinship-member-side-right">
                    <div className="kinship-member-side-title">右侧成员（被称呼对象）</div>
                    <RemoteMemberSelect
                      value={rightMemberId}
                      onChange={setRightMemberId}
                      placeholder="例如：某位亲属"
                    />
                  </div>
                </Col>
              </Row>
              <Divider />
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
