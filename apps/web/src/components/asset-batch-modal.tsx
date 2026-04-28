'use client';

import { useQuery } from '@tanstack/react-query';
import { Alert, Form, Modal, Select, Space, Typography } from 'antd';
import { api } from '@/lib/api';
import type { AssetBatchAction } from '@/lib/types';

const { Paragraph, Text } = Typography;

function normalizeTags(tags?: string[]) {
  return Array.from(
    new Set(
      (tags ?? [])
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ).slice(0, 12);
}

export function AssetBatchModal({
  open,
  action,
  selectedCount,
  loading,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  action: Extract<AssetBatchAction, 'APPEND_TAGS' | 'SET_SOURCE_TYPE'>;
  selectedCount: number;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (payload: { tags?: string[]; sourceType?: string }) => Promise<void> | void;
}) {
  const [form] = Form.useForm();
  const isTagsAction = action === 'APPEND_TAGS';
  const tagSuggestionsQuery = useQuery({
    queryKey: ['asset-tags', 'enabled'],
    queryFn: () => api.getAssetTags(),
  });
  const sourceSuggestionsQuery = useQuery({
    queryKey: ['asset-sources', 'enabled'],
    queryFn: () => api.getAssetSources(),
  });

  return (
    <Modal
      open={open}
      title={isTagsAction ? '批量追加标签' : '批量设置来源类型'}
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText={isTagsAction ? '批量追加' : '批量设置'}
      cancelText="取消"
      destroyOnHidden
      width={640}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={async (values) => {
          await onSubmit({
            tags: isTagsAction ? normalizeTags(values.tags) : undefined,
            sourceType: !isTagsAction ? values.sourceType : undefined,
          });
          form.resetFields();
        }}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message={isTagsAction ? '批量标签整理' : '批量来源整理'}
            description={
              isTagsAction
                ? `当前将为已选 ${selectedCount} 项资料统一追加标签，不会覆盖原有标签。`
                : `当前将为已选 ${selectedCount} 项资料统一设置来源类型，原有来源类型会被替换。`
            }
          />

          {isTagsAction ? (
            <Form.Item
              label="追加标签"
              name="tags"
              rules={[{ required: true, message: '请至少选择或输入一个标签' }]}
            >
              <Select
                mode="tags"
                tokenSeparators={[',', '，']}
                options={(tagSuggestionsQuery.data ?? []).map((item) => ({
                  label: item.name,
                  value: item.name,
                }))}
                placeholder="优先选择推荐标签，也可继续输入自定义标签"
                maxTagCount="responsive"
              />
            </Form.Item>
          ) : (
            <Form.Item
              label="来源类型"
              name="sourceType"
              rules={[{ required: true, message: '请选择来源类型' }]}
            >
              <Select
                showSearch
                options={(sourceSuggestionsQuery.data ?? []).map((item) => ({
                  label: item.name,
                  value: item.name,
                }))}
                placeholder="请选择要批量设置的来源类型"
                optionFilterProp="label"
              />
            </Form.Item>
          )}

          <div className="member-asset-inline-note">
            <Text strong>操作提示</Text>
            <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
              {isTagsAction
                ? '批量标签适合整理同一批照片、证书或扫描件。系统会自动去重，避免重复标签。'
                : '批量来源适合给同一批资料统一标注出处，例如“族人提供”“老相册翻拍”。'}
            </Paragraph>
          </div>
        </Space>
      </Form>
    </Modal>
  );
}
