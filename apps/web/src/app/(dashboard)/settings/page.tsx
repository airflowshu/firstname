'use client';

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tabs,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { api, ApiError } from '@/lib/api';
import type { AssetSourceRecord, AssetTagRecord, KinshipAlias } from '@/lib/types';

const { Title, Text } = Typography;

export default function SettingsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingAlias, setEditingAlias] = useState<KinshipAlias | undefined>();
  const [tagOpen, setTagOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<AssetTagRecord | undefined>();
  const [sourceOpen, setSourceOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<AssetSourceRecord | undefined>();
  const [activeSettingsTab, setActiveSettingsTab] = useState('kinship-alias');
  const [form] = Form.useForm();
  const [tagForm] = Form.useForm();
  const [sourceForm] = Form.useForm();

  const aliasesQuery = useQuery({
    queryKey: ['kinship-aliases'],
    queryFn: api.getKinshipAliases,
  });
  const assetTagsQuery = useQuery({
    queryKey: ['asset-tags', 'all'],
    queryFn: () => api.getAssetTags({ includeDisabled: true }),
  });
  const assetSourcesQuery = useQuery({
    queryKey: ['asset-sources', 'all'],
    queryFn: () => api.getAssetSources({ includeDisabled: true }),
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
  const saveTagMutation = useMutation({
    mutationFn: async (payload: { name: string; enabled: boolean; sortOrder: number }) => {
      if (editingTag) {
        return api.updateAssetTag(editingTag.id, payload);
      }

      return api.createAssetTag(payload);
    },
    onSuccess: async () => {
      message.success(editingTag ? '推荐标签已更新' : '推荐标签已创建');
      setTagOpen(false);
      setEditingTag(undefined);
      tagForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['asset-tags'] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '保存推荐标签失败');
    },
  });
  const deleteTagMutation = useMutation({
    mutationFn: (id: string) => api.deleteAssetTag(id),
    onSuccess: async () => {
      message.success('推荐标签已删除');
      await queryClient.invalidateQueries({ queryKey: ['asset-tags'] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '删除推荐标签失败');
    },
  });
  const saveSourceMutation = useMutation({
    mutationFn: async (payload: { name: string; enabled: boolean; sortOrder: number }) => {
      if (editingSource) {
        return api.updateAssetSource(editingSource.id, payload);
      }

      return api.createAssetSource(payload);
    },
    onSuccess: async () => {
      message.success(editingSource ? '来源类型已更新' : '来源类型已创建');
      setSourceOpen(false);
      setEditingSource(undefined);
      sourceForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['asset-sources'] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '保存来源类型失败');
    },
  });
  const deleteSourceMutation = useMutation({
    mutationFn: (id: string) => api.deleteAssetSource(id),
    onSuccess: async () => {
      message.success('来源类型已删除');
      await queryClient.invalidateQueries({ queryKey: ['asset-sources'] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '删除来源类型失败');
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

  useEffect(() => {
    if (!tagOpen) {
      return;
    }

    tagForm.resetFields();
    tagForm.setFieldsValue({
      name: editingTag?.name,
      enabled: editingTag?.enabled ?? true,
      sortOrder: editingTag?.sortOrder ?? 0,
    });
  }, [editingTag, tagForm, tagOpen]);

  useEffect(() => {
    if (!sourceOpen) {
      return;
    }

    sourceForm.resetFields();
    sourceForm.setFieldsValue({
      name: editingSource?.name,
      enabled: editingSource?.enabled ?? true,
      sortOrder: editingSource?.sortOrder ?? 0,
    });
  }, [editingSource, sourceForm, sourceOpen]);

  return (
    <AuthGuard requireAdmin>
      <div className="page-stack">
        <Card className="soft-panel">
          <Space direction="vertical" size={4}>
            <Title level={3} style={{ margin: 0 }}>
              系统设置
            </Title>
            <Text type="secondary">
              当前版本支持维护家族称呼别名、推荐标签词库和来源类型字典，帮助家族资料逐步形成统一可复用的治理规则。
            </Text>
          </Space>
        </Card>

        <Card className="soft-panel">
          <Tabs
            activeKey={activeSettingsTab}
            onChange={setActiveSettingsTab}
            items={[
              {
                key: 'kinship-alias',
                label: '家族称呼别名映射',
                children: (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
                    </div>
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
                  </Space>
                ),
              },
              {
                key: 'asset-tags',
                label: '资料推荐标签词库',
                children: (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          setEditingTag(undefined);
                          tagForm.resetFields();
                          setTagOpen(true);
                        }}
                      >
                        新建推荐标签
                      </Button>
                    </div>
                    <Table
                      rowKey="id"
                      loading={assetTagsQuery.isLoading}
                      dataSource={assetTagsQuery.data ?? []}
                      columns={[
                        {
                          title: '标签名称',
                          dataIndex: 'name',
                          render: (value: string) => <Tag color="processing">{value}</Tag>,
                        },
                        {
                          title: '使用次数',
                          dataIndex: 'useCount',
                        },
                        {
                          title: '排序',
                          dataIndex: 'sortOrder',
                        },
                        {
                          title: '状态',
                          dataIndex: 'enabled',
                          render: (value: boolean) => (value ? '启用' : '停用'),
                        },
                        {
                          title: '操作',
                          render: (_: unknown, record: AssetTagRecord) => (
                            <Space wrap>
                              <Button
                                size="small"
                                onClick={() => {
                                  setEditingTag(record);
                                  setTagOpen(true);
                                }}
                              >
                                编辑
                              </Button>
                              <Popconfirm
                                title="确定删除这个推荐标签吗？"
                                description="如果该标签仍被资料使用，系统会阻止删除。"
                                onConfirm={() => deleteTagMutation.mutate(record.id)}
                              >
                                <Button
                                  size="small"
                                  danger
                                  icon={<DeleteOutlined />}
                                  loading={deleteTagMutation.isPending}
                                >
                                  删除
                                </Button>
                              </Popconfirm>
                            </Space>
                          ),
                        },
                      ]}
                    />
                  </Space>
                ),
              },
              {
                key: 'asset-sources',
                label: '资料来源类型字典',
                children: (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          setEditingSource(undefined);
                          sourceForm.resetFields();
                          setSourceOpen(true);
                        }}
                      >
                        新建来源类型
                      </Button>
                    </div>
                    <Table
                      rowKey="id"
                      loading={assetSourcesQuery.isLoading}
                      dataSource={assetSourcesQuery.data ?? []}
                      columns={[
                        {
                          title: '来源类型',
                          dataIndex: 'name',
                          render: (value: string) => <Tag color="gold">{value}</Tag>,
                        },
                        {
                          title: '使用次数',
                          dataIndex: 'useCount',
                        },
                        {
                          title: '排序',
                          dataIndex: 'sortOrder',
                        },
                        {
                          title: '状态',
                          dataIndex: 'enabled',
                          render: (value: boolean) => (value ? '启用' : '停用'),
                        },
                        {
                          title: '操作',
                          render: (_: unknown, record: AssetSourceRecord) => (
                            <Space wrap>
                              <Button
                                size="small"
                                onClick={() => {
                                  setEditingSource(record);
                                  setSourceOpen(true);
                                }}
                              >
                                编辑
                              </Button>
                              <Popconfirm
                                title="确定删除这个来源类型吗？"
                                description="如果该来源仍被资料使用，系统会阻止删除。"
                                onConfirm={() => deleteSourceMutation.mutate(record.id)}
                              >
                                <Button
                                  size="small"
                                  danger
                                  icon={<DeleteOutlined />}
                                  loading={deleteSourceMutation.isPending}
                                >
                                  删除
                                </Button>
                              </Popconfirm>
                            </Space>
                          ),
                        },
                      ]}
                    />
                  </Space>
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

        <Modal
          open={tagOpen}
          title={editingTag ? `编辑推荐标签：${editingTag.name}` : '新建推荐标签'}
          confirmLoading={saveTagMutation.isPending}
          onCancel={() => {
            setTagOpen(false);
            setEditingTag(undefined);
          }}
          onOk={() => tagForm.submit()}
          destroyOnHidden
        >
          <Form
            form={tagForm}
            layout="vertical"
            onFinish={(values) =>
              saveTagMutation.mutate({
                name: values.name,
                enabled: values.enabled,
                sortOrder: values.sortOrder,
              })
            }
          >
            <Form.Item
              label="标签名称"
              name="name"
              rules={[{ required: true, message: '请输入标签名称' }]}
              extra="建议使用简短、可复用、能长期沉淀的分类词，例如：合影、祖宅、毕业、墓碑。"
            >
              <Input placeholder="如：合影、证书、婚礼、祖宅" maxLength={20} />
            </Form.Item>
            <Form.Item label="排序值" name="sortOrder" extra="数值越小越靠前。">
              <InputNumber min={0} style={{ width: '100%' }} />
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

        <Modal
          open={sourceOpen}
          title={editingSource ? `编辑来源类型：${editingSource.name}` : '新建来源类型'}
          confirmLoading={saveSourceMutation.isPending}
          onCancel={() => {
            setSourceOpen(false);
            setEditingSource(undefined);
          }}
          onOk={() => sourceForm.submit()}
          destroyOnHidden
        >
          <Form
            form={sourceForm}
            layout="vertical"
            onFinish={(values) =>
              saveSourceMutation.mutate({
                name: values.name,
                enabled: values.enabled,
                sortOrder: values.sortOrder,
              })
            }
          >
            <Form.Item
              label="来源类型名称"
              name="name"
              rules={[{ required: true, message: '请输入来源类型名称' }]}
              extra="建议使用标准来源类别，例如：族人提供、老相册翻拍、证件扫描、地方志摘录。"
            >
              <Input placeholder="如：族人提供、墓碑抄录、口述整理" maxLength={30} />
            </Form.Item>
            <Form.Item label="排序值" name="sortOrder" extra="数值越小越靠前。">
              <InputNumber min={0} style={{ width: '100%' }} />
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
