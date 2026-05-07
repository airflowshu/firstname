'use client';

import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Descriptions,
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

const requestTypeLabelMap: Record<SupplementRequestType, string> = {
  BASIC_INFO: '成员资料编辑',
  PHOTO: '照片新增',
  DOCUMENT: '附件新增',
  MEMBER_CREATE: '成员新建',
  MEMBER_UPDATE: '成员编辑',
  MEMBER_DELETE: '成员删除',
  MEMBER_RESTORE: '成员恢复',
  QUICK_RELATIVE: '亲属关系',
  MARRIAGE_CREATE: '婚姻新增',
  MARRIAGE_UPDATE: '婚姻编辑',
  MARRIAGE_DELETE: '婚姻删除',
  MARRIAGE_RESTORE: '婚姻恢复',
  MEMBER_PHOTO: '头像更新',
  ASSET_UPDATE: '资料编辑',
  ASSET_DELETE: '资料删除',
  EVENT_CREATE: '时间线新增',
  EVENT_DELETE: '时间线删除',
  MEMBER_IMPORT: '批量导入',
};

const fieldLabelMap: Record<string, string> = {
  member: '成员信息',
  request: '申请内容',
  dto: '变更内容',
  action: '操作',
  operation: '操作',
  anchor: '当前成员',
  anchorId: '当前成员',
  memberId: '成员',
  marriageId: '婚姻关系',
  assetId: '资料',
  eventId: '时间线事件',
  count: '数量',
  category: '资料类型',
  filePath: '文件路径',
  fileUrl: '文件链接',
  checksum: '文件校验值',
  mimeType: '文件类型',
  name: '姓名',
  gender: '性别',
  birthDate: '出生日期',
  deathDate: '去世日期',
  lifeStatus: '生命状态',
  generationName: '字辈',
  birthOrder: '排行',
  nativePlace: '籍贯',
  notes: '备注',
  fatherId: '父亲',
  motherId: '母亲',
  spouseId: '配偶',
  status: '状态',
  startDate: '开始日期',
  endDate: '结束日期',
  title: '标题',
  sourceType: '来源类型',
  source: '来源说明',
  description: '描述',
  tags: '标签',
  relationType: '亲属关系类型',
  targetMember: '亲属成员',
  changeMode: '处理方式',
  existingMemberId: '已有成员',
  eventType: '事件类型',
  eventDate: '事件日期',
  isDeleted: '删除状态',
  originalName: '原文件名',
  sizeBytes: '文件大小',
  photoPath: '头像路径',
};

const valueLabelMap: Record<string, string> = {
  MALE: '男',
  FEMALE: '女',
  UNKNOWN: '未知',
  ALIVE: '在世',
  DECEASED: '已故',
  ACTIVE: '存续',
  DIVORCED: '离异',
  WIDOWED: '丧偶',
  PHOTO: '照片',
  DOCUMENT: '附件',
  BIRTH: '出生',
  MARRIAGE: '结婚',
  DIVORCE: '离婚',
  DEATH: '去世',
  MOVE: '迁居',
  CAREER: '事业',
  HONOR: '荣誉',
  STORY: '故事',
  OTHER: '其他',
  CREATE: '新增',
  UPDATE: '编辑',
  DELETE: '删除',
  RESTORE: '恢复',
  QUICK_RELATIVE: '亲属关系',
  father: '父亲',
  mother: '母亲',
  spouse: '配偶',
  child: '子女',
  sibling: '兄弟姐妹',
  true: '是',
  false: '否',
  createNewMember: '新增成员',
  linkExistingMember: '绑定已有成员',
};

const hiddenSummaryFieldSet = new Set([
  'id',
  'familyId',
  'createdAt',
  'updatedAt',
  'filePath',
  'fileUrl',
  'checksum',
  'mimeType',
  'photoPath',
]);

const preferredMemberFieldKeys = [
  'name',
  'gender',
  'birthDate',
  'deathDate',
  'lifeStatus',
  'generationName',
  'birthOrder',
  'nativePlace',
  'fatherId',
  'motherId',
  'notes',
];

const preferredAssetFieldKeys = [
  'category',
  'count',
  'title',
  'sourceType',
  'source',
  'tags',
  'description',
  'originalName',
  'sizeBytes',
];

function formatFieldLabel(key: string): string {
  return fieldLabelMap[key] ?? key;
}

function formatPrimitiveValue(value: string | number | boolean): string {
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  const text = String(value);
  return valueLabelMap[text] ?? text;
}

function formatBytes(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatValue(item)).join('、') || '-';
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.name === 'string') {
      return record.name;
    }
    const entries = Object.entries(record).filter(
      ([, itemValue]) => itemValue !== undefined && itemValue !== null && itemValue !== '',
    );
    if (entries.length === 0) {
      return '-';
    }
    return entries
      .slice(0, 6)
      .map(([key, itemValue]) => `${formatFieldLabel(key)}：${formatValue(itemValue)}`)
      .join('；');
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return formatPrimitiveValue(value);
  }
  return String(value);
}

function formatSummaryValue(key: string, value: unknown): string {
  if (key === 'sizeBytes') {
    return formatBytes(value) ?? formatValue(value);
  }
  return formatValue(value);
}

function pickEntries(source: unknown, keys?: string[]): Array<[string, unknown]> {
  if (!source || typeof source !== 'object') {
    return [];
  }
  const record = source as Record<string, unknown>;
  const entries = keys
    ? keys
        .filter((key) => key in record)
        .map((key) => [key, record[key]] as [string, unknown])
    : Object.entries(record);

  return entries.filter(
    ([key, value]) =>
      !hiddenSummaryFieldSet.has(key) && value !== undefined && value !== null && value !== '',
  );
}

function getRecordValue(source: unknown, key: string): unknown {
  return source && typeof source === 'object' ? (source as Record<string, unknown>)[key] : undefined;
}

function collectSummaryEntries(record: SupplementRequestRecord): Array<[string, unknown]> {
  const payload = record.payload ?? {};
  const patch = record.patch ?? {};
  const afterSnapshot = record.afterSnapshot ?? {};

  if (record.requestType === 'QUICK_RELATIVE') {
    const request = getRecordValue(payload, 'request') ?? patch;
    const relationType = getRecordValue(request, 'relationType');
    const member = getRecordValue(request, 'member');
    const existingMemberId = getRecordValue(request, 'existingMemberId');
    const memberName = getRecordValue(member, 'name');

    const summaryEntries: Array<[string, unknown]> = [
      ['relationType', relationType],
      ['changeMode', existingMemberId ? 'linkExistingMember' : 'createNewMember'],
    ];
    if (memberName) {
      summaryEntries.push(['targetMember', memberName]);
    }

    return summaryEntries.filter(([, value]) => value !== undefined && value !== null && value !== '');
  }

  if (record.requestType === 'MEMBER_CREATE') {
    return pickEntries(getRecordValue(payload, 'member') ?? patch ?? afterSnapshot, preferredMemberFieldKeys);
  }

  if (record.requestType === 'MEMBER_PHOTO') {
    return pickEntries({ originalName: getRecordValue(payload, 'originalName') ?? getRecordValue(patch, 'originalName') }, [
      'originalName',
    ]);
  }

  if (record.requestType === 'PHOTO' || record.requestType === 'DOCUMENT') {
    return pickEntries({ ...payload, ...patch }, preferredAssetFieldKeys);
  }

  if (
    record.requestType === 'MARRIAGE_CREATE' ||
    record.requestType === 'MARRIAGE_UPDATE' ||
    record.requestType === 'MARRIAGE_DELETE' ||
    record.requestType === 'MARRIAGE_RESTORE'
  ) {
    return pickEntries(getRecordValue(payload, 'dto') ?? patch);
  }

  if (record.requestType === 'EVENT_CREATE') {
    return pickEntries(getRecordValue(payload, 'event') ?? patch);
  }

  if (record.requestType === 'EVENT_DELETE') {
    return pickEntries({ eventId: getRecordValue(payload, 'eventId') });
  }

  if (record.requestType === 'MEMBER_IMPORT') {
    return pickEntries(payload, ['originalName', 'sizeBytes']);
  }

  const patchEntries = Object.entries(record.patch ?? {});
  if (patchEntries.length > 0) {
    return pickEntries(record.patch);
  }
  const payloadEntries = Object.entries(record.payload ?? {});
  if (payloadEntries.length > 0) {
    return pickEntries(record.payload);
  }
  return pickEntries(record.afterSnapshot);
}

function renderPatchSummary(record: SupplementRequestRecord) {
  const entries = collectSummaryEntries(record);
  if (entries.length === 0 && record.assets.length === 0) {
    return <Tag>{requestTypeLabelMap[record.requestType]}</Tag>;
  }

  return (
    <Space wrap>
      {entries.slice(0, 6).map(([key, value]) => (
        <Tag key={key}>{`${formatFieldLabel(key)}：${formatSummaryValue(key, value)}`}</Tag>
      ))}
      {entries.length > 6 ? <Tag>+{entries.length - 6}</Tag> : null}
      {record.assets.length > 0 ? <Tag color="blue">资料 {record.assets.length} 项</Tag> : null}
    </Space>
  );
}

function renderRequestAssetSummary(record: SupplementRequestRecord) {
  if (record.assets.length === 0) {
    return null;
  }

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      {record.assets.map((asset) => (
        <div key={asset.id} className="member-request-asset-item">
          <a href={toAbsoluteAssetUrl(asset.fileUrl) ?? '#'} target="_blank" rel="noreferrer">
            <Tag color={record.requestType === 'PHOTO' ? 'magenta' : 'blue'}>
              {asset.title || asset.originalName}
            </Tag>
          </a>
          <div className="member-request-asset-meta">
            {asset.source || asset.sourceType ? (
              <Text type="secondary">
                来源：{[asset.sourceType, asset.source].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            {asset.description ? <Paragraph style={{ margin: 0 }}>{asset.description}</Paragraph> : null}
          </div>
        </div>
      ))}
    </Space>
  );
}

function collectDiffRows(record: SupplementRequestRecord) {
  const before = record.beforeSnapshot ?? {};
  const after = record.afterSnapshot ?? {};
  const patch = record.patch ?? {};
  const keys = Array.from(
    new Set([...Object.keys(before), ...Object.keys(after), ...Object.keys(patch)]),
  ).filter((key) => !hiddenSummaryFieldSet.has(key));

  if (keys.length === 0) {
    return [];
  }

  return keys
    .map((key) => {
      const beforeValue = (before as Record<string, unknown>)[key];
      const afterValue =
        (after as Record<string, unknown>)[key] ??
        (patch as Record<string, unknown>)[key] ??
        undefined;

      return {
        key,
        label: formatFieldLabel(key),
        before: beforeValue,
        after: afterValue,
      };
    })
    .filter((row) => JSON.stringify(row.before ?? null) !== JSON.stringify(row.after ?? null));
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
      message.success(payload.action === 'APPROVE' ? '变更申请已审核通过' : '变更申请已驳回');
      setReviewingRecord(null);
      form.resetFields();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['supplement-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['members'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
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

  const titleText = useMemo(() => (isAdmin ? '成员变更审核' : '我的变更申请'), [isAdmin]);
  const reviewDiffRows = reviewingRecord ? collectDiffRows(reviewingRecord) : [];

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
                ? '集中审核普通成员提交的成员、关系、资料和时间线变更；通过后才写入正式数据。'
                : '查看自己提交的成员维护申请状态与审核结果。'}
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
              style={{ width: 180 }}
              placeholder="变更类型"
              options={Object.entries(requestTypeLabelMap).map(([value, label]) => ({
                label,
                value,
              }))}
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
                title: '目标',
                render: (_: unknown, record: SupplementRequestRecord) =>
                  record.member?.name ??
                  (record.requestType === 'MEMBER_CREATE'
                    ? '新建成员'
                    : record.requestType === 'MEMBER_IMPORT'
                      ? '批量导入'
                      : '-'),
              },
              ...(isAdmin
                ? [
                    {
                      title: '申请人',
                      render: (_: unknown, record: SupplementRequestRecord) =>
                        record.requester.username,
                    },
                  ]
                : []),
              {
                title: '变更类型',
                dataIndex: 'requestType',
                render: (value: SupplementRequestType) => requestTypeLabelMap[value] ?? value,
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
                title: '变更摘要',
                render: (_: unknown, record: SupplementRequestRecord) => (
                  <Space direction="vertical" size={8}>
                    {renderPatchSummary(record)}
                    {renderRequestAssetSummary(record)}
                  </Space>
                ),
              },
              {
                title: '提交说明',
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
                width: 180,
                render: (_: unknown, record: SupplementRequestRecord) => (
                  <Space size={6} wrap={false} style={{ whiteSpace: 'nowrap' }}>
                    {record.status === 'PENDING' ? (
                      <Text type="secondary">待审核</Text>
                    ) : (
                      <>
                        <Text>{record.reviewer?.username ?? '审核人未记录'}</Text>
                        <Text style={{ color: '#8b7253' }}>
                          {record.reviewComment ??
                            (record.status === 'APPROVED' ? '已通过' : '已驳回')}
                        </Text>
                      </>
                    )}
                  </Space>
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
          title={reviewAction === 'APPROVE' ? '审核通过变更申请' : '驳回变更申请'}
          onCancel={() => {
            setReviewingRecord(null);
            form.resetFields();
          }}
          onOk={() => form.submit()}
          confirmLoading={reviewMutation.isPending}
          destroyOnHidden
          width={820}
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
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="目标">
                {reviewingRecord?.member?.name ??
                  (reviewingRecord?.requestType === 'MEMBER_CREATE' ? '新建成员' : '批量导入')}
              </Descriptions.Item>
              <Descriptions.Item label="类型">
                {reviewingRecord ? requestTypeLabelMap[reviewingRecord.requestType] : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="申请人">
                {reviewingRecord?.requester.username ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="提交时间">
                {reviewingRecord ? formatDate(reviewingRecord.createdAt, 'YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Form.Item label="差异对比">
              {reviewDiffRows.length > 0 ? (
                <Table
                  size="small"
                  pagination={false}
                  rowKey="key"
                  dataSource={reviewDiffRows}
                  columns={[
                    { title: '字段', dataIndex: 'label', width: 140 },
                    {
                      title: '当前正式数据',
                      render: (_: unknown, row: { before?: unknown; after?: unknown }) =>
                        formatValue(row.before),
                    },
                    {
                      title: '申请变更后',
                      render: (_: unknown, row: { before?: unknown; after?: unknown }) =>
                        formatValue(row.after),
                    },
                  ]}
                />
              ) : reviewingRecord ? (
                <Space direction="vertical" size={8}>
                  {renderPatchSummary(reviewingRecord)}
                  {renderRequestAssetSummary(reviewingRecord)}
                </Space>
              ) : null}
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
