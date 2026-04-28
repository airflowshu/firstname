'use client';

import { FileImageOutlined, FileTextOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Modal, Space, Typography, Upload } from 'antd';
import { useState } from 'react';
import type { UploadFile } from 'antd/es/upload/interface';

const { Paragraph, Text } = Typography;

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
  onSubmit: (payload: { reason?: string; files: File[] }) => Promise<void> | void;
}) {
  const [reason, setReason] = useState('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const isPhoto = category === 'PHOTO';

  return (
    <Modal
      open={open}
      title={memberName ? `提交${isPhoto ? '照片' : '附件'}补充：${memberName}` : '提交资源补充'}
      onCancel={() => {
        setReason('');
        setFileList([]);
        onCancel();
      }}
      onOk={async () => {
        const files = fileList
          .map((item) => item.originFileObj)
          .filter(Boolean) as File[];
        if (files.length === 0) {
          return;
        }
        await onSubmit({
          reason: reason.trim() || undefined,
          files,
        });
        setReason('');
        setFileList([]);
      }}
      okText="提交申请"
      cancelText="取消"
      confirmLoading={loading}
      okButtonProps={{ disabled: fileList.length === 0 }}
      destroyOnHidden
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

        <Upload
          multiple
          beforeUpload={() => false}
          fileList={fileList}
          onChange={({ fileList: nextFileList }) => setFileList(nextFileList)}
          accept={
            isPhoto
              ? 'image/*'
              : '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip'
          }
        >
          <Button icon={<UploadOutlined />}>
            选择{isPhoto ? '照片' : '附件'}文件
          </Button>
        </Upload>

        <div>
          <Text strong>补充说明</Text>
          <Paragraph type="secondary" style={{ marginBottom: 8 }}>
            说明资料来源、拍摄背景或附件内容，便于管理员审核。
          </Paragraph>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            style={{
              width: '100%',
              borderRadius: 8,
              border: '1px solid #d9c6aa',
              padding: 12,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
            placeholder="例如：这张照片拍摄于 1998 年春节，全家合影；或这份附件是毕业证扫描件。"
          />
        </div>
      </Space>
    </Modal>
  );
}
