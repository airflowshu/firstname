'use client';

import { DownloadOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { MemberFormModal } from '@/components/member-form-modal';
import { useAuth } from '@/components/auth-provider';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { MemberListItem } from '@/lib/types';

const { Title, Text } = Typography;

export default function MembersPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [keyword, setKeyword] = useState('');
  const [gender, setGender] = useState<string>();
  const [lifeStatus, setLifeStatus] = useState<string>();
  const [editingMember, setEditingMember] = useState<MemberListItem | undefined>();
  const [modalOpen, setModalOpen] = useState(false);

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

  return (
    <AuthGuard>
      <div className="page-stack">
        <Card className="soft-panel">
          <Space direction="vertical" size={4}>
            <Title level={3} style={{ margin: 0 }}>
              成员管理
            </Title>
            <Text type="secondary">
              维护成员基础档案、父母关系，并从详情页继续维护婚姻与头像信息。
            </Text>
          </Space>
        </Card>

        <Card className="soft-panel">
          <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space wrap>
              <Input.Search
                allowClear
                placeholder="搜索姓名 / 籍贯 / 字辈"
                style={{ width: 260 }}
                onSearch={setKeyword}
              />
              <Select
                allowClear
                placeholder="性别"
                style={{ width: 120 }}
                options={[
                  { label: '男', value: 'MALE' },
                  { label: '女', value: 'FEMALE' },
                  { label: '未知', value: 'UNKNOWN' },
                ]}
                onChange={setGender}
              />
              <Select
                allowClear
                placeholder="生命状态"
                style={{ width: 140 }}
                options={[
                  { label: '在世', value: 'ALIVE' },
                  { label: '已故', value: 'DECEASED' },
                  { label: '未知', value: 'UNKNOWN' },
                ]}
                onChange={setLifeStatus}
              />
              <Button icon={<ReloadOutlined />} onClick={() => membersQuery.refetch()}>
                刷新
              </Button>
            </Space>
            <Space>
              {isAdmin ? (
                <>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={async () => {
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
                    }}
                  >
                    Excel 导出
                  </Button>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setEditingMember(undefined);
                      setModalOpen(true);
                    }}
                  >
                    新建成员
                  </Button>
                </>
              ) : null}
            </Space>
          </Space>
        </Card>

        <Card className="soft-panel" loading={membersQuery.isLoading}>
          <Table
            rowKey="id"
            dataSource={membersQuery.data?.data ?? []}
            scroll={{ x: 1080 }}
            columns={[
              {
                title: '姓名',
                dataIndex: 'name',
                render: (_value: string, record: MemberListItem) => (
                  <Space>
                    <Link href={`/members/${record.id}`}>{record.name}</Link>
                    {record.isDeleted ? <Tag color="error">已软删除</Tag> : null}
                  </Space>
                ),
              },
              {
                title: '性别',
                dataIndex: 'gender',
                render: (value: string) =>
                  value === 'MALE' ? '男' : value === 'FEMALE' ? '女' : '未知',
              },
              {
                title: '出生日期',
                dataIndex: 'birthDate',
                render: (value: string | null) => formatDate(value),
              },
              {
                title: '父亲',
                dataIndex: ['father', 'name'],
                render: (value?: string) => value ?? '-',
              },
              {
                title: '母亲',
                dataIndex: ['mother', 'name'],
                render: (value?: string) => value ?? '-',
              },
              {
                title: '字辈',
                dataIndex: 'generationName',
                render: (value?: string | null) => value ?? '-',
              },
              {
                title: '排行',
                dataIndex: 'birthOrder',
                render: (value?: number | null) => value ?? '-',
              },
              {
                title: '籍贯',
                dataIndex: 'nativePlace',
                render: (value?: string | null) => value ?? '-',
              },
              {
                title: '状态',
                dataIndex: 'lifeStatus',
                render: (value: string) =>
                  value === 'ALIVE' ? (
                    <Tag color="green">在世</Tag>
                  ) : value === 'DECEASED' ? (
                    <Tag color="default">已故</Tag>
                  ) : (
                    <Tag>未知</Tag>
                  ),
              },
              actionColumn,
            ]}
          />
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
      </div>
    </AuthGuard>
  );
}
