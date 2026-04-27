'use client';

import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Form, Input, Modal, Select, Space, Table, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { api, ApiError } from '@/lib/api';
import type { KinshipAlias } from '@/lib/types';

const { Title, Text } = Typography;

export default function SettingsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingAlias, setEditingAlias] = useState<KinshipAlias | undefined>();
  const [form] = Form.useForm();

  const aliasesQuery = useQuery({
    queryKey: ['kinship-aliases'],
    queryFn: api.getKinshipAliases,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (editingAlias) {
        return api.updateKinshipAlias(editingAlias.id, payload);
      }

      return api.createKinshipAlias(payload);
    },
    onSuccess: async () => {
      message.success(editingAlias ? '别名映射已更新' : '别名映射已创建');
      setOpen(false);
      setEditingAlias(undefined);
      form.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['kinship-aliases'] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '保存称呼别名失败');
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.resetFields();
    form.setFieldsValue({
      relationCode: editingAlias?.relationCode,
      standardTerm: editingAlias?.standardTerm,
      familyAlias: editingAlias?.familyAlias,
      enabled: editingAlias?.enabled ?? true,
    });
  }, [editingAlias, form, open]);

  return (
    <AuthGuard requireAdmin>
      <div className="page-stack">
        <Card className="soft-panel">
          <Space direction="vertical" size={4}>
            <Title level={3} style={{ margin: 0 }}>
              系统设置
            </Title>
            <Text type="secondary">
              第一版主要用于维护“标准称呼 → 家族叫法”的别名映射，支持方言或家族内部习惯称呼。
            </Text>
          </Space>
        </Card>

        <Card
          className="soft-panel"
          title="家族称呼别名映射"
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingAlias(undefined);
                form.resetFields();
                setOpen(true);
              }}
            >
              新建映射
            </Button>
          }
        >
          <Table
            rowKey="id"
            loading={aliasesQuery.isLoading}
            dataSource={aliasesQuery.data ?? []}
            columns={[
              { title: '关系编码', dataIndex: 'relationCode' },
              { title: '标准称呼', dataIndex: 'standardTerm' },
              { title: '家族叫法', dataIndex: 'familyAlias' },
              {
                title: '启用状态',
                dataIndex: 'enabled',
                render: (value: boolean) => (value ? '启用' : '停用'),
              },
              {
                title: '操作',
                render: (_: unknown, record: KinshipAlias) => (
                  <Button
                    size="small"
                    onClick={() => {
                      setEditingAlias(record);
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
          title={editingAlias ? `编辑别名映射：${editingAlias.relationCode}` : '新建家族称呼映射'}
          confirmLoading={saveMutation.isPending}
          onCancel={() => {
            setOpen(false);
            setEditingAlias(undefined);
          }}
          onOk={() => form.submit()}
          destroyOnHidden
        >
          <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
            <Form.Item
              label="关系编码"
              name="relationCode"
              rules={[{ required: true, message: '请输入关系编码' }]}
            >
              <Input placeholder="如：F、F>F、M>OB" />
            </Form.Item>
            <Form.Item
              label="标准称呼"
              name="standardTerm"
              rules={[{ required: true, message: '请输入标准称呼' }]}
            >
              <Input placeholder="如：父亲、祖父、舅舅" />
            </Form.Item>
            <Form.Item
              label="家族叫法"
              name="familyAlias"
              rules={[{ required: true, message: '请输入家族叫法' }]}
            >
              <Input placeholder="如：阿爸、阿公、大舅" />
            </Form.Item>
            <Form.Item
              label="是否启用"
              name="enabled"
              rules={[{ required: true, message: '请选择状态' }]}
            >
              <Select
                options={[
                  { label: '启用', value: true },
                  { label: '停用', value: false },
                ]}
              />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AuthGuard>
  );
}
