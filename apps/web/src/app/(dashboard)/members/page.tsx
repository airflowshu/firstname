'use client';

import {
  DeleteOutlined,
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
  Checkbox,
  Dropdown,
  Input,
  InputNumber,
  List,
  Pagination,
  Popconfirm,
  Popover,
  Select,
  Space,
  Table,
  type TableProps,
  Tag,
  Typography,
} from 'antd';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Key } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useViewportMode } from '@/hooks/use-viewport-mode';
import { AuthGuard } from '@/components/auth-guard';
import { MemberImportModal } from '@/components/member-import-modal';
import { MemberFormModal } from '@/components/member-form-modal';
import { useAuth } from '@/components/auth-provider';
import {
  api,
  ApiError,
  type MemberMutationPayload,
  type MemberSortBy,
  type MemberSortOrder,
} from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Gender, LifeStatus, MemberListItem } from '@/lib/types';

const { Paragraph, Text, Title } = Typography;
const DEFAULT_PAGE_SIZE = 20;

type BooleanFilter = boolean | undefined;
type MemberTableColumn = NonNullable<TableProps<MemberListItem>['columns']>[number];

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseOptionalInt(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

function parseBooleanFilter(value: string | null): BooleanFilter {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return undefined;
}

function formatBooleanFilter(value: BooleanFilter, trueText: string, falseText: string) {
  if (value === true) {
    return trueText;
  }

  if (value === false) {
    return falseText;
  }

  return undefined;
}

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
  const [generationNameInput, setGenerationNameInput] = useState(
    searchParams.get('generationName') ?? '',
  );
  const [generationName, setGenerationName] = useState(searchParams.get('generationName') ?? '');
  const [nativePlaceInput, setNativePlaceInput] = useState(searchParams.get('nativePlace') ?? '');
  const [nativePlace, setNativePlace] = useState(searchParams.get('nativePlace') ?? '');
  const [birthYearFrom, setBirthYearFrom] = useState<number | undefined>(
    parseOptionalInt(searchParams.get('birthYearFrom')),
  );
  const [birthYearTo, setBirthYearTo] = useState<number | undefined>(
    parseOptionalInt(searchParams.get('birthYearTo')),
  );
  const [gender, setGender] = useState<Gender | undefined>(
    (searchParams.get('gender') as Gender | null) ?? undefined,
  );
  const [lifeStatus, setLifeStatus] = useState<LifeStatus | undefined>(
    (searchParams.get('lifeStatus') as LifeStatus | null) ?? undefined,
  );
  const [hasPhoto, setHasPhoto] = useState<BooleanFilter>(
    parseBooleanFilter(searchParams.get('hasPhoto')),
  );
  const [hasAssets, setHasAssets] = useState<BooleanFilter>(
    parseBooleanFilter(searchParams.get('hasAssets')),
  );
  const [includeDeleted, setIncludeDeleted] = useState(searchParams.get('includeDeleted') === 'true');
  const [page, setPage] = useState(parsePositiveInt(searchParams.get('page'), 1));
  const [pageSize, setPageSize] = useState(
    parsePositiveInt(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE),
  );
  const [sortBy, setSortBy] = useState<MemberSortBy | undefined>(
    (searchParams.get('sortBy') as MemberSortBy | null) ?? undefined,
  );
  const [sortOrder, setSortOrder] = useState<MemberSortOrder | undefined>(
    (searchParams.get('sortOrder') as MemberSortOrder | null) ?? undefined,
  );
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>([
    'name',
    'gender',
    'birth-native',
    'parent-summary',
    'generationName',
    'assetCount',
    'actions',
  ]);
  const [editingMember, setEditingMember] = useState<MemberListItem | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [prefillLoading, setPrefillLoading] = useState(false);

  useEffect(() => {
    const nextKeyword = searchParams.get('keyword') ?? '';
    const nextGenerationName = searchParams.get('generationName') ?? '';
    const nextNativePlace = searchParams.get('nativePlace') ?? '';
    const nextGender = (searchParams.get('gender') as Gender | null) ?? undefined;
    const nextLifeStatus = (searchParams.get('lifeStatus') as LifeStatus | null) ?? undefined;

    setKeywordInput(nextKeyword);
    setKeyword(nextKeyword);
    setGenerationNameInput(nextGenerationName);
    setGenerationName(nextGenerationName);
    setNativePlaceInput(nextNativePlace);
    setNativePlace(nextNativePlace);
    setBirthYearFrom(parseOptionalInt(searchParams.get('birthYearFrom')));
    setBirthYearTo(parseOptionalInt(searchParams.get('birthYearTo')));
    setGender(nextGender);
    setLifeStatus(nextLifeStatus);
    setHasPhoto(parseBooleanFilter(searchParams.get('hasPhoto')));
    setHasAssets(parseBooleanFilter(searchParams.get('hasAssets')));
    setIncludeDeleted(searchParams.get('includeDeleted') === 'true');
    setPage(parsePositiveInt(searchParams.get('page'), 1));
    setPageSize(parsePositiveInt(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE));
    setSortBy((searchParams.get('sortBy') as MemberSortBy | null) ?? undefined);
    setSortOrder((searchParams.get('sortOrder') as MemberSortOrder | null) ?? undefined);
  }, [searchParams]);

  useEffect(() => {
    if (isMobile) {
      setFiltersExpanded(false);
    }
  }, [isMobile]);

  const updateSearchParams = useCallback(
    (
      patch: Record<string, string | number | boolean | undefined>,
      options?: { resetPage?: boolean },
    ) => {
      const nextParams = new URLSearchParams(searchParams.toString());

      Object.entries(patch).forEach(([key, value]) => {
        if (value !== undefined && value !== '' && value !== false) {
          nextParams.set(key, String(value));
        } else {
          nextParams.delete(key);
        }
      });

      if (options?.resetPage) {
        nextParams.delete('page');
      }
      if (nextParams.get('page') === '1') {
        nextParams.delete('page');
      }
      if (nextParams.get('pageSize') === String(DEFAULT_PAGE_SIZE)) {
        nextParams.delete('pageSize');
      }

      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const membersQuery = useQuery({
    queryKey: [
      'members',
      page,
      pageSize,
      keyword,
      generationName,
      birthYearFrom,
      birthYearTo,
      nativePlace,
      gender,
      lifeStatus,
      hasPhoto,
      hasAssets,
      includeDeleted,
      sortBy,
      sortOrder,
    ],
    queryFn: () =>
      api.getMembers({
        page,
        pageSize,
        keyword,
        generationName,
        birthYearFrom,
        birthYearTo,
        nativePlace,
        gender,
        lifeStatus,
        hasPhoto,
        hasAssets,
        includeDeleted,
        sortBy,
        sortOrder,
      }),
  });

  useEffect(() => {
    setSelectedRowKeys([]);
  }, [
    page,
    pageSize,
    keyword,
    generationName,
    birthYearFrom,
    birthYearTo,
    nativePlace,
    gender,
    lifeStatus,
    hasPhoto,
    hasAssets,
    includeDeleted,
    sortBy,
    sortOrder,
  ]);

  const saveMutation = useMutation<unknown, Error, MemberMutationPayload>({
    mutationFn: async (payload: MemberMutationPayload) => {
      if (!isAdmin) {
        if (editingMember) {
          return api.createMemberUpdateRequest({
            memberId: editingMember.id,
            patch: payload,
          });
        }

        return api.createMemberCreateRequest({
          member: payload,
        });
      }

      if (editingMember) {
        return api.updateMember(editingMember.id, payload);
      }

      return api.createMember(payload);
    },
    onSuccess: async () => {
      message.success(
        isAdmin
          ? editingMember
            ? '成员信息已更新'
            : '成员已创建'
          : '变更申请已提交，等待管理员审核',
      );
      setModalOpen(false);
      setEditingMember(undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['members'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['supplement-requests'] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '保存失败');
    },
  });

  const deleteMutation = useMutation<unknown, Error, MemberListItem>({
    mutationFn: async (member: MemberListItem) => {
      if (!isAdmin) {
        if (member.isDeleted) {
          await api.createMemberRestoreRequest({ memberId: member.id });
          return null;
        }

        await api.createMemberDeleteRequest({ memberId: member.id });
        return null;
      }

      if (member.isDeleted) {
        await api.restoreMember(member.id);
        return null;
      }

      await api.deleteMember(member.id);
      return null;
    },
    onSuccess: async (_result, member) => {
      message.success(
        isAdmin
          ? member.isDeleted
            ? '成员已恢复'
            : '成员已删除'
          : '变更申请已提交，等待管理员审核',
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['members'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['supplement-requests'] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '操作失败');
    },
  });

  const membersPageData = membersQuery.data?.data;
  const currentMembers = useMemo(() => membersPageData ?? [], [membersPageData]);
  const selectedKeySet = useMemo(() => new Set(selectedRowKeys.map(String)), [selectedRowKeys]);
  const selectedMembers = useMemo(
    () => currentMembers.filter((member) => selectedKeySet.has(member.id)),
    [currentMembers, selectedKeySet],
  );
  const currentPageKeys = useMemo(() => currentMembers.map((member) => member.id), [currentMembers]);
  const currentPageSelectedCount = useMemo(
    () => currentPageKeys.filter((key) => selectedKeySet.has(key)).length,
    [currentPageKeys, selectedKeySet],
  );
  const allCurrentPageSelected =
    currentPageKeys.length > 0 && currentPageSelectedCount === currentPageKeys.length;
  const hasSelectedActiveMembers = selectedMembers.some((member) => !member.isDeleted);
  const hasSelectedDeletedMembers = selectedMembers.some((member) => member.isDeleted);

  const toggleCurrentPageSelection = useCallback(() => {
    setSelectedRowKeys((current) => {
      const currentSet = new Set(current.map(String));
      const shouldClearCurrentPage =
        currentPageKeys.length > 0 && currentPageKeys.every((key) => currentSet.has(key));

      currentPageKeys.forEach((key) => {
        if (shouldClearCurrentPage) {
          currentSet.delete(key);
        } else {
          currentSet.add(key);
        }
      });

      return Array.from(currentSet);
    });
  }, [currentPageKeys]);

  const toggleMemberSelection = useCallback((memberId: string, checked: boolean) => {
    setSelectedRowKeys((current) => {
      const currentSet = new Set(current.map(String));

      if (checked) {
        currentSet.add(memberId);
      } else {
        currentSet.delete(memberId);
      }

      return Array.from(currentSet);
    });
  }, []);

  const batchMutation = useMutation<unknown, Error, 'delete' | 'restore'>({
    mutationFn: async (action) => {
      const targetMembers = selectedMembers.filter((member) =>
        action === 'restore' ? member.isDeleted : !member.isDeleted,
      );

      await Promise.all(
        targetMembers.map((member) => {
          if (!isAdmin) {
            return action === 'restore'
              ? api.createMemberRestoreRequest({ memberId: member.id })
              : api.createMemberDeleteRequest({ memberId: member.id });
          }

          return action === 'restore' ? api.restoreMember(member.id) : api.deleteMember(member.id);
        }),
      );
    },
    onSuccess: async (_result, action) => {
      message.success(action === 'restore' ? '已批量恢复成员' : '已批量删除成员');
      setSelectedRowKeys([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['members'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['supplement-requests'] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '批量操作失败');
    },
  });

  const importMutation = useMutation<unknown, Error, File>({
    mutationFn: (file: File) => (isAdmin ? api.importMembers(file) : api.createMemberImportRequest(file)),
    onSuccess: async (result) => {
      message.success(
        isAdmin && typeof result === 'object' && result !== null && 'message' in result
          ? String(result.message)
          : '批量导入申请已提交，等待管理员审核',
      );
      setImportOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['members'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['supplement-requests'] }),
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
    updateSearchParams({ keyword: normalized || undefined }, { resetPage: true });
  };

  const updateTextFilter = (
    key: 'generationName' | 'nativePlace',
    value: string,
    setter: (value: string) => void,
  ) => {
    const normalized = value.trim();
    setter(normalized);
    updateSearchParams({ [key]: normalized || undefined }, { resetPage: true });
  };

  const updateBooleanFilter = (
    key: 'hasPhoto' | 'hasAssets',
    value: BooleanFilter,
    setter: (value: BooleanFilter) => void,
  ) => {
    setter(value);
    updateSearchParams({ [key]: value === undefined ? undefined : String(value) }, { resetPage: true });
  };

  const clearAllFilters = () => {
    setKeyword('');
    setKeywordInput('');
    setGenerationName('');
    setGenerationNameInput('');
    setNativePlace('');
    setNativePlaceInput('');
    setBirthYearFrom(undefined);
    setBirthYearTo(undefined);
    setGender(undefined);
    setLifeStatus(undefined);
    setHasPhoto(undefined);
    setHasAssets(undefined);
    setIncludeDeleted(false);
    setPage(1);
    setPageSize(DEFAULT_PAGE_SIZE);
    setSortBy(undefined);
    setSortOrder(undefined);
    setSelectedRowKeys([]);
    router.replace(pathname);
  };

  const activeFilters = useMemo(
    () =>
      [
        keyword ? { key: 'keyword', label: `关键词：${keyword}` } : null,
        generationName ? { key: 'generationName', label: `字辈：${generationName}` } : null,
        nativePlace ? { key: 'nativePlace', label: `籍贯：${nativePlace}` } : null,
        birthYearFrom ? { key: 'birthYearFrom', label: `出生起：${birthYearFrom}` } : null,
        birthYearTo ? { key: 'birthYearTo', label: `出生止：${birthYearTo}` } : null,
        gender ? { key: 'gender', label: `性别：${formatGender(gender)}` } : null,
        lifeStatus ? { key: 'lifeStatus', label: `生命状态：${formatLifeStatus(lifeStatus)}` } : null,
        hasPhoto !== undefined
          ? {
              key: 'hasPhoto',
              label: formatBooleanFilter(hasPhoto, '有头像', '无头像') ?? '',
            }
          : null,
        hasAssets !== undefined
          ? {
              key: 'hasAssets',
              label: formatBooleanFilter(hasAssets, '有资料', '无资料') ?? '',
            }
          : null,
        includeDeleted ? { key: 'includeDeleted', label: '包含软删除' } : null,
      ].filter(Boolean) as Array<{ key: string; label: string }>,
    [
      birthYearFrom,
      birthYearTo,
      gender,
      generationName,
      hasAssets,
      hasPhoto,
      includeDeleted,
      keyword,
      lifeStatus,
      nativePlace,
    ],
  );

  const removeFilter = (key: string) => {
    if (key === 'keyword') {
      setKeyword('');
      setKeywordInput('');
      updateSearchParams({ keyword: undefined }, { resetPage: true });
      return;
    }
    if (key === 'generationName') {
      setGenerationName('');
      setGenerationNameInput('');
      updateSearchParams({ generationName: undefined }, { resetPage: true });
      return;
    }
    if (key === 'nativePlace') {
      setNativePlace('');
      setNativePlaceInput('');
      updateSearchParams({ nativePlace: undefined }, { resetPage: true });
      return;
    }
    if (key === 'birthYearFrom') {
      setBirthYearFrom(undefined);
      updateSearchParams({ birthYearFrom: undefined }, { resetPage: true });
      return;
    }
    if (key === 'birthYearTo') {
      setBirthYearTo(undefined);
      updateSearchParams({ birthYearTo: undefined }, { resetPage: true });
      return;
    }
    if (key === 'gender') {
      setGender(undefined);
      updateSearchParams({ gender: undefined }, { resetPage: true });
      return;
    }
    if (key === 'lifeStatus') {
      setLifeStatus(undefined);
      updateSearchParams({ lifeStatus: undefined }, { resetPage: true });
      return;
    }
    if (key === 'hasPhoto') {
      setHasPhoto(undefined);
      updateSearchParams({ hasPhoto: undefined }, { resetPage: true });
      return;
    }
    if (key === 'hasAssets') {
      setHasAssets(undefined);
      updateSearchParams({ hasAssets: undefined }, { resetPage: true });
      return;
    }
    if (key === 'includeDeleted') {
      setIncludeDeleted(false);
      updateSearchParams({ includeDeleted: undefined }, { resetPage: true });
    }
  };

  const openEditModal = useCallback(
    async (record: MemberListItem) => {
      setPrefillLoading(true);
      try {
        const detail = await api.getMember(record.id);
        setEditingMember(detail);
        setModalOpen(true);
      } catch (error) {
        message.error(error instanceof ApiError ? error.message : '成员详情加载失败');
      } finally {
        setPrefillLoading(false);
      }
    },
    [message],
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
          <>
              <Button
                size="small"
                icon={<EditOutlined />}
                loading={prefillLoading}
                onClick={() => void openEditModal(record)}
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
        </Space>
      ),
    }),
    [deleteMutation, openEditModal, prefillLoading],
  );

  const tableSortOrder = (field: MemberSortBy) =>
    sortBy === field ? (sortOrder === 'asc' ? 'ascend' : 'descend') : undefined;

  const desktopColumns: MemberTableColumn[] = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      sortOrder: tableSortOrder('name'),
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
      key: 'gender',
      render: (value: string) => formatGender(value),
    },
    {
      title: '出生 / 籍贯',
      key: 'birth-native',
      sorter: true,
      sortOrder: tableSortOrder('birthDate'),
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
      key: 'generationName',
      sorter: true,
      sortOrder: tableSortOrder('generationName'),
      render: (value?: string | null) => value ?? '-',
    },
    {
      title: '资料',
      dataIndex: 'assetCount',
      key: 'assetCount',
      render: (value?: number) => (value ? `${value} 项` : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: true,
      sortOrder: tableSortOrder('createdAt'),
      render: (value: string) => formatDate(value) || '-',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      sorter: true,
      sortOrder: tableSortOrder('updatedAt'),
      render: (value: string) => formatDate(value) || '-',
    },
    actionColumn,
  ];

  const columnOptions = [
    { label: '姓名', value: 'name' },
    { label: '性别', value: 'gender' },
    { label: '出生 / 籍贯', value: 'birth-native' },
    { label: '父母关系', value: 'parent-summary' },
    { label: '字辈', value: 'generationName' },
    { label: '资料', value: 'assetCount' },
    { label: '创建时间', value: 'createdAt' },
    { label: '更新时间', value: 'updatedAt' },
    { label: '操作', value: 'actions' },
  ];

  const visibleDesktopColumns = desktopColumns.filter((column) => {
    if (!column.key) {
      return true;
    }

    return visibleColumnKeys.includes(String(column.key));
  });

  const handleTableChange: TableProps<MemberListItem>['onChange'] = (_pagination, _filters, sorter) => {
    const activeSorter = Array.isArray(sorter) ? sorter.find((item) => item.order) : sorter;
    const columnKey = activeSorter?.columnKey;
    const nextSortBy =
      columnKey === 'name'
        ? 'name'
        : columnKey === 'birth-native'
          ? 'birthDate'
          : columnKey === 'generationName'
            ? 'generationName'
            : columnKey === 'createdAt'
              ? 'createdAt'
              : columnKey === 'updatedAt'
                ? 'updatedAt'
                : undefined;
    const nextSortOrder =
      activeSorter?.order === 'ascend'
        ? 'asc'
        : activeSorter?.order === 'descend'
          ? 'desc'
          : undefined;

    setSortBy(nextSortOrder ? nextSortBy : undefined);
    setSortOrder(nextSortOrder);
    updateSearchParams(
      {
        sortBy: nextSortOrder ? nextSortBy : undefined,
        sortOrder: nextSortOrder,
      },
      { resetPage: true },
    );
  };

  const paginationNode = (
    <div className="asset-library-pagination">
      <Pagination
        current={page}
        pageSize={pageSize}
        total={membersQuery.data?.total ?? 0}
        showSizeChanger
        pageSizeOptions={[10, 20, 50, 100]}
        showTotal={(total, range) => `第 ${range[0]}-${range[1]} 位，共 ${total} 位`}
        onChange={(nextPage, nextPageSize) => {
          setPage(nextPage);
          setPageSize(nextPageSize);
          updateSearchParams({
            page: nextPage > 1 ? nextPage : undefined,
            pageSize: nextPageSize !== DEFAULT_PAGE_SIZE ? nextPageSize : undefined,
          });
        }}
      />
    </div>
  );

  const batchActionBar = (
    <div className="filter-panel-header" style={{ marginBottom: 12 }}>
      <Text className="results-hint">
        已选 {selectedRowKeys.length} 位，当前页显示 {currentMembers.length} 位
      </Text>
      <Space wrap>
        <Popover
          trigger="click"
          content={
            <Checkbox.Group
              value={visibleColumnKeys}
              options={columnOptions}
              onChange={(values) => {
                const nextKeys = values.map(String);
                setVisibleColumnKeys(nextKeys.length ? nextKeys : ['name']);
              }}
              style={{ display: 'grid', gap: 8 }}
            />
          }
        >
          <Button>列设置</Button>
        </Popover>
        <Button onClick={toggleCurrentPageSelection} disabled={currentMembers.length === 0}>
          {allCurrentPageSelected ? '取消本页' : '选择本页'}
        </Button>
        <Button onClick={() => setSelectedRowKeys([])} disabled={selectedRowKeys.length === 0}>
          清空选择
        </Button>
        <Popconfirm
          title="确定批量删除已选成员吗？"
          disabled={!hasSelectedActiveMembers}
          onConfirm={() => batchMutation.mutate('delete')}
        >
          <Button
            danger
            icon={<DeleteOutlined />}
            loading={batchMutation.isPending}
            disabled={!hasSelectedActiveMembers}
          >
            批量删除
          </Button>
        </Popconfirm>
        <Popconfirm
          title="确定批量恢复已选成员吗？"
          disabled={!hasSelectedDeletedMembers}
          onConfirm={() => batchMutation.mutate('restore')}
        >
          <Button
            loading={batchMutation.isPending}
            disabled={!hasSelectedDeletedMembers}
          >
            批量恢复
          </Button>
        </Popconfirm>
      </Space>
    </div>
  );

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
              <>
                  <Dropdown
                    menu={{
                      items: [
                        ...(isAdmin
                          ? [
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
                            ]
                          : []),
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
                  <Button>
                    <Link href="/supplement-requests">
                      {isAdmin ? '待审核变更' : '我的待审核变更'}
                    </Link>
                  </Button>
              </>
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
                  筛选结果 {membersQuery.data?.total ?? 0} 位成员，本页 {currentMembers.length} 位。
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
                    onClose={(event) => {
                      event.preventDefault();
                      removeFilter(item.key);
                    }}
                  >
                    {item.label}
                  </Tag>
                ))}
              </div>
            ) : null}

            {filtersExpanded ? (
              <div className="filter-grid">
                <Input.Search
                  allowClear
                  placeholder="搜索姓名 / 籍贯 / 字辈"
                  value={keywordInput}
                  onChange={(event) => setKeywordInput(event.target.value)}
                  onSearch={handleKeywordSearch}
                />
                <Input.Search
                  allowClear
                  placeholder="按字辈筛选"
                  value={generationNameInput}
                  onChange={(event) => setGenerationNameInput(event.target.value)}
                  onSearch={(value) => updateTextFilter('generationName', value, setGenerationName)}
                />
                <Input.Search
                  allowClear
                  placeholder="按籍贯筛选"
                  value={nativePlaceInput}
                  onChange={(event) => setNativePlaceInput(event.target.value)}
                  onSearch={(value) => updateTextFilter('nativePlace', value, setNativePlace)}
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
                    updateSearchParams({ gender: value }, { resetPage: true });
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
                    updateSearchParams({ lifeStatus: value }, { resetPage: true });
                  }}
                />
                <Space.Compact>
                  <InputNumber
                    min={1}
                    max={9999}
                    value={birthYearFrom}
                    placeholder="出生起"
                    style={{ width: '50%' }}
                    onChange={(value) => {
                      const nextValue = typeof value === 'number' ? value : undefined;
                      setBirthYearFrom(nextValue);
                      updateSearchParams({ birthYearFrom: nextValue }, { resetPage: true });
                    }}
                  />
                  <InputNumber
                    min={1}
                    max={9999}
                    value={birthYearTo}
                    placeholder="出生止"
                    style={{ width: '50%' }}
                    onChange={(value) => {
                      const nextValue = typeof value === 'number' ? value : undefined;
                      setBirthYearTo(nextValue);
                      updateSearchParams({ birthYearTo: nextValue }, { resetPage: true });
                    }}
                  />
                </Space.Compact>
                <Select
                  allowClear
                  placeholder="头像状态"
                  value={hasPhoto}
                  options={[
                    { label: '有头像', value: true },
                    { label: '无头像', value: false },
                  ]}
                  onChange={(value) => updateBooleanFilter('hasPhoto', value, setHasPhoto)}
                />
                <Select
                  allowClear
                  placeholder="资料状态"
                  value={hasAssets}
                  options={[
                    { label: '有资料', value: true },
                    { label: '无资料', value: false },
                  ]}
                  onChange={(value) => updateBooleanFilter('hasAssets', value, setHasAssets)}
                />
                <Checkbox
                  checked={includeDeleted}
                  onChange={(event) => {
                    setIncludeDeleted(event.target.checked);
                    updateSearchParams(
                      { includeDeleted: event.target.checked ? 'true' : undefined },
                      { resetPage: true },
                    );
                  }}
                >
                  包含软删除
                </Checkbox>
                <Space className="members-filter-actions">
                  <Button icon={<ReloadOutlined />} onClick={() => membersQuery.refetch()}>
                    刷新
                  </Button>
                  <Button onClick={clearAllFilters}>
                    清空筛选
                  </Button>
                </Space>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="soft-panel" loading={membersQuery.isLoading}>
          {batchActionBar}
          {isMobile ? (
            <List
              dataSource={currentMembers}
              locale={{ emptyText: '暂无匹配成员' }}
              className="mobile-list"
              loading={membersQuery.isFetching}
              renderItem={(record) => (
                <List.Item style={{ padding: 0, border: 'none' }}>
                  <Card className="mobile-list-card">
                    <div className="mobile-list-meta">
                      <div className="mobile-list-card-head">
                        <Space align="start">
                          <Checkbox
                            checked={selectedKeySet.has(record.id)}
                            aria-label={`选择 ${record.name}`}
                            onChange={(event) => toggleMemberSelection(record.id, event.target.checked)}
                          />
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
                        </Space>
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
                      <div className="mobile-list-row">
                        <span className="mobile-list-label">资料</span>
                        <span className="mobile-list-value">
                          {record.assetCount ? `${record.assetCount} 项` : '-'}
                        </span>
                      </div>

                      <Space wrap className="mobile-list-actions">
                        <Button size="small">
                          <Link href={`/members/${record.id}`}>查看详情</Link>
                        </Button>
                        <>
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            loading={prefillLoading}
                            onClick={() => void openEditModal(record)}
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
                      </Space>
                    </div>
                  </Card>
                </List.Item>
              )}
            />
          ) : (
            <Table
              rowKey="id"
              dataSource={currentMembers}
              pagination={false}
              columns={visibleDesktopColumns}
              loading={membersQuery.isFetching}
              onChange={handleTableChange}
              rowSelection={{
                selectedRowKeys,
                onChange: setSelectedRowKeys,
              }}
              scroll={{ x: 960 }}
            />
          )}
          {paginationNode}
        </Card>

        <MemberFormModal
          open={modalOpen}
          title={
            editingMember
              ? `${isAdmin ? '编辑成员' : '提交成员编辑'}：${editingMember.name}`
              : isAdmin
                ? '新建成员'
                : '提交新建成员'
          }
          initialValue={editingMember}
          loading={saveMutation.isPending || prefillLoading}
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
