'use client';

import { Alert, Button, Modal, Space, Table, Tag, Typography } from 'antd';
import { formatDate } from '@/lib/format';
import type { AssetImportBatchResult } from '@/lib/types';

const { Paragraph, Text } = Typography;

export function AssetImportResultModal({
  open,
  result,
  onClose,
  onViewBatch,
  onContinueBatch,
  onRetryFailed,
}: {
  open: boolean;
  result: AssetImportBatchResult | null;
  onClose: () => void;
  onViewBatch?: (payload: { batchId: string; memberName: string; createdAssetIds: string[] }) => void;
  onContinueBatch?: (payload: {
    batchId: string;
    memberName: string;
    createdAssetIds: string[];
  }) => void;
  onRetryFailed?: (payload: {
    batchId: string;
    memberName: string;
    failureIndexes: number[];
  }) => void;
}) {
  return (
    <Modal
      open={open}
      title="导入结果摘要"
      onCancel={onClose}
      footer={
        result ? (
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Button onClick={onClose}>关闭</Button>
            </Space>
            <Space>
              {result.createdAssets.length > 0 && onViewBatch ? (
                <Button
                  onClick={() =>
                    onViewBatch({
                      batchId: result.auditLogId,
                      memberName: result.memberName,
                      createdAssetIds: result.createdAssets.map((item) => item.id),
                    })
                  }
                >
                  查看本批次资料
                </Button>
              ) : null}
              {result.failures.length > 0 && onRetryFailed ? (
                <Button
                  onClick={() =>
                    onRetryFailed({
                      batchId: result.auditLogId,
                      memberName: result.memberName,
                      failureIndexes: result.failures.map((item) => item.inputIndex),
                    })
                  }
                >
                  重试失败项
                </Button>
              ) : null}
              {result.createdAssets.length > 0 && onContinueBatch ? (
                <Button
                  type="primary"
                  onClick={() =>
                    onContinueBatch({
                      batchId: result.auditLogId,
                      memberName: result.memberName,
                      createdAssetIds: result.createdAssets.map((item) => item.id),
                    })
                  }
                >
                  继续批量整理
                </Button>
              ) : null}
            </Space>
          </Space>
        ) : undefined
      }
      width={860}
      destroyOnHidden
    >
      {result ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            type={result.failedCount > 0 ? 'warning' : 'success'}
            showIcon
            message={
              result.failedCount > 0
                ? `本次导入完成：成功 ${result.successCount} 项，失败 ${result.failedCount} 项`
                : `本次导入成功完成，共导入 ${result.successCount} 项资料`
            }
            description={`归属成员：${result.memberName} · 类型：${
              result.category === 'PHOTO' ? '照片资料' : '附件资料'
            } · 时间：${formatDate(result.createdAt, 'YYYY-MM-DD HH:mm:ss')}`}
          />

          <div className="member-asset-inline-note">
            <Text strong>批次摘要</Text>
            <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
              审计批次 ID：{result.auditLogId}，总计 {result.totalCount} 项，成功 {result.successCount}{' '}
              项，失败 {result.failedCount} 项。
            </Paragraph>
          </div>

          {result.createdAssets.length > 0 ? (
            <Table
              rowKey="id"
              pagination={false}
              size="small"
              dataSource={result.createdAssets}
              columns={[
                {
                  title: '导入结果',
                  render: () => <Tag color="success">成功</Tag>,
                  width: 100,
                },
                {
                  title: '资料标题',
                  render: (_value, record) => record.title || record.originalName,
                },
                {
                  title: '来源',
                  render: (_value, record) =>
                    [record.sourceType, record.source].filter(Boolean).join(' · ') || '-',
                },
                {
                  title: '标签',
                  render: (_value, record) =>
                    record.tags.length > 0 ? record.tags.join('、') : '-',
                },
              ]}
            />
          ) : null}

          {result.failures.length > 0 ? (
            <Table
              rowKey={(record) => `${record.originalName}-${record.message}`}
              pagination={false}
              size="small"
              dataSource={result.failures}
              columns={[
                {
                  title: '导入结果',
                  render: () => <Tag color="error">失败</Tag>,
                  width: 100,
                },
                {
                  title: '原文件名',
                  dataIndex: 'originalName',
                },
                {
                  title: '失败原因',
                  dataIndex: 'message',
                },
              ]}
            />
          ) : null}
        </Space>
      ) : null}
    </Modal>
  );
}
