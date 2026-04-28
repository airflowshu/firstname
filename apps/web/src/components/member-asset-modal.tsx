'use client';

import { FileTextOutlined, PictureOutlined, UploadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Form, Input, Modal, Select, Space, Typography, Upload } from 'antd';
import { useEffect, useState } from 'react';
import type { UploadFile } from 'antd/es/upload/interface';
import { api } from '@/lib/api';
import type { MemberAssetRecord } from '@/lib/types';

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

export function MemberAssetModal({
  open,
  mode,
  category,
  memberName,
  initialValue,
  loading,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  mode: 'upload' | 'edit';
  category: 'PHOTO' | 'DOCUMENT';
  memberName?: string;
  initialValue?: MemberAssetRecord | null;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (payload: {
    files?: File[];
    sourceType?: string;
    title?: string;
    source?: string;
    tags: string[];
    description?: string;
  }) => Promise<void> | void;
}) {
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const isPhoto = category === 'PHOTO';
  const isUpload = mode === 'upload';
  const tagSuggestionsQuery = useQuery({
    queryKey: ['asset-tags', 'enabled'],
    queryFn: () => api.getAssetTags(),
  });
  const sourceSuggestionsQuery = useQuery({
    queryKey: ['asset-sources', 'enabled'],
    queryFn: () => api.getAssetSources(),
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.resetFields();
    setFileList([]);
    form.setFieldsValue({
      sourceType: initialValue?.sourceType ?? undefined,
      title: initialValue?.title ?? undefined,
      source: initialValue?.source ?? undefined,
      tags: initialValue?.tags ?? [],
      description: initialValue?.description ?? undefined,
    });
  }, [form, initialValue, open]);

  return (
    <Modal
      open={open}
      title={
        memberName
          ? `${isUpload ? '上传' : '编辑'}${isPhoto ? '照片' : '附件'}：${memberName}`
          : isUpload
            ? '上传成员资料'
            : '编辑成员资料'
      }
      onCancel={() => {
        form.resetFields();
        setFileList([]);
        onCancel();
      }}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText={isUpload ? '保存上传' : '保存资料信息'}
      cancelText="取消"
      okButtonProps={{ disabled: isUpload && fileList.length === 0 }}
      destroyOnHidden
      width={720}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={async (values) => {
          const files = fileList
            .map((item) => item.originFileObj)
            .filter(Boolean) as File[];

          if (isUpload && files.length === 0) {
            return;
          }

          await onSubmit({
            files: isUpload ? files : undefined,
            sourceType: values.sourceType || undefined,
            title: values.title?.trim() || undefined,
            source: values.source?.trim() || undefined,
            tags: normalizeTags(values.tags),
            description: values.description?.trim() || undefined,
          });
          form.resetFields();
          setFileList([]);
        }}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            icon={isPhoto ? <PictureOutlined /> : <FileTextOutlined />}
            message={isUpload ? '资料上传说明' : '资料信息维护'}
            description={
              isUpload
                ? `本次${isPhoto ? '照片' : '附件'}可补充资料标题、来源说明、标签和资源描述；若批量上传，这些信息会统一应用到本次文件。`
                : '可为当前资料补充更清晰的标题、来源、标签和说明，方便后续检索、沉淀与复用。'
            }
          />

          {isUpload ? (
            <Form.Item
              label={`选择${isPhoto ? '照片' : '附件'}文件`}
              required
              extra={isPhoto ? '支持多张图片一次上传。' : '支持 PDF / Office / TXT / ZIP 等资料文件。'}
            >
              <Upload
                multiple
                beforeUpload={() => false}
                fileList={fileList}
                onChange={({ fileList: nextFileList }) => setFileList(nextFileList)}
                accept={isPhoto ? 'image/*' : '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip'}
              >
                <Button icon={<UploadOutlined />}>选择文件</Button>
              </Upload>
            </Form.Item>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item name="sourceType" label="来源类型">
              <Select
                allowClear
                showSearch
                options={(sourceSuggestionsQuery.data ?? []).map((item) => ({
                  label: item.name,
                  value: item.name,
                }))}
                placeholder="优先选择推荐来源类型"
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item name="title" label="资料标题">
              <Input placeholder={isPhoto ? '如：1998 年春节全家福' : '如：毕业证扫描件'} />
            </Form.Item>
            <Form.Item name="source" label="来源补充说明" className="md:col-span-2">
              <Input placeholder="如：由三叔提供，2024 年翻拍自老相册；或来源于某本地方志第 32 页。" />
            </Form.Item>
          </div>

          <Form.Item name="tags" label="标签">
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

          <Form.Item name="description" label="资源描述">
            <Input.TextArea
              rows={4}
              placeholder={
                isPhoto
                  ? '记录拍摄时间、场景、人物信息或族谱背景。'
                  : '记录附件用途、内容摘要、对应事件或可参考的背景信息。'
              }
            />
          </Form.Item>

          {!isUpload && initialValue ? (
            <div className="member-asset-inline-note">
              <Text strong>{initialValue.originalName}</Text>
              <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                原始文件名保留不变，当前仅维护该资料的展示信息与检索标签。
              </Paragraph>
            </div>
          ) : null}
        </Space>
      </Form>
    </Modal>
  );
}
