'use client';

import { LinkOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { UserRecord } from '@/lib/types';

const { Title, Text } = Typography;

export default function UsersPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | undefined>();
  const [form] = Form.useForm();

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: api.getUsers,
  });
  const visibleUsers = useMemo(
    () => (usersQuery.data ?? []).filter((user) => user.platformRole !== 'SUPER'),
    [usersQuery.data],
  );

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (editingUser) {
        return api.updateUser(editingUser.id, payload);
      }

      return api.createUser(payload);
    },
    onSuccess: async () => {
      message.success(editingUser ? '用户信息已更新' : '账号已创建');
      setOpen(false);
      setEditingUser(undefined);
      form.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '保存用户失败');
    },
  });

  const inviteMutation = useMutation({
    mutationFn: () => api.createFamilyMemberInvitation(),
    onSuccess: async (result) => {
      try {
        await navigator.clipboard.writeText(result.inviteUrl);
        message.success('邀请链接已复制，可直接转发给家族成员');
      } catch {
        message.success(`邀请链接已生成：${result.inviteUrl}`);
      }
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '创建邀请失败');
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.resetFields();
    form.setFieldsValue({
      username: editingUser?.username,
      role: editingUser?.role,
      status: editingUser?.status,
    });
  }, [editingUser, form, open]);

  return (
    <AuthGuard requireAdmin>
      <div className="page-stack">
        <Card className="soft-panel">
          <Space direction="vertical" size={4}>
            <Title level={3} style={{ margin: 0 }}>
              用户与权限
            </Title>
            <Text type="secondary">管理员可创建后台账号，并将其设置为管理员或普通查看角色。</Text>
          </Space>
        </Card>

        <Card
          className="soft-panel"
          extra={
            <Space wrap>
              <Button
                icon={<LinkOutlined />}
                loading={inviteMutation.isPending}
                onClick={() => inviteMutation.mutate()}
              >
                复制邀请链接
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingUser(undefined);
                  form.resetFields();
                  setOpen(true);
                }}
              >
                新建账号
              </Button>
            </Space>
          }
        >
          <Table
            rowKey="id"
            loading={usersQuery.isLoading}
            dataSource={visibleUsers}
            columns={[
              { title: '用户名', dataIndex: 'username' },
              {
                title: '角色',
                dataIndex: 'role',
                render: (value: string) => (value === 'ADMIN' ? '管理员' : '查看用户'),
              },
              {
                title: '状态',
                dataIndex: 'status',
                render: (value: string) => {
                  const label = value === 'ACTIVE' ? '启用' : value === 'DISABLED' ? '禁用' : value;
                  const color = value === 'ACTIVE' ? 'success' : value === 'DISABLED' ? 'error' : 'default';

                  return <Tag color={color}>{label}</Tag>;
                },
              },
              {
                title: '最近登录',
                dataIndex: 'lastLoginAt',
                render: (value: string | null) => formatDate(value, 'YYYY-MM-DD HH:mm'),
              },
              {
                title: '创建时间',
                dataIndex: 'createdAt',
                render: (value: string) => formatDate(value, 'YYYY-MM-DD HH:mm'),
              },
              {
                title: '操作',
                render: (_: unknown, record: UserRecord) =>
                  record.platformRole === 'SUPER' ? (
                    <Text type="secondary">不可操作</Text>
                  ) : (
                    <Button
                      size="small"
                      onClick={() => {
                        setEditingUser(record);
                        setOpen(true);
                      }}
                    >
                      编辑
                    </Button>
                  ),
              },
            ]}
          />
        </Card>

        <Modal
          open={open}
          title={editingUser ? `编辑用户：${editingUser.username}` : '新建后台账号'}
          confirmLoading={saveMutation.isPending}
          onCancel={() => {
            setOpen(false);
            setEditingUser(undefined);
          }}
          onOk={() => form.submit()}
          destroyOnHidden
        >
          <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
            <Form.Item
              label="用户名"
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input disabled={Boolean(editingUser)} />
            </Form.Item>
            <Form.Item
              label={editingUser ? '重置密码（留空则不修改）' : '密码'}
              name="password"
              rules={editingUser ? [] : [{ required: true, message: '请输入密码' }]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item label="角色" name="role" rules={[{ required: true, message: '请选择角色' }]}>
              <Select
                options={[
                  { label: '管理员', value: 'ADMIN' },
                  { label: '普通查看用户', value: 'VIEWER' },
                ]}
              />
            </Form.Item>
            <Form.Item
              label="状态"
              name="status"
              rules={[{ required: true, message: '请选择状态' }]}
            >
              <Select
                options={[
                  { label: '启用', value: 'ACTIVE' },
                  { label: '禁用', value: 'DISABLED' },
                ]}
              />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AuthGuard>
  );
}
