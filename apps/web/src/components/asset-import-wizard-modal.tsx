'use client';

import {
  FileTextOutlined,
  InboxOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Steps,
  Table,
  Typography,
  Upload,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import type { UploadFile } from 'antd/es/upload/interface';
import { api } from '@/lib/api';
import { RemoteMemberSelect } from './remote-member-select';

const { Paragraph, Text } = Typography;

type ImportTitleMode = 'ORIGINAL_NAME' | 'PREFIX_INDEX' | 'PREFIX_FILENAME';

export interface AssetImportWizardDraft {
  memberId: string;
  category: 'PHOTO' | 'DOCUMENT';
  files: File[];
  sourceType?: string;
  source?: string;
  tags: string[];
  description?: string;
  titleMode: ImportTitleMode;
  titlePrefix?: string;
}

function normalizeTags(tags?: string[]) {
  return Array.from(
    new Set(
      (tags ?? [])
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ).slice(0, 12);
}

function stripExtension(filename: string) {
  return filename.replace(/\.[^.]+$/, '').trim() || filename.trim();
}

function isLikelyImageFile(file: UploadFile) {
  const mimeType = file.type ?? '';
  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
  return (
    mimeType.startsWith('image/') ||
    ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.heic', '.heif'].includes(
      extension,
    )
  );
}

function buildResolvedTitle(
  mode: ImportTitleMode,
  fileName: string,
  index: number,
  prefix?: string,
) {
  const baseName = stripExtension(fileName);
  if (mode === 'ORIGINAL_NAME') {
    return baseName;
  }

  const safePrefix = prefix?.trim() || '';
  if (!safePrefix) {
    return baseName;
  }

  if (mode === 'PREFIX_FILENAME') {
    return `${safePrefix} · ${baseName}`;
  }

  return `${safePrefix} ${String(index + 1).padStart(2, '0')}`;
}

export function AssetImportWizardModal({
  open,
  loading,
  initialDraft,
  initialStep = 0,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  loading?: boolean;
  initialDraft?: AssetImportWizardDraft | null;
  initialStep?: number;
  onCancel: () => void;
  onSubmit: (payload: {
    memberId: string;
    category: 'PHOTO' | 'DOCUMENT';
    files: File[];
    sourceType?: string;
    source?: string;
    tags: string[];
    description?: string;
    titleMode: ImportTitleMode;
    titlePrefix?: string;
    resolvedTitles: string[];
  }) => Promise<void> | void;
}) {
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [precheckError, setPrecheckError] = useState<string | null>(null);
  const tagSuggestionsQuery = useQuery({
    queryKey: ['asset-tags', 'enabled'],
    queryFn: () => api.getAssetTags(),
  });
  const sourceSuggestionsQuery = useQuery({
    queryKey: ['asset-sources', 'enabled'],
    queryFn: () => api.getAssetSources(),
  });
  const watchOptions = useMemo(() => ({ form, preserve: true }), [form]);
  const category = Form.useWatch('category', watchOptions) as 'PHOTO' | 'DOCUMENT' | undefined;
  const memberId = Form.useWatch('memberId', watchOptions) as string | undefined;
  const sourceType = Form.useWatch('sourceType', watchOptions) as string | undefined;
  const source = Form.useWatch('source', watchOptions) as string | undefined;
  const tags = Form.useWatch('tags', watchOptions) as string[] | undefined;
  const description = Form.useWatch('description', watchOptions) as string | undefined;
  const titleMode =
    (Form.useWatch('titleMode', watchOptions) as ImportTitleMode | undefined) ?? 'ORIGINAL_NAME';
  const titlePrefix = Form.useWatch('titlePrefix', watchOptions) as string | undefined;
  const precheckMutation = useQuery({
    queryKey: [
      'asset-import-precheck',
      currentStep,
      memberId,
      category,
      sourceType,
      source,
      JSON.stringify(tags ?? []),
      description,
      JSON.stringify(
        fileList.map((item, index) => ({
          name: item.name,
          size: item.size,
          type: item.type,
          title: buildResolvedTitle(titleMode, item.name, index, titlePrefix),
        })),
      ),
    ],
    enabled: false,
    queryFn: async () => {
      const files = fileList
        .map((item) => item.originFileObj)
        .filter(Boolean) as File[];

      return api.importAssetsPrecheck({
        memberId: memberId!,
        category: category!,
        files,
        sourceType: sourceType || undefined,
        source: source?.trim() || undefined,
        tags: normalizeTags(tags),
        description: description?.trim() || undefined,
        titles: files.map((file, index) =>
          buildResolvedTitle(titleMode, file.name, index, titlePrefix),
        ),
      });
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.resetFields();
    setCurrentStep(initialStep);

    if (initialDraft) {
      setFileList(
        initialDraft.files.map(
          (file, index) =>
            ({
              uid: `${file.name}-${file.lastModified}-${index}`,
              name: file.name,
              size: file.size,
              type: file.type,
              status: 'done',
              originFileObj: file as UploadFile['originFileObj'],
            }) as UploadFile,
        ),
      );
      form.setFieldsValue({
        memberId: initialDraft.memberId,
        category: initialDraft.category,
        sourceType: initialDraft.sourceType,
        source: initialDraft.source,
        tags: initialDraft.tags,
        description: initialDraft.description,
        titleMode: initialDraft.titleMode,
        titlePrefix: initialDraft.titlePrefix,
      });
      return;
    }

    setFileList([]);
    form.setFieldsValue({
      category: 'PHOTO',
      titleMode: 'ORIGINAL_NAME',
      tags: [],
    });
  }, [form, initialDraft, initialStep, open]);

  const previewRows = useMemo(() => {
    return fileList.map((item, index) => ({
      key: item.uid,
      inputIndex: index,
      originalName: item.name,
      sizeText: `${Math.max(1, Math.round((item.size ?? 0) / 1024))} KB`,
      title: buildResolvedTitle(titleMode, item.name, index, titlePrefix),
    }));
  }, [fileList, titleMode, titlePrefix]);

  useEffect(() => {
    if (currentStep !== 3 || !memberId || !category || fileList.length === 0) {
      return;
    }

    setPrecheckError(null);
    void precheckMutation
      .refetch()
      .catch((error) => {
        setPrecheckError(error instanceof Error ? error.message : '导入预检查失败');
      });
  }, [
    category,
    currentStep,
    description,
    fileList,
    memberId,
    precheckMutation,
    source,
    sourceType,
    tags,
    titleMode,
    titlePrefix,
  ]);

  const nextStep = async () => {
    if (currentStep === 0) {
      await form.validateFields(['memberId', 'category']);
    }

    if (currentStep === 1) {
      if (fileList.length === 0) {
        return;
      }
    }

    if (currentStep === 2) {
      await form.validateFields(['titleMode', 'titlePrefix']);
    }

    setCurrentStep((current) => Math.min(3, current + 1));
  };

  return (
    <Modal
      open={open}
      title="资料批量导入与整理向导"
      width={880}
      onCancel={() => {
        form.resetFields();
        setFileList([]);
        setCurrentStep(0);
        onCancel();
      }}
      footer={
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button
            onClick={() => {
              if (currentStep === 0) {
                form.resetFields();
                setFileList([]);
                setCurrentStep(0);
                onCancel();
                return;
              }

              setCurrentStep((current) => Math.max(0, current - 1));
            }}
          >
            {currentStep === 0 ? '取消' : '上一步'}
          </Button>
          <Space>
            <Button
              type="primary"
              loading={loading}
              disabled={
                (currentStep === 1 && fileList.length === 0) ||
                (currentStep === 3 && (precheckMutation.data?.errorCount ?? 0) > 0)
              }
              onClick={async () => {
                if (currentStep < 3) {
                  await nextStep();
                  return;
                }

                await form.validateFields(['memberId', 'category', 'titleMode', 'titlePrefix']);
                const values = form.getFieldsValue(true) as {
                  memberId?: string;
                  category?: 'PHOTO' | 'DOCUMENT';
                  sourceType?: string;
                  source?: string;
                  tags?: string[];
                  description?: string;
                  titleMode?: ImportTitleMode;
                  titlePrefix?: string;
                };
                const files = fileList
                  .map((item) => item.originFileObj)
                  .filter(Boolean) as File[];

                if (!values.memberId || !values.category || !values.titleMode || files.length === 0) {
                  return;
                }

                const memberIdValue = values.memberId;
                const categoryValue = values.category;
                const titleModeValue = values.titleMode;
                const titlePrefixValue = values.titlePrefix?.trim() || undefined;

                await onSubmit({
                  memberId: memberIdValue,
                  category: categoryValue,
                  files,
                  sourceType: values.sourceType || undefined,
                  source: values.source?.trim() || undefined,
                  tags: normalizeTags(values.tags),
                  description: values.description?.trim() || undefined,
                  titleMode: titleModeValue,
                  titlePrefix: titlePrefixValue,
                  resolvedTitles: files.map((file, index) =>
                    buildResolvedTitle(titleModeValue, file.name, index, titlePrefixValue),
                  ),
                });

                form.resetFields();
                setFileList([]);
                setCurrentStep(0);
              }}
            >
              {currentStep === 3 ? '开始导入' : '下一步'}
            </Button>
          </Space>
        </Space>
      }
      afterClose={() => {
        form.resetFields();
        setFileList([]);
        setCurrentStep(0);
      }}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Space direction="vertical" size={18} style={{ width: '100%' }}>
          <Steps
            current={currentStep}
            items={[
              { title: '归属成员' },
              { title: '选择文件' },
              { title: '整理规则' },
              { title: '预览确认' },
            ]}
          />

          {currentStep === 0 ? (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Alert
                type="info"
                showIcon
                message="先确定这批资料归属到哪位成员"
                description="当前版本的资料仍以成员为归属节点，因此批量导入向导默认一次导入到一位成员名下。"
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Form.Item
                  label="归属成员"
                  name="memberId"
                  rules={[{ required: true, message: '请选择归属成员' }]}
                >
                  <RemoteMemberSelect placeholder="搜索并选择归属成员" seedOptions={[]} />
                </Form.Item>

                <Form.Item
                  label="资料类型"
                  name="category"
                  rules={[{ required: true, message: '请选择资料类型' }]}
                >
                  <Select
                    options={[
                      { label: '照片资料', value: 'PHOTO' },
                      { label: '附件资料', value: 'DOCUMENT' },
                    ]}
                  />
                </Form.Item>
              </div>
            </Space>
          ) : null}

          {currentStep === 1 ? (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Alert
                type="info"
                showIcon
                icon={category === 'PHOTO' ? <PictureOutlined /> : <FileTextOutlined />}
                message={category === 'PHOTO' ? '选择照片资料' : '选择附件资料'}
                description="当前向导沿用现有上传能力，单次最多支持 12 个文件。若要继续导更多，可分批重复操作。"
              />

              <Upload.Dragger
                multiple
                beforeUpload={() => false}
                fileList={fileList}
                maxCount={12}
                onChange={({ fileList: nextFileList }) => {
                  const limitedFileList = nextFileList.slice(0, 12);
                  setFileList(limitedFileList);

                  if (category !== 'DOCUMENT' && limitedFileList.some((file) => !isLikelyImageFile(file))) {
                    form.setFieldsValue({ category: 'DOCUMENT' });
                  }
                }}
                accept={
                  category === 'PHOTO'
                    ? 'image/*'
                    : '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip'
                }
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽文件到这里批量导入</p>
                <p className="ant-upload-hint">
                  {category === 'PHOTO'
                    ? '支持批量选择图片，适合老照片、合影、族谱影印件。'
                    : '支持 PDF / Office / TXT / ZIP 等文档资料。'}
                </p>
              </Upload.Dragger>

              <Text type="secondary">当前已选 {fileList.length} 个文件。</Text>
            </Space>
          ) : null}

          {currentStep === 2 ? (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Alert
                type="info"
                showIcon
                message="为这一批资料统一设置整理规则"
                description="来源类型、来源补充说明、标签和描述会统一应用到本次导入的资料；标题会按你选择的规则逐条生成。"
              />

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

                <Form.Item name="tags" label="统一标签">
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

                <Form.Item name="source" label="来源补充说明" className="md:col-span-2">
                  <Input placeholder="如：2024 年由二叔提供，翻拍自家中旧相册。" />
                </Form.Item>
              </div>

              <Form.Item
                label="标题生成规则"
                name="titleMode"
                rules={[{ required: true, message: '请选择标题生成规则' }]}
              >
                <Select
                  options={[
                    { label: '直接使用原文件名（去扩展名）', value: 'ORIGINAL_NAME' },
                    { label: '使用前缀 + 顺序编号', value: 'PREFIX_INDEX' },
                    { label: '使用前缀 + 原文件名', value: 'PREFIX_FILENAME' },
                  ]}
                />
              </Form.Item>

              <Form.Item
                label="标题前缀"
                name="titlePrefix"
                rules={[
                  {
                    validator(_, value) {
                      if (titleMode === 'ORIGINAL_NAME') {
                        return Promise.resolve();
                      }

                      if (!String(value ?? '').trim()) {
                        return Promise.reject(new Error('当前标题规则需要填写标题前缀'));
                      }

                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <Input
                  placeholder="如：1998 年春节合影 / 王国华毕业资料"
                  disabled={titleMode === 'ORIGINAL_NAME'}
                />
              </Form.Item>

              <Form.Item name="description" label="统一资源描述">
                <Input.TextArea
                  rows={4}
                  placeholder="可记录这一批资料的共同背景、拍摄时间、整理说明或文档用途。"
                />
              </Form.Item>
            </Space>
          ) : null}

          {currentStep === 3 ? (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Alert
                type="success"
                showIcon
                message="最后确认导入预览与预检查"
                description="下面不仅会预览导入后的标题，还会自动检查可能的重复文件、标题撞车和可疑资料风险。"
              />

              {precheckError ? (
                <Alert type="error" showIcon message="导入预检查失败" description={precheckError} />
              ) : precheckMutation.data ? (
                <Alert
                  type={
                    precheckMutation.data.errorCount > 0
                      ? 'error'
                      : precheckMutation.data.warningCount > 0
                        ? 'warning'
                        : 'success'
                  }
                  showIcon
                  message={
                    precheckMutation.data.errorCount > 0
                      ? `预检查发现 ${precheckMutation.data.errorCount} 个文件存在错误，${precheckMutation.data.warningCount} 个文件存在风险提示`
                      : precheckMutation.data.warningCount > 0
                        ? `预检查发现 ${precheckMutation.data.warningCount} 个文件存在风险提示`
                      : '预检查未发现明显重复或可疑资料'
                  }
                  description={`批次内重复 ${precheckMutation.data.duplicateInBatchCount} 项，现有资料重复 ${precheckMutation.data.duplicateExistingCount} 项，标题撞车 ${precheckMutation.data.titleCollisionCount} 项。${
                    precheckMutation.data.errorCount > 0
                      ? '存在错误项时建议先调整后再导入。'
                      : ''
                  }`}
                />
              ) : (
                <Alert type="info" showIcon message="正在执行导入预检查…" />
              )}

              <Table
                rowKey="key"
                pagination={false}
                size="small"
                scroll={{ x: 720 }}
                dataSource={previewRows.map((row) => {
                  const precheck = precheckMutation.data?.items.find(
                    (item) => item.inputIndex === row.inputIndex,
                  );

                  return {
                    ...row,
                    riskStatus: precheck?.status ?? 'safe',
                    riskText:
                      precheck?.issues.length
                        ? precheck.issues.map((issue) => issue.message).join('；')
                        : '未发现风险',
                  };
                })}
                columns={[
                  { title: '原文件名', dataIndex: 'originalName' },
                  { title: '导入后标题', dataIndex: 'title' },
                  { title: '大小', dataIndex: 'sizeText', width: 120 },
                  {
                    title: '预检查',
                    render: (_value, record: { riskStatus: string; riskText: string }) =>
                      record.riskStatus === 'error' ? (
                        <Text type="danger">{record.riskText}</Text>
                      ) : record.riskStatus === 'warning' ? (
                        <Text type="warning">{record.riskText}</Text>
                      ) : (
                        <Text type="secondary">{record.riskText}</Text>
                      ),
                  },
                ]}
              />

              <div className="member-asset-inline-note">
                <Text strong>导入说明</Text>
                <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                  导入完成后，这批资料会立即出现在家族资料中心和成员详情页中；若标题规则不理想，也可以后续继续批量整理或单条编辑。
                </Paragraph>
              </div>
            </Space>
          ) : null}
        </Space>
      </Form>
    </Modal>
  );
}
