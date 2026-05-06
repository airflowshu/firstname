'use client';

import {
  DownloadOutlined,
  EditOutlined,
  FilterOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Dropdown,
  Input,
  List,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useViewportMode } from '@/hooks/use-viewport-mode';
import { AuthGuard } from '@/components/auth-guard';
import { MemberImportModal } from '@/components/member-import-modal';
import { MemberFormModal } from '@/components/member-form-modal';
import { useAuth } from '@/components/auth-provider';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { MemberListItem } from '@/lib/types';

const { Paragraph, Text, Title } = Typography;

function formatGender(value: string) {
  return value === 'MALE' ? '男' : value === 'FEMALE' ? '女' : '未知';
}

function formatLifeStatus(value: string) {
  return value === 'ALIVE' ? '在世' : value === 'DECEASED' ? '已故' : '未知';
}

export default function MembersPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAdmin } = useAuth();
  const { isMobile } = useViewportMode();
  const [keywordInput, setKeywordInput] = useState(searchParams.get('keyword') ?? '');
  const [keyword, setKeyword] = useState(searchParams.get('keyword') ?? '');
  const [gender, setGender] = useState<string | undefined>(searchParams.get('gender') ?? undefined);
  const [lifeStatus, setLifeStatus] = useState<string | undefined>(
    searchParams.get('lifeStatus') ?? undefined,
  );
  const [editingMember, setEditingMember] = useState<MemberListItem | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  useEffect(() => {
    const nextKeyword = searchParams.get('keyword') ?? '';
    const nextGender = searchParams.get('gender') ?? undefined;
    const nextLifeStatus = searchParams.get('lifeStatus') ?? undefined;

    setKeywordInput(nextKeyword);
    setKeyword(nextKeyword);
    setGender(nextGender);
    setLifeStatus(nextLifeStatus);
  }, [searchParams]);

  useEffect(() => {
    if (isMobile) {
      setFiltersExpanded(false);
    }
  }, [isMobile]);

  const updateSearchParams = useCallback(
    (patch: Record<string, string | undefined>) => {
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
    },
    [pathname, router, searchParams],
  );

  const membersQuery = useQuery({
    queryKey: ['members', keyword, gender, lifeStatus],
    queryFn: () =>
      api.getMembers({
        page: 1,
        pageSize: 50,
        keyword,
        gender,
        lifeStatus,
      }),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (editingMember) {
        return api.updateMember(editingMember.id, payload);
      }

      return api.createMember(payload);
    },
    onSuccess: async () => {
      message.success(editingMember ? '成员信息已更新' : '成员已创建');
      setModalOpen(false);
      setEditingMember(undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['members'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '保存失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (member: MemberListItem) => {
      if (member.isDeleted) {
        await api.restoreMember(member.id);
        return null;
      }

      await api.deleteMember(member.id);
      return null;
    },
    onSuccess: async (_result, member) => {
      message.success(member.isDeleted ? '成员已恢复' : '成员已删除');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['members'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '操作失败');
    },
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => api.importMembers(file),
    onSuccess: async (result) => {
      message.success(result.message);
      setImportOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['members'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '导入失败');
    },
  });

  const handleKeywordSearch = (nextKeyword: string) => {
    const normalized = nextKeyword.trim();
    setKeywordInput(nextKeyword);
    setKeyword(normalized);
    updateSearchParams({ keyword: normalized || undefined });
  };

  const activeFilters = useMemo(
    () =>
      [
        keyword ? { key: 'keyword', label: `关键词：${keyword}` } : null,
        gender ? { key: 'gender', label: `性别：${formatGender(gender)}` } : null,
        lifeStatus ? { key: 'lifeStatus', label: `生命状态：${formatLifeStatus(lifeStatus)}` } : null,
      ].filter(Boolean) as Array<{ key: string; label: string }>,
    [gender, keyword, lifeStatus],
  );

  const actionColumn = useMemo(
    () => ({
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: MemberListItem) => (
        <Space wrap>
          <Button size="small">
            <Link href={`/members/${record.id}`}>详情</Link>
          </Button>
          <Button size="small">
            <Link href={`/graph?memberId=${record.id}`}>图谱</Link>
          </Button>
          {isAdmin ? (
            <>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setEditingMember(record);
                  setModalOpen(true);
                }}
              >
                编辑
              </Button>
              <Popconfirm
                title={record.isDeleted ? '确定恢复该成员吗？' : '确定删除该成员吗？'}
                onConfirm={() => deleteMutation.mutate(record)}
              >
                <Button size="small" danger={!record.isDeleted}>
                  {record.isDeleted ? '恢复' : '删除'}
                </Button>
              </Popconfirm>
            </>
          ) : null}
        </Space>
      ),
    }),
    [deleteMutation, isAdmin],
  );

  const desktopColumns = [
    {
      title: '姓名',
      dataIndex: 'name',
      render: (_value: string, record: MemberListItem) => (
        <Space>
          <Link
            href={`/members/${record.id}`}
            className={record.lifeStatus === 'DECEASED' ? 'member-name-deceased' : undefined}
          >
            {record.name}
          </Link>
          {record.isDeleted ? <Tag color="error">已软删除</Tag> : null}
        </Space>
      ),
    },
    {
      title: '性别',
      dataIndex: 'gender',
      render: (value: string) => formatGender(value),
    },
    {
      title: '出生 / 籍贯',
      key: 'birth-native',
      render: (_: unknown, record: MemberListItem) => (
        <Space direction="vertical" size={2}>
          <Text>{formatDate(record.birthDate) || '出生日期未填写'}</Text>
          <Text type="secondary">{record.nativePlace ?? '籍贯（待补充）'}</Text>
        </Space>
      ),
    },
    {
      title: '父母关系',
      key: 'parent-summary',
      render: (_: unknown, record: MemberListItem) => (
        <Space direction="vertical" size={2}>
          <Text type="secondary">父亲：{record.father?.name ?? '-'}</Text>
          <Text type="secondary">母亲：{record.mother?.name ?? '-'}</Text>
        </Space>
      ),
    },
    {
      title: '字辈',
      dataIndex: 'generationName',
      render: (value?: string | null) => value ?? '-',
    },
    actionColumn,
  ];

  return (
    <AuthGuard>
      <div className="page-stack">
        <Card className="soft-panel">
          <div className="page-hero">
            <div className="page-hero-copy">
              <div className="page-eyebrow">Member Workspace</div>
              <Title level={3} className="page-hero-title">
                成员管理
              </Title>
              <Paragraph className="page-hero-desc">
                先筛后查、先看摘要再进详情，把成员录入、回看和关系维护串成一条更高频的工作路径。
              </Paragraph>
            </div>
            <div className="page-hero-actions">
              {isAdmin ? (
                <>
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'export',
                          icon: <DownloadOutlined />,
                          label: 'Excel 导出',
                          onClick: async () => {
                            try {
                              const file = await api.exportMembers();
                              const url = window.URL.createObjectURL(file);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = '家族成员导出.xlsx';
                              link.click();
                              window.URL.revokeObjectURL(url);
                            } catch (error) {
                              message.error(error instanceof ApiError ? error.message : '导出失败');
                            }
                          },
                        },
                        {
                          key: 'import',
                          icon: <UploadOutlined />,
                          label: 'Excel 导入',
                          onClick: () => setImportOpen(true),
                        },
                      ],
                    }}
                  >
                    <Button>{isMobile ? '更多' : '更多操作'}</Button>
                  </Dropdown>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setEditingMember(undefined);
                      setModalOpen(true);
                    }}
                  >
                    {isMobile ? '新建' : '新建成员'}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </Card>

        <Card className="soft-panel">
          <div className="filter-panel">
            <div className="filter-panel-header">
              <div>
                <Title level={5} className="filter-panel-title">
                  检索与筛选
                </Title>
                <Text className="results-hint">
                  当前共 {membersQuery.data?.total ?? 0} 位成员，命中 {membersQuery.data?.data.length ?? 0}{' '}
                  位。
                </Text>
              </div>
              <div className="filter-panel-meta">
                <Tag color={activeFilters.length > 0 ? 'processing' : 'default'}>
                  已启用筛选 {activeFilters.length} 项
                </Tag>
                <Button
                  icon={<FilterOutlined />}
                  onClick={() => setFiltersExpanded((current) => !current)}
                >
                  {filtersExpanded
                    ? isMobile
                      ? '收起'
                      : '收起筛选'
                    : isMobile
                      ? '筛选'
                      : '展开筛选'}
                </Button>
              </div>
            </div>

            {activeFilters.length > 0 ? (
              <div className="filter-chip-row">
                {activeFilters.map((item) => (
                  <Tag
                    key={item.key}
                    closable
                    color="processing"
                    onClose={() => {
                      if (item.key === 'keyword') {
                        setKeyword('');
                        setKeywordInput('');
                        updateSearchParams({ keyword: undefined });
                        return;
                      }

                      if (item.key === 'gender') {
                        setGender(undefined);
                        updateSearchParams({ gender: undefined });
                        return;
                      }

                      setLifeStatus(undefined);
                      updateSearchParams({ lifeStatus: undefined });
                    }}
                  >
                    {item.label}
                  </Tag>
                ))}
              </div>
            ) : null}

            {filtersExpanded ? (
              <div className="filter-grid filter-grid-compact members-filter-grid">
                <Input.Search
                  allowClear
                  placeholder="搜索姓名 / 籍贯 / 字辈"
                  value={keywordInput}
                  onChange={(event) => setKeywordInput(event.target.value)}
                  onSearch={handleKeywordSearch}
                />
                <Select
                  allowClear
                  placeholder="性别"
                  value={gender}
                  options={[
                    { label: '男', value: 'MALE' },
                    { label: '女', value: 'FEMALE' },
                    { label: '未知', value: 'UNKNOWN' },
                  ]}
                  onChange={(value) => {
                    setGender(value);
                    updateSearchParams({ gender: value });
                  }}
                />
                <Select
                  allowClear
                  placeholder="生命状态"
                  value={lifeStatus}
                  options={[
                    { label: '在世', value: 'ALIVE' },
                    { label: '已故', value: 'DECEASED' },
                    { label: '未知', value: 'UNKNOWN' },
                  ]}
                  onChange={(value) => {
                    setLifeStatus(value);
                    updateSearchParams({ lifeStatus: value });
                  }}
                />
                <Space className="members-filter-actions">
                  <Button icon={<ReloadOutlined />} onClick={() => membersQuery.refetch()}>
                    刷新
                  </Button>
                  <Button
                    onClick={() => {
                      setKeyword('');
                      setKeywordInput('');
                      setGender(undefined);
                      setLifeStatus(undefined);
                      router.replace(pathname);
                    }}
                  >
                    清空筛选
                  </Button>
                </Space>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="soft-panel" loading={membersQuery.isLoading}>
          {isMobile ? (
            <List
              dataSource={membersQuery.data?.data ?? []}
              locale={{ emptyText: '暂无匹配成员' }}
              className="mobile-list"
              renderItem={(record) => (
                <List.Item style={{ padding: 0, border: 'none' }}>
                  <Card className="mobile-list-card">
                    <div className="mobile-list-meta">
                      <div className="mobile-list-card-head">
                        <div>
                          <div className="mobile-list-title">
                            <Link
                              href={`/members/${record.id}`}
                              className={record.lifeStatus === 'DECEASED' ? 'member-name-deceased' : undefined}
                            >
                              {record.name}
                            </Link>
                          </div>
                          <Space wrap size={[6, 6]} style={{ marginTop: 8 }}>
                            <Tag>{formatGender(record.gender)}</Tag>
                            {record.isDeleted ? <Tag color="error">已软删除</Tag> : null}
                          </Space>
                        </div>
                        <Button size="small">
                          <Link href={`/graph?memberId=${record.id}`}>关系图</Link>
                        </Button>
                      </div>

                      <div className="mobile-list-row">
                        <span className="mobile-list-label">出生日期</span>
                        <span className="mobile-list-value">{formatDate(record.birthDate) || '-'}</span>
                      </div>
                      <div className="mobile-list-row">
                        <span className="mobile-list-label">籍贯</span>
                        <span className="mobile-list-value">{record.nativePlace ?? '-'}</span>
                      </div>
                      <div className="mobile-list-row">
                        <span className="mobile-list-label">父母关系</span>
                        <span className="mobile-list-value">
                          父 {record.father?.name ?? '-'} / 母 {record.mother?.name ?? '-'}
                        </span>
                      </div>
                      <div className="mobile-list-row">
                        <span className="mobile-list-label">字辈</span>
                        <span className="mobile-list-value">{record.generationName ?? '-'}</span>
                      </div>

                      <Space wrap className="mobile-list-actions">
                        <Button size="small">
                          <Link href={`/members/${record.id}`}>查看详情</Link>
                        </Button>
                        {isAdmin ? (
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => {
                              setEditingMember(record);
                              setModalOpen(true);
                            }}
                          >
                            编辑
                          </Button>
                        ) : null}
                        {isAdmin ? (
                          <Popconfirm
                            title={record.isDeleted ? '确定恢复该成员吗？' : '确定删除该成员吗？'}
                            onConfirm={() => deleteMutation.mutate(record)}
                          >
                            <Button size="small" danger={!record.isDeleted}>
                              {record.isDeleted ? '恢复' : '删除'}
                            </Button>
                          </Popconfirm>
                        ) : null}
                      </Space>
                    </div>
                  </Card>
                </List.Item>
              )}
            />
          ) : (
            <Table
              rowKey="id"
              dataSource={membersQuery.data?.data ?? []}
              pagination={false}
              columns={desktopColumns}
            />
          )}
        </Card>

        <MemberFormModal
          open={modalOpen}
          title={editingMember ? `编辑成员：${editingMember.name}` : '新建成员'}
          initialValue={editingMember}
          loading={saveMutation.isPending}
          onCancel={() => {
            setModalOpen(false);
            setEditingMember(undefined);
          }}
          onSubmit={async (values) => {
            await saveMutation.mutateAsync(values);
          }}
        />

        <MemberImportModal
          open={importOpen}
          loading={importMutation.isPending}
          onCancel={() => setImportOpen(false)}
          onDownloadTemplate={async () => {
            try {
              const file = await api.downloadMemberImportTemplate();
              const url = window.URL.createObjectURL(file);
              const link = document.createElement('a');
              link.href = url;
              link.download = '家族成员导入模板.xlsx';
              link.click();
              window.URL.revokeObjectURL(url);
            } catch (error) {
              message.error(error instanceof ApiError ? error.message : '模板下载失败');
            }
          }}
          onImport={async (file) => {
            await importMutation.mutateAsync(file);
          }}
        />
      </div>
    </AuthGuard>
  );
}
