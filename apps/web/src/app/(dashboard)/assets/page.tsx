'use client';

import {
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  FilterOutlined,
  LinkOutlined,
  NodeIndexOutlined,
  PaperClipOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  Image,
  Input,
  List,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Tag,
  Typography,
} from 'antd';
import Link from 'next/link';
import { useDeferredValue, useEffect, useState } from 'react';
import { AssetBatchModal } from '@/components/asset-batch-modal';
import { AssetImportWizardModal } from '@/components/asset-import-wizard-modal';
import { AssetImportResultModal } from '@/components/asset-import-result-modal';
import { AuthGuard } from '@/components/auth-guard';
import { useAuth } from '@/components/auth-provider';
import { MemberAssetModal } from '@/components/member-asset-modal';
import { api, ApiError } from '@/lib/api';
import { formatDate, toAbsoluteAssetUrl } from '@/lib/format';
import type {
  AssetBatchAction,
  AssetImportBatchResult,
  AssetImportBatchView,
  MemberAssetLibraryItem,
} from '@/lib/types';

const { Paragraph, Text, Title } = Typography;

function renderAssetPreview(asset: MemberAssetLibraryItem) {
  if (asset.category === 'PHOTO') {
    return (
      <div className="asset-library-cover">
        <Image
          src={toAbsoluteAssetUrl(asset.fileUrl) ?? ''}
          alt={asset.title || asset.originalName}
          width="100%"
          height={220}
          style={{ objectFit: 'cover' }}
          preview
        />
      </div>
    );
  }

  const isPdf = asset.mimeType === 'application/pdf';
  const isZip = asset.mimeType.includes('zip');

  return (
    <div className="asset-library-cover asset-library-cover-doc">
      <Avatar
        size={72}
        icon={
          isPdf ? (
            <FileTextOutlined />
          ) : isZip ? (
            <PaperClipOutlined />
          ) : (
            <FileTextOutlined />
          )
        }
        style={{
          background:
            isPdf ? '#b42318' : isZip ? '#7c3aed' : '#8a704f',
        }}
      />
      <Text strong className="asset-library-doc-name">
        {asset.title || asset.originalName}
      </Text>
      <Text type="secondary">{Math.max(1, Math.round(asset.sizeBytes / 1024))} KB</Text>
    </div>
  );
}

export default function AssetLibraryPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [keywordInput, setKeywordInput] = useState('');
  const [category, setCategory] = useState<'PHOTO' | 'DOCUMENT' | undefined>();
  const [tag, setTag] = useState<string | undefined>();
  const [sourceType, setSourceType] = useState<string | undefined>();
  const [hasSource, setHasSource] = useState(false);
  const [hasDescription, setHasDescription] = useState(false);
  const [hasTags, setHasTags] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(18);
  const [editingAsset, setEditingAsset] = useState<MemberAssetLibraryItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [lastImportResult, setLastImportResult] = useState<AssetImportBatchResult | null>(null);
  const [focusedImportBatch, setFocusedImportBatch] = useState<AssetImportBatchView | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [batchAction, setBatchAction] = useState<Extract<AssetBatchAction, 'APPEND_TAGS' | 'SET_SOURCE_TYPE'> | null>(null);
  const deferredKeyword = useDeferredValue(keywordInput.trim());
  const assetTagsQuery = useQuery({
    queryKey: ['asset-tags', 'enabled'],
    queryFn: () => api.getAssetTags(),
  });
  const assetSourcesQuery = useQuery({
    queryKey: ['asset-sources', 'enabled'],
    queryFn: () => api.getAssetSources(),
  });

  useEffect(() => {
    setPage(1);
  }, [
    deferredKeyword,
    category,
    tag,
    sourceType,
    hasSource,
    hasDescription,
    hasTags,
    pageSize,
    focusedImportBatch?.batchId,
  ]);

  useEffect(() => {
    setSelectedAssetIds([]);
  }, [page, deferredKeyword, category, tag, sourceType, hasSource, hasDescription, hasTags, pageSize]);

  const assetLibraryQuery = useQuery({
    queryKey: [
      'asset-library',
      deferredKeyword,
      category,
      tag,
      sourceType,
      focusedImportBatch?.batchId,
      hasSource,
      hasDescription,
      hasTags,
      page,
      pageSize,
    ],
    queryFn: () =>
      api.getAssetLibrary({
        page,
        pageSize,
        keyword: deferredKeyword || undefined,
        category,
        tag,
        sourceType,
        importBatchId: focusedImportBatch?.batchId,
        hasSource: hasSource || undefined,
        hasDescription: hasDescription || undefined,
        hasTags: hasTags || undefined,
      }),
  });
  const importBatchesQuery = useQuery({
    queryKey: ['asset-import-batches'],
    queryFn: () => api.getAssetImportBatches({ page: 1, pageSize: 6 }),
    enabled: isAdmin,
  });

  const updateAssetMutation = useMutation({
    mutationFn: (payload: {
      memberId: string;
      assetId: string;
      sourceType?: string;
      title?: string;
      source?: string;
      tags: string[];
      description?: string;
    }) =>
      api.updateMemberAsset(payload.memberId, payload.assetId, {
        sourceType: payload.sourceType,
        title: payload.title,
        source: payload.source,
        tags: payload.tags,
        description: payload.description,
      }),
    onSuccess: async (_result, payload) => {
      message.success('资料信息已更新');
      setEditingAsset(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['asset-library'] }),
        queryClient.invalidateQueries({ queryKey: ['member-assets', payload.memberId] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '更新资料信息失败');
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: (asset: MemberAssetLibraryItem) => api.deleteMemberAsset(asset.memberId, asset.id),
    onSuccess: async (_result, asset) => {
      message.success('资料已删除');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['asset-library'] }),
        queryClient.invalidateQueries({ queryKey: ['member-assets', asset.memberId] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '删除资料失败');
    },
  });
  const importWizardMutation = useMutation({
    mutationFn: async (payload: {
      memberId: string;
      category: 'PHOTO' | 'DOCUMENT';
      files: File[];
      sourceType?: string;
      source?: string;
      tags: string[];
      description?: string;
      resolvedTitles: string[];
    }) =>
      api.importAssetsBatch({
        memberId: payload.memberId,
        category: payload.category,
        files: payload.files,
        sourceType: payload.sourceType,
        source: payload.source,
        tags: payload.tags,
        description: payload.description,
        titles: payload.resolvedTitles,
      }),
    onSuccess: async (result) => {
      message.success(
        result.failedCount > 0
          ? `导入完成：成功 ${result.successCount} 项，失败 ${result.failedCount} 项`
          : `已通过向导成功导入 ${result.successCount} 项资料`,
      );
      setImportOpen(false);
      setLastImportResult(result);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['asset-library'] }),
        queryClient.invalidateQueries({ queryKey: ['member-assets', result.memberId] }),
        queryClient.invalidateQueries({ queryKey: ['asset-import-batches'] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '批量导入失败');
    },
  });
  const batchOperateMutation = useMutation({
    mutationFn: (payload: {
      action: 'APPEND_TAGS' | 'SET_SOURCE_TYPE' | 'DELETE';
      assetIds: string[];
      tags?: string[];
      sourceType?: string;
    }) => api.batchOperateAssets(payload),
    onSuccess: async (result, payload) => {
      message.success(
        payload.action === 'DELETE'
          ? `已批量删除 ${result.affectedCount} 项资料`
          : payload.action === 'APPEND_TAGS'
            ? `已为 ${result.affectedCount} 项资料追加标签`
            : `已为 ${result.affectedCount} 项资料设置来源类型`,
      );
      setBatchAction(null);
      setSelectedAssetIds([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['asset-library'] }),
        queryClient.invalidateQueries({ queryKey: ['member-assets'] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '批量操作失败');
    },
  });

  const response = assetLibraryQuery.data;
  const currentPageAssetIds = response?.data.map((asset) => asset.id) ?? [];
  const selectedCount = selectedAssetIds.length;
  const isAllCurrentPageSelected =
    currentPageAssetIds.length > 0 && currentPageAssetIds.every((id) => selectedAssetIds.includes(id));
  const recommendedTagOptions = (assetTagsQuery.data ?? []).map((item) => {
    const matchedBucket = response?.tagBuckets.find((bucket) => bucket.tag === item.name);

    return {
      label: `${item.name} (${matchedBucket?.count ?? item.useCount ?? 0})`,
      value: item.name,
      count: matchedBucket?.count ?? item.useCount ?? 0,
    };
  });
  const fallbackTagOptions = (response?.tagBuckets ?? [])
    .filter((bucket) => !recommendedTagOptions.some((item) => item.value === bucket.tag))
    .map((bucket) => ({
      label: `${bucket.tag} (${bucket.count})`,
      value: bucket.tag,
      count: bucket.count,
    }));
  const mergedTagOptions = [...recommendedTagOptions, ...fallbackTagOptions];
  const sourceTypeOptions = (assetSourcesQuery.data ?? []).map((item) => ({
    label: `${item.name} (${item.useCount})`,
    value: item.name,
  }));

  const toggleAssetSelection = (assetId: string, checked: boolean) => {
    setSelectedAssetIds((current) =>
      checked ? Array.from(new Set([...current, assetId])) : current.filter((id) => id !== assetId),
    );
  };

  const focusImportBatch = (payload: AssetImportBatchView, options?: { preselect?: boolean }) => {
    setFocusedImportBatch(payload);
    setPage(1);
    if (options?.preselect) {
      setSelectedAssetIds(payload.createdAssetIds);
    } else {
      setSelectedAssetIds([]);
    }
    setLastImportResult(null);
  };

  return (
    <AuthGuard>
      <div className="page-stack">
        <Card className="soft-panel">
          <Space
            direction="vertical"
            size={8}
            style={{ width: '100%', alignItems: 'stretch' }}
          >
            <div className="asset-library-header">
              <div>
                <Title level={3} style={{ margin: 0 }}>
                  家族资料中心
                </Title>
                <Text type="secondary">
                  以全局视角检索家族相册、扫描件、证书与口述资料，让成员资料真正形成可沉淀的家族资源库。
                </Text>
              </div>
              <Space wrap>
                {isAdmin ? (
                  <Button type="primary" icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
                    批量导入向导
                  </Button>
                ) : null}
                <Button>
                  <Link href="/members">前往成员管理</Link>
                </Button>
                {isAdmin ? (
                  <Text type="secondary">上传入口仍在成员详情页，以保证资料始终绑定到具体成员。</Text>
                ) : null}
              </Space>
            </div>
          </Space>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={8} xl={4}>
            <Card className="stat-card" loading={assetLibraryQuery.isLoading}>
              <Statistic title="资料总数" value={response?.overview.totalAssets} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8} xl={4}>
            <Card className="stat-card" loading={assetLibraryQuery.isLoading}>
              <Statistic title="照片资料" value={response?.overview.totalPhotos} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8} xl={4}>
            <Card className="stat-card" loading={assetLibraryQuery.isLoading}>
              <Statistic title="附件资料" value={response?.overview.totalDocuments} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8} xl={4}>
            <Card className="stat-card" loading={assetLibraryQuery.isLoading}>
              <Statistic title="已打标签" value={response?.overview.taggedAssets} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8} xl={4}>
            <Card className="stat-card" loading={assetLibraryQuery.isLoading}>
              <Statistic title="已标来源" value={response?.overview.sourcedAssets} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8} xl={4}>
            <Card className="stat-card" loading={assetLibraryQuery.isLoading}>
              <Statistic title="关联成员" value={response?.overview.linkedMembers} />
            </Card>
          </Col>
        </Row>

        {isAdmin ? (
          <Card
            className="soft-panel"
            title="最近导入批次"
            loading={importBatchesQuery.isLoading}
          >
            <List
              dataSource={importBatchesQuery.data?.data ?? []}
              locale={{ emptyText: '暂无批量导入记录。' }}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space wrap size={[8, 8]}>
                        <Text strong>{item.metadata?.memberName ?? '未命名成员'}</Text>
                        <Tag color={item.metadata?.category === 'PHOTO' ? 'magenta' : 'blue'}>
                          {item.metadata?.category === 'PHOTO' ? '照片资料' : '附件资料'}
                        </Tag>
                        <Tag color={(item.metadata?.failedCount ?? 0) > 0 ? 'warning' : 'success'}>
                          成功 {item.metadata?.successCount ?? 0} / 失败 {item.metadata?.failedCount ?? 0}
                        </Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={4}>
                        <Text type="secondary">
                          操作人：{item.operator?.username ?? '-'} · 导入时间{' '}
                          {formatDate(item.createdAt, 'YYYY-MM-DD HH:mm:ss')}
                        </Text>
                        <Text type="secondary">
                          来源：
                          {[item.metadata?.sourceType, item.metadata?.source]
                            .filter(Boolean)
                            .join(' · ') || '-'}
                        </Text>
                        <Text type="secondary">
                          标签：
                          {item.metadata?.tags?.length ? item.metadata.tags.join('、') : '-'}
                        </Text>
                        {item.metadata?.failures && item.metadata.failures.length > 0 ? (
                          <Text type="warning">
                            最近异常：{item.metadata.failures[0].originalName} -{' '}
                            {item.metadata.failures[0].message}
                          </Text>
                        ) : null}
                        <Space wrap>
                          <Button
                            size="small"
                            onClick={() =>
                              focusImportBatch({
                                batchId: item.id,
                                memberName: item.metadata?.memberName ?? '未命名成员',
                                createdAssetIds: item.metadata?.createdAssetIds ?? [],
                              })
                            }
                          >
                            查看本批次资料
                          </Button>
                          <Button
                            size="small"
                            type="primary"
                            onClick={() =>
                              focusImportBatch(
                                {
                                  batchId: item.id,
                                  memberName: item.metadata?.memberName ?? '未命名成员',
                                  createdAssetIds: item.metadata?.createdAssetIds ?? [],
                                },
                                { preselect: true },
                              )
                            }
                          >
                            继续批量整理
                          </Button>
                        </Space>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        ) : null}

        <Card className="soft-panel">
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space wrap>
                <Input
                  allowClear
                  value={keywordInput}
                  prefix={<SearchOutlined />}
                  placeholder="搜索资料标题、原文件名、成员姓名、来源、描述"
                  style={{ width: 320 }}
                  onChange={(event) => setKeywordInput(event.target.value)}
                />
                <Select
                  allowClear
                  value={category}
                  style={{ width: 150 }}
                  placeholder="资料类型"
                  options={[
                    { label: '照片资料', value: 'PHOTO' },
                    { label: '附件资料', value: 'DOCUMENT' },
                  ]}
                  onChange={setCategory}
                />
                <Select
                  allowClear
                  showSearch
                  value={tag}
                  style={{ width: 200 }}
                  placeholder="按标签筛选"
                  suffixIcon={<FilterOutlined />}
                  options={mergedTagOptions}
                  onChange={setTag}
                />
                <Select
                  allowClear
                  showSearch
                  value={sourceType}
                  style={{ width: 220 }}
                  placeholder="按来源类型筛选"
                  options={sourceTypeOptions}
                  onChange={setSourceType}
                  optionFilterProp="label"
                />
              </Space>
              <Text type="secondary">
                当前筛到 {response?.total ?? 0} 项，第 {response?.page ?? 1} /{' '}
                {response ? Math.max(1, Math.ceil(response.total / response.pageSize)) : 1} 页
              </Text>
            </Space>

            <Space wrap size={[16, 12]}>
              <Space size={8}>
                <Switch size="small" checked={hasSource} onChange={setHasSource} />
                <Text>仅看已标来源</Text>
              </Space>
              <Space size={8}>
                <Switch size="small" checked={hasDescription} onChange={setHasDescription} />
                <Text>仅看已写描述</Text>
              </Space>
              <Space size={8}>
                <Switch size="small" checked={hasTags} onChange={setHasTags} />
                <Text>仅看已打标签</Text>
              </Space>
            </Space>

            {focusedImportBatch ? (
              <div className="member-asset-inline-note">
                <Text strong>{`当前正在查看导入批次：${focusedImportBatch.memberName}`}</Text>
                <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                  已聚焦本批次共 {focusedImportBatch.createdAssetIds.length}{' '}
                  项资料。你可以直接继续批量整理，或清除批次筛选回到全量资料中心。
                </Paragraph>
                <Button
                  size="small"
                  onClick={() => {
                    setFocusedImportBatch(null);
                    setSelectedAssetIds([]);
                  }}
                >
                  清除批次筛选
                </Button>
              </div>
            ) : null}

            {isAdmin ? (
              <div className="asset-batch-toolbar">
                <Space wrap>
                  <Text strong>当前已选 {selectedCount} 项</Text>
                  <Button
                    size="small"
                    disabled={currentPageAssetIds.length === 0}
                    onClick={() =>
                      setSelectedAssetIds((current) =>
                        isAllCurrentPageSelected
                          ? current.filter((id) => !currentPageAssetIds.includes(id))
                          : Array.from(new Set([...current, ...currentPageAssetIds])),
                      )
                    }
                  >
                    {isAllCurrentPageSelected ? '取消当前页全选' : '全选当前页'}
                  </Button>
                  <Button
                    size="small"
                    disabled={selectedCount === 0}
                    onClick={() => setSelectedAssetIds([])}
                  >
                    清空选择
                  </Button>
                </Space>
                <Space wrap>
                  <Button
                    size="small"
                    disabled={selectedCount === 0}
                    loading={batchOperateMutation.isPending}
                    onClick={() => setBatchAction('APPEND_TAGS')}
                  >
                    批量追加标签
                  </Button>
                  <Button
                    size="small"
                    disabled={selectedCount === 0}
                    loading={batchOperateMutation.isPending}
                    onClick={() => setBatchAction('SET_SOURCE_TYPE')}
                  >
                    批量设置来源
                  </Button>
                  <Popconfirm
                    title={`确定批量删除这 ${selectedCount} 项资料吗？`}
                    description="删除后资料会从系统中移除，请谨慎操作。"
                    disabled={selectedCount === 0}
                    onConfirm={() =>
                      batchOperateMutation.mutate({
                        action: 'DELETE',
                        assetIds: selectedAssetIds,
                      })
                    }
                  >
                    <Button
                      size="small"
                      danger
                      disabled={selectedCount === 0}
                      loading={batchOperateMutation.isPending}
                    >
                      批量删除
                    </Button>
                  </Popconfirm>
                </Space>
              </div>
            ) : null}

            {mergedTagOptions.length > 0 ? (
              <div className="asset-library-tag-wall">
                {mergedTagOptions.slice(0, 18).map((item) => (
                  <Tag
                    key={item.value}
                    color={tag === item.value ? 'processing' : 'default'}
                    className="asset-library-filter-tag"
                    onClick={() => setTag(tag === item.value ? undefined : item.value)}
                  >
                    {item.label}
                  </Tag>
                ))}
              </div>
            ) : null}
          </Space>
        </Card>

        <Card className="soft-panel" loading={assetLibraryQuery.isLoading}>
          <List
            dataSource={response?.data ?? []}
            locale={{ emptyText: '当前条件下暂无匹配资料。' }}
            grid={{ gutter: 16, xs: 1, sm: 1, md: 2, xl: 3, xxl: 4 }}
            renderItem={(asset) => (
              <List.Item>
                <Card
                  className={`asset-library-card${
                    selectedAssetIds.includes(asset.id) ? ' asset-library-card-selected' : ''
                  }`}
                  cover={renderAssetPreview(asset)}
                  actions={[
                    <a
                      key="open"
                      href={toAbsoluteAssetUrl(asset.fileUrl) ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <LinkOutlined /> 打开
                    </a>,
                    <Link key="member" href={`/members/${asset.member.id}`}>
                      成员详情
                    </Link>,
                    <Link key="graph" href={`/graph?memberId=${asset.member.id}`}>
                      <NodeIndexOutlined /> 图谱
                    </Link>,
                  ]}
                >
                  <div className="asset-library-card-body">
                    {isAdmin ? (
                      <div className="asset-library-select">
                        <Checkbox
                          checked={selectedAssetIds.includes(asset.id)}
                          onChange={(event) =>
                            toggleAssetSelection(asset.id, event.target.checked)
                          }
                        >
                          选择
                        </Checkbox>
                      </div>
                    ) : null}
                    <Space wrap size={[8, 8]}>
                      <Tag color={asset.category === 'PHOTO' ? 'magenta' : 'blue'}>
                        {asset.category === 'PHOTO' ? '照片' : '附件'}
                      </Tag>
                      <Tag>{asset.member.name}</Tag>
                      {asset.member.generationName ? <Tag>{asset.member.generationName} 辈</Tag> : null}
                    </Space>

                    <Title level={5} className="asset-library-title">
                      {asset.title || asset.originalName}
                    </Title>

                    {asset.title ? (
                      <Text type="secondary" className="asset-library-subline">
                        原文件：{asset.originalName}
                      </Text>
                    ) : null}

                    {asset.source || asset.sourceType ? (
                      <Text type="secondary" className="asset-library-subline">
                        来源：
                        {[asset.sourceType, asset.source].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}

                    <Text type="secondary" className="asset-library-subline">
                      关联成员：
                      <Link href={`/members/${asset.member.id}`}>{asset.member.name}</Link>
                      {asset.member.nativePlace ? ` · ${asset.member.nativePlace}` : ''}
                    </Text>

                    {asset.description ? (
                      <Paragraph className="asset-library-description">
                        {asset.description}
                      </Paragraph>
                    ) : null}

                    {asset.tags.length > 0 ? (
                      <Space wrap size={[6, 6]}>
                        {asset.tags.map((item) => (
                          <Tag
                            key={`${asset.id}-${item}`}
                            color={tag === item ? 'processing' : 'default'}
                            className="asset-library-filter-tag"
                            onClick={() => setTag(tag === item ? undefined : item)}
                          >
                            {item}
                          </Tag>
                        ))}
                      </Space>
                    ) : null}

                    <div className="asset-library-meta-row">
                      <Text type="secondary">
                        上传于 {formatDate(asset.createdAt, 'YYYY-MM-DD HH:mm')}
                      </Text>
                      <Text type="secondary">
                        {Math.max(1, Math.round(asset.sizeBytes / 1024))} KB
                      </Text>
                    </div>

                    {isAdmin ? (
                      <Space wrap className="asset-library-admin-actions">
                        <Button
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => setEditingAsset(asset)}
                        >
                          编辑资料信息
                        </Button>
                        <Popconfirm
                          title="确定删除这项资料吗？"
                          onConfirm={() => deleteAssetMutation.mutate(asset)}
                        >
                          <Button size="small" danger icon={<DeleteOutlined />}>
                            删除
                          </Button>
                        </Popconfirm>
                      </Space>
                    ) : null}
                  </div>
                </Card>
              </List.Item>
            )}
          />

          {response && response.total > response.pageSize ? (
            <div className="asset-library-pagination">
              <Space wrap>
                <Button
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  上一页
                </Button>
                <Text type="secondary">
                  第 {response.page} / {Math.max(1, Math.ceil(response.total / response.pageSize))} 页
                </Text>
                <Button
                  disabled={response.page >= Math.ceil(response.total / response.pageSize)}
                  onClick={() => setPage((current) => current + 1)}
                >
                  下一页
                </Button>
                <Select
                  value={pageSize}
                  style={{ width: 120 }}
                  options={[
                    { label: '每页 12 条', value: 12 },
                    { label: '每页 18 条', value: 18 },
                    { label: '每页 24 条', value: 24 },
                    { label: '每页 36 条', value: 36 },
                  ]}
                  onChange={setPageSize}
                />
              </Space>
            </div>
          ) : null}
        </Card>

        <MemberAssetModal
          open={Boolean(editingAsset)}
          mode="edit"
          category={editingAsset?.category ?? 'PHOTO'}
          memberName={editingAsset?.member.name}
          initialValue={editingAsset}
          loading={updateAssetMutation.isPending}
          onCancel={() => setEditingAsset(null)}
          onSubmit={async (values) => {
            if (!editingAsset) {
              return;
            }

            await updateAssetMutation.mutateAsync({
              memberId: editingAsset.memberId,
              assetId: editingAsset.id,
              sourceType: values.sourceType,
              title: values.title,
              source: values.source,
              tags: values.tags,
              description: values.description,
            });
          }}
        />

        <AssetImportWizardModal
          open={importOpen}
          loading={importWizardMutation.isPending}
          onCancel={() => setImportOpen(false)}
          onSubmit={async (values) => {
            await importWizardMutation.mutateAsync({
              memberId: values.memberId,
              category: values.category,
              files: values.files,
              sourceType: values.sourceType,
              source: values.source,
              tags: values.tags,
              description: values.description,
              resolvedTitles: values.resolvedTitles,
            });
          }}
        />

        <AssetImportResultModal
          open={Boolean(lastImportResult)}
          result={lastImportResult}
          onClose={() => setLastImportResult(null)}
          onViewBatch={(payload) => focusImportBatch(payload)}
          onContinueBatch={(payload) => focusImportBatch(payload, { preselect: true })}
        />

        <AssetBatchModal
          open={Boolean(batchAction)}
          action={batchAction ?? 'APPEND_TAGS'}
          selectedCount={selectedCount}
          loading={batchOperateMutation.isPending}
          onCancel={() => setBatchAction(null)}
          onSubmit={async (values) => {
            if (!batchAction || selectedAssetIds.length === 0) {
              return;
            }

            await batchOperateMutation.mutateAsync({
              action: batchAction,
              assetIds: selectedAssetIds,
              tags: values.tags,
              sourceType: values.sourceType,
            });
          }}
        />
      </div>
    </AuthGuard>
  );
}
