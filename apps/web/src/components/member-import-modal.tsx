'use client';

import { DownloadOutlined, FileExcelOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Modal, Space, Typography } from 'antd';
import { useRef, useState } from 'react';

const { Paragraph, Text } = Typography;

export function MemberImportModal({
  open,
  loading,
  onCancel,
  onDownloadTemplate,
  onImport,
}: {
  open: boolean;
  loading?: boolean;
  onCancel: () => void;
  onDownloadTemplate: () => Promise<void> | void;
  onImport: (file: File) => Promise<void> | void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  return (
    <Modal
      open={open}
      title="Excel 导入成员"
      onCancel={() => {
        setSelectedFile(null);
        onCancel();
      }}
      onOk={async () => {
        if (!selectedFile) {
          return;
        }

        await onImport(selectedFile);
        setSelectedFile(null);
      }}
      okText="开始导入"
      cancelText="取消"
      okButtonProps={{
        disabled: !selectedFile,
        loading,
      }}
      destroyOnHidden
      width={720}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="导入说明"
          description={
            <div>
              <div>1. 先下载模板，按模板字段填写成员数据。</div>
              <div>2. 通过“编号 / 父亲编号 / 母亲编号”建立同一文件内的亲子关系。</div>
              <div>3. 当前版本导入以新建成员为主，不会自动匹配或覆盖现有成员。</div>
            </div>
          }
        />

        <div className="soft-panel" style={{ padding: 16 }}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Button icon={<DownloadOutlined />} onClick={() => void onDownloadTemplate()}>
              下载导入模板
            </Button>

            <input
              ref={fileInputRef}
              hidden
              type="file"
              accept=".xlsx"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFile(file);
              }}
            />

            <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>
              选择 Excel 文件
            </Button>

            {selectedFile ? (
              <Space>
                <FileExcelOutlined style={{ color: '#217346' }} />
                <Text strong>{selectedFile.name}</Text>
              </Space>
            ) : (
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                当前未选择文件，请上传 `.xlsx` 格式的成员导入表。
              </Paragraph>
            )}
          </Space>
        </div>
      </Space>
    </Modal>
  );
}
