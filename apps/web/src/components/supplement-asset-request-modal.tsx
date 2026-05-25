'use client';

import { FileImageOutlined, FileTextOutlined, UploadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Form, Input, Modal, Select, Space, Typography, Upload } from 'antd';
import { useEffect, useState } from 'react';
import type { UploadFile } from 'antd/es/upload/interface';
import { api } from '@/lib/api';

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

export function SupplementAssetRequestModal({
  open,
  category,
  memberName,
  loading,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  category: 'PHOTO' | 'DOCUMENT';
  memberName?: string;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (payload: {
    reason?: string;
    sourceType?: string;
    title?: string;
    source?: string;
    tags: string[];
    description?: string;
    files: File[];
  }) => Promise<void> | void;
}) {
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const isPhoto = category === 'PHOTO';
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
  }, [form, open]);

  return (
    <Modal
      open={open}
      title={memberName ? `提交${isPhoto ? '照片' : '附件'}补充：${memberName}` : '提交资源补充'}
      onCancel={() => {
        form.resetFields();
        setFileList([]);
        onCancel();
      }}
      onOk={() => form.submit()}
      okText="提交申请"
      cancelText="取消"
      confirmLoading={loading}
      okButtonProps={{ disabled: fileList.length === 0 }}
      forceRender
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
          if (files.length === 0) {
            return;
          }

          await onSubmit({
            reason: values.reason?.trim() || undefined,
            sourceType: values.sourceType || undefined,
            title: values.title?.trim() || undefined,
            source: values.source?.trim() || undefined,
            tags: normalizeTags(values.tags),
            description: values.description?.trim() || undefined,
            files,
          });
          form.resetFields();
          setFileList([]);
        }}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            icon={isPhoto ? <FileImageOutlined /> : <FileTextOutlined />}
            message={isPhoto ? '照片补充申请' : '附件补充申请'}
            description={
              isPhoto
                ? '普通查看用户可以提交老照片、生活照等补充材料，管理员审核通过后会出现在成员相册中。'
                : '普通查看用户可以提交扫描件、证书、文档等附件材料，管理员审核通过后会出现在成员附件区。'
            }
          />

          <Form.Item
            label={`选择${isPhoto ? '照片' : '附件'}文件`}
            required
            extra="支持一次选择多个文件，下面填写的资料信息会统一附着到本次申请中。"
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
              <Input placeholder={isPhoto ? '如：老宅门前全家福' : '如：族谱复印件'} />
            </Form.Item>
            <Form.Item name="source" label="来源补充说明" className="md:col-span-2">
              <Input placeholder="如：由王某某提供，拍摄于 2025 年 3 月；或依据某证件原件扫描。" />
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
                  ? '可说明拍摄时间、地点、照片中人物与背景故事。'
                  : '可说明附件内容摘要、资料用途或对应事件。'
              }
            />
          </Form.Item>

          <Form.Item name="reason" label="提交说明">
            <Input.TextArea
              rows={3}
              placeholder="可补充说明为什么现在提交、希望管理员重点核对什么。"
            />
          </Form.Item>

          <div className="member-asset-inline-note">
            <Text strong>填写建议</Text>
            <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
              来源、标签和描述越清晰，管理员越容易审核，也更方便后续在家族资料中检索沉淀。
            </Paragraph>
          </div>
        </Space>
      </Form>
    </Modal>
  );
}
