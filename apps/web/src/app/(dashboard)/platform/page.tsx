'use client';

import {
  ArrowRightOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  Modal,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { useAuth } from '@/components/auth-provider';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type {
  DemoResetPreviewResponse,
  DemoResetResult,
  InvitationResult,
  PlatformFamilyRecord,
} from '@/lib/types';

const { Paragraph, Text, Title } = Typography;

const familyTypeMeta: Record<
  PlatformFamilyRecord['familyType'],
  { label: string; color: 'default' | 'blue' | 'purple' }
> = {
  STANDARD: { label: '普通家族', color: 'default' },
  DEMO: { label: '演示家族', color: 'blue' },
  TEMPLATE: { label: '模板家族', color: 'purple' },
};

export default function PlatformPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { switchFamily } = useAuth();
  const [resetFamily, setResetFamily] = useState<PlatformFamilyRecord | null>(null);
  const [confirmationText, setConfirmationText] = useState('');
  const familiesQuery = useQuery({
    queryKey: ['platform-families'],
    queryFn: api.getPlatformFamilies,
  });
  const resetPreviewQuery = useQuery({
    queryKey: ['demo-reset-preview', resetFamily?.id],
    queryFn: () => api.getDemoResetPreview(resetFamily!.id),
    enabled: Boolean(resetFamily?.canResetDemoData),
  });

  const inviteMutation = useMutation({
    mutationFn: () => api.createFamilyAdminInvitation(),
    onSuccess: async (result: InvitationResult) => {
      try {
        await navigator.clipboard.writeText(result.inviteUrl);
        message.success('新建租户邀请链接已复制');
      } catch {
        message.success('新建租户邀请链接已生成');
      }
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '创建邀请失败');
    },
  });
  const resetMutation = useMutation({
    mutationFn: () => api.resetDemoFamily(resetFamily!.id, { confirmationText }),
    onSuccess: async (result: DemoResetResult) => {
      message.success(
        `${result.familyName} 已重置完成，恢复 ${result.summary.recreated.members} 位成员、${result.summary.recreated.systemAccounts} 个演示账号。`,
      );
      setResetFamily(null);
      setConfirmationText('');
      await queryClient.invalidateQueries({ queryKey: ['platform-families'] });
      await queryClient.invalidateQueries({ queryKey: ['demo-reset-preview'] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '重置演示数据失败');
    },
  });

  const enterFamily = async (family: PlatformFamilyRecord) => {
    try {
      await switchFamily(family.id);
      message.success(`已进入 ${family.name}`);
      router.replace('/dashboard');
    } catch (error) {
      message.error(error instanceof ApiError ? error.message : '进入租户失败');
    }
  };

  const families = familiesQuery.data ?? [];
  const resetPreview = resetPreviewQuery.data;
  const canConfirmReset = useMemo(
    () => Boolean(resetPreview && confirmationText.trim() === resetPreview.confirmationText),
    [confirmationText, resetPreview],
  );

  const renderResetDescription = (preview: DemoResetPreviewResponse | undefined) => {
    if (!preview) {
      return null;
    }

    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="warning"
          showIcon
          message="该操作只影响当前演示家族"
          description="系统会清空当前演示家族的成员、资料、补充申请、邀请和账号关系，再按绑定模板恢复初始演示状态。"
        />
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="家族名称">{preview.familyName}</Descriptions.Item>
          <Descriptions.Item label="家族类型">
            <Tag color={familyTypeMeta[preview.familyType].color}>
              {familyTypeMeta[preview.familyType].label}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="绑定模板">{preview.templateKey}</Descriptions.Item>
          <Descriptions.Item label="当前成员数">{preview.counts.members}</Descriptions.Item>
          <Descriptions.Item label="当前账号数">{preview.counts.systemAccounts}</Descriptions.Item>
          <Descriptions.Item label="当前资料数">{preview.counts.assets}</Descriptions.Item>
          <Descriptions.Item label="待清理邀请">{preview.counts.invitations}</Descriptions.Item>
          <Descriptions.Item label="待清理补充申请">
            {preview.counts.supplementRequests}
          </Descriptions.Item>
        </Descriptions>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {preview.warnings.map((warning) => (
            <Text key={warning} type="secondary">
              {warning}
            </Text>
          ))}
        </Space>
        <Input
          value={confirmationText}
          onChange={(event) => setConfirmationText(event.target.value)}
          placeholder={`请输入“${preview.confirmationText}”确认重置`}
        />
      </Space>
    );
  };

  return (
    <AuthGuard requireSuper>
      <div className="page-stack">
        <Card className="soft-panel">
          <div className="page-hero">
            <div className="page-hero-copy">
              <Text className="page-eyebrow">SUPER CONSOLE</Text>
              <Title level={2} className="page-hero-title">
                选择要进入的家族租户
              </Title>
              <Paragraph className="page-hero-desc">
                超级管理员先在这里选择租户，再进入对应家族的业务工作台；平台级操作不会写入租户操作日志。
              </Paragraph>
            </div>
            <div className="page-hero-actions">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                loading={inviteMutation.isPending}
                onClick={() => inviteMutation.mutate()}
              >
                生成新建租户邀请
              </Button>
            </div>
          </div>
        </Card>

        {inviteMutation.data ? (
          <Alert
            type="success"
            showIcon
            message="新建租户邀请链接"
            description={
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text copyable={{ text: inviteMutation.data.inviteUrl }}>
                  {inviteMutation.data.inviteUrl}
                </Text>
                <Text type="secondary">
                  有效期至 {formatDate(inviteMutation.data.expiresAt, 'YYYY-MM-DD HH:mm')}
                </Text>
              </Space>
            }
          />
        ) : (
          <Alert
            type="info"
            showIcon
            icon={<LinkOutlined />}
            message="邀请链接适合直接转发到微信"
            description="接收人打开链接后可以创建自己的家族系统，并自动成为该租户管理员。"
          />
        )}

        {families.length > 0 ? (
          <div className="tenant-card-grid">
            {families.map((family) => (
              <Card
                key={family.id}
                className="tenant-card"
                hoverable
                onClick={() => enterFamily(family)}
              >
                <div className="tenant-card-body">
                  <div className="tenant-card-main">
                    <Space direction="vertical" size={8}>
                      <Space wrap>
                        <Title level={4} className="tenant-card-title">
                          {family.name}
                        </Title>
                        <Tag color={family.status === 'ACTIVE' ? 'green' : 'default'}>
                          {family.status === 'ACTIVE' ? '启用' : '停用'}
                        </Tag>
                        <Tag color={familyTypeMeta[family.familyType].color}>
                          {familyTypeMeta[family.familyType].label}
                        </Tag>
                      </Space>
                      <Text type="secondary">
                        创建于 {formatDate(family.createdAt, 'YYYY-MM-DD HH:mm')}
                      </Text>
                    </Space>
                    <Space>
                      {family.canResetDemoData ? (
                        <Button
                          danger
                          onClick={(event) => {
                            event.stopPropagation();
                            setResetFamily(family);
                            setConfirmationText('');
                          }}
                        >
                          重置演示数据
                        </Button>
                      ) : null}
                      <Button
                        type="text"
                        icon={<ArrowRightOutlined />}
                        onClick={(event) => event.stopPropagation()}
                      />
                    </Space>
                  </div>
                  <div className="tenant-card-stats">
                    <Statistic title="家族成员" value={family.memberCount} />
                    <Statistic title="系统账号" value={family.membershipCount} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="soft-panel">
            <Empty description="暂无租户，请先生成新建租户邀请链接。" />
          </Card>
        )}

        <Modal
          open={Boolean(resetFamily)}
          title={resetFamily ? `重置演示数据：${resetFamily.name}` : '重置演示数据'}
          okText="确认重置"
          okButtonProps={{ danger: true, disabled: !canConfirmReset }}
          confirmLoading={resetMutation.isPending}
          onCancel={() => {
            setResetFamily(null);
            setConfirmationText('');
          }}
          onOk={() => resetMutation.mutate()}
          destroyOnHidden
        >
          {resetPreviewQuery.isLoading ? (
            <div className="page-center" style={{ minHeight: 180 }}>
              <Button type="text" loading icon={<ReloadOutlined />}>
                正在加载重置预检信息
              </Button>
            </div>
          ) : resetPreviewQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message="加载重置预检失败"
              description="请关闭弹窗后重试，或稍后重新进入平台管理页面。"
            />
          ) : (
            renderResetDescription(resetPreview)
          )}
        </Modal>
      </div>
    </AuthGuard>
  );
}
