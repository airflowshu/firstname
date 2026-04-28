'use client';

import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { useAuth } from '@/components/auth-provider';
import { api, ApiError } from '@/lib/api';
import { formatDate, toAbsoluteAssetUrl } from '@/lib/format';
import type {
  SupplementRequestRecord,
  SupplementRequestStatus,
  SupplementRequestType,
} from '@/lib/types';

const { Paragraph, Text, Title } = Typography;

function renderPatchSummary(record: SupplementRequestRecord) {
  const fieldLabelMap: Record<string, string> = {
    name: '姓名',
    gender: '性别',
    birthDate: '出生日期',
    deathDate: '去世日期',
    lifeStatus: '生命状态',
    generationName: '字辈',
    birthOrder: '排行',
    nativePlace: '籍贯',
    notes: '备注',
  };

  return Object.entries(record.patch).map(([key, value]) => (
    <Tag key={key}>{`${fieldLabelMap[key] ?? key}: ${String(value)}`}</Tag>
  ));
}

function renderRequestAssetSummary(record: SupplementRequestRecord) {
  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      {record.assets.map((asset) => (
        <div key={asset.id} className="member-request-asset-item">
          <a
            href={toAbsoluteAssetUrl(asset.fileUrl) ?? '#'}
            target="_blank"
            rel="noreferrer"
          >
            <Tag color={record.requestType === 'PHOTO' ? 'magenta' : 'blue'}>
              {asset.title || asset.originalName}
            </Tag>
          </a>
          <div className="member-request-asset-meta">
            {asset.title ? <Text type="secondary">原文件：{asset.originalName}</Text> : null}
            {asset.source || asset.sourceType ? (
              <Text type="secondary">
                来源：{[asset.sourceType, asset.source].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            {asset.description ? (
              <Paragraph style={{ margin: 0 }}>{asset.description}</Paragraph>
            ) : null}
            {asset.tags.length > 0 ? (
              <Space wrap size={[6, 6]}>
                {asset.tags.map((tag) => (
                  <Tag key={`${asset.id}-${tag}`}>{tag}</Tag>
                ))}
              </Space>
            ) : null}
          </div>
        </div>
      ))}
    </Space>
  );
}

export default function SupplementRequestsPage() {
  const { message } = App.useApp();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SupplementRequestStatus | undefined>(
    isAdmin ? 'PENDING' : undefined,
  );
  const [requestType, setRequestType] = useState<SupplementRequestType | undefined>();
  const [keyword, setKeyword] = useState('');
  const [reviewingRecord, setReviewingRecord] = useState<SupplementRequestRecord | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [form] = Form.useForm<{ reviewComment?: string }>();

  useEffect(() => {
    if (isAdmin) {
      setStatus((current) => current ?? 'PENDING');
    }
  }, [isAdmin]);

  const requestsQuery = useQuery({
    queryKey: ['supplement-requests', status, requestType, keyword, isAdmin],
    queryFn: () =>
      api.getSupplementRequests({
        page: 1,
        pageSize: 50,
        status,
        requestType,
        keyword,
      }),
  });

  const reviewMutation = useMutation({
    mutationFn: (payload: { id: string; action: 'APPROVE' | 'REJECT'; reviewComment?: string }) =>
      api.reviewSupplementRequest(payload.id, {
        action: payload.action,
        reviewComment: payload.reviewComment,
      }),
    onSuccess: async (_result, payload) => {
      message.success(payload.action === 'APPROVE' ? '补充申请已审核通过' : '补充申请已驳回');
      setReviewingRecord(null);
      form.resetFields();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['supplement-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['members'] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '审核失败');
    },
  });

  const statusColorMap: Record<SupplementRequestStatus, string> = {
    PENDING: 'processing',
    APPROVED: 'success',
    REJECTED: 'error',
  };

  const titleText = useMemo(
    () => (isAdmin ? '资料补充审核' : '我的资料补充申请'),
    [isAdmin],
  );

  return (
    <AuthGuard>
      <div className="page-stack">
        <Card className="soft-panel">
          <Space direction="vertical" size={4}>
            <Title level={3} style={{ margin: 0 }}>
              {titleText}
            </Title>
            <Text type="secondary">
              {isAdmin
                ? '集中审核普通成员提交的资料补充申请，审核通过后自动写入成员主数据。'
                : '查看自己提交的资料补充申请状态与审核结果。'}
            </Text>
          </Space>
        </Card>

        <Card className="soft-panel">
          <Space wrap>
            <Input.Search
              allowClear
              placeholder={isAdmin ? '搜索成员 / 申请人 / 说明' : '搜索成员 / 说明'}
              style={{ width: 280 }}
              onSearch={setKeyword}
            />
            <Select
              allowClear
              value={requestType}
              style={{ width: 160 }}
              placeholder="申请类型"
              options={[
                { label: '基础资料补充', value: 'BASIC_INFO' },
                { label: '照片补充', value: 'PHOTO' },
                { label: '附件补充', value: 'DOCUMENT' },
              ]}
              onChange={setRequestType}
            />
            <Select
              allowClear={!isAdmin}
              value={status}
              style={{ width: 140 }}
              placeholder="状态"
              options={[
                { label: '待审核', value: 'PENDING' },
                { label: '已通过', value: 'APPROVED' },
                { label: '已驳回', value: 'REJECTED' },
              ]}
              onChange={setStatus}
            />
          </Space>
        </Card>

        <Card className="soft-panel" loading={requestsQuery.isLoading}>
          <Table
            rowKey="id"
            dataSource={requestsQuery.data?.data ?? []}
            scroll={{ x: 1200 }}
            columns={[
              {
                title: '成员',
                dataIndex: ['member', 'name'],
                render: (_: string, record: SupplementRequestRecord) => record.member.name,
              },
              ...(isAdmin
                ? [
                    {
                      title: '申请人',
                      dataIndex: ['requester', 'username'],
                      render: (_: string, record: SupplementRequestRecord) =>
                        record.requester.username,
                    },
                  ]
                : []),
              {
                title: '申请类型',
                dataIndex: 'requestType',
                render: (value: SupplementRequestType) =>
                  value === 'BASIC_INFO'
                    ? '基础资料补充'
                    : value === 'PHOTO'
                      ? '照片补充'
                      : '附件补充',
              },
              {
                title: '状态',
                dataIndex: 'status',
                render: (value: SupplementRequestStatus) => (
                  <Tag color={statusColorMap[value]}>
                    {value === 'PENDING' ? '待审核' : value === 'APPROVED' ? '已通过' : '已驳回'}
                  </Tag>
                ),
              },
              {
                title: '补充字段',
                render: (_: unknown, record: SupplementRequestRecord) => (
                  record.requestType === 'BASIC_INFO' ? (
                    <Space wrap>{renderPatchSummary(record)}</Space>
                  ) : (
                    renderRequestAssetSummary(record)
                  )
                ),
              },
              {
                title: '补充说明',
                dataIndex: 'reason',
                render: (value?: string | null) => value ?? '-',
              },
              {
                title: '提交时间',
                dataIndex: 'createdAt',
                render: (value: string) => formatDate(value, 'YYYY-MM-DD HH:mm'),
              },
              {
                title: '审核结果',
                render: (_: unknown, record: SupplementRequestRecord) => (
                  <div>
                    <div>{record.reviewer?.username ?? '-'}</div>
                    <div style={{ color: '#8b7253' }}>
                      {record.reviewComment ?? (record.status === 'PENDING' ? '待审核' : '-')}
                    </div>
                  </div>
                ),
              },
              ...(isAdmin
                ? [
                    {
                      title: '操作',
                      render: (_: unknown, record: SupplementRequestRecord) =>
                        record.status === 'PENDING' ? (
                          <Space>
                            <Button
                              size="small"
                              type="primary"
                              icon={<CheckOutlined />}
                              onClick={() => {
                                setReviewAction('APPROVE');
                                setReviewingRecord(record);
                              }}
                            >
                              通过
                            </Button>
                            <Button
                              size="small"
                              danger
                              icon={<CloseOutlined />}
                              onClick={() => {
                                setReviewAction('REJECT');
                                setReviewingRecord(record);
                              }}
                            >
                              驳回
                            </Button>
                          </Space>
                        ) : (
                          '-'
                        ),
                    },
                  ]
                : []),
            ]}
          />
        </Card>

        <Modal
          open={Boolean(reviewingRecord)}
          title={reviewAction === 'APPROVE' ? '审核通过补充申请' : '驳回补充申请'}
          onCancel={() => {
            setReviewingRecord(null);
            form.resetFields();
          }}
          onOk={() => form.submit()}
          confirmLoading={reviewMutation.isPending}
          destroyOnHidden
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={async (values) => {
              if (!reviewingRecord) {
                return;
              }

              await reviewMutation.mutateAsync({
                id: reviewingRecord.id,
                action: reviewAction,
                reviewComment: values.reviewComment?.trim() || undefined,
              });
            }}
          >
            <Form.Item label="成员">
              <Input value={reviewingRecord?.member.name} disabled />
            </Form.Item>
            <Form.Item label="补充字段">
              {reviewingRecord?.requestType === 'BASIC_INFO' ? (
                <Space wrap>{reviewingRecord ? renderPatchSummary(reviewingRecord) : null}</Space>
              ) : (
                reviewingRecord ? renderRequestAssetSummary(reviewingRecord) : null
              )}
            </Form.Item>
            <Form.Item
              name="reviewComment"
              label={reviewAction === 'APPROVE' ? '审核备注' : '驳回原因'}
              rules={
                reviewAction === 'REJECT'
                  ? [{ required: true, message: '请输入驳回原因' }]
                  : undefined
              }
            >
              <Input.TextArea
                rows={4}
                placeholder={reviewAction === 'APPROVE' ? '可填写审核说明' : '请说明驳回原因'}
              />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AuthGuard>
  );
}
