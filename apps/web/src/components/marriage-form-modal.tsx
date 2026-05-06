'use client';

import dayjs from 'dayjs';
import { DatePicker, Form, Input, Modal, Select } from 'antd';
import { useEffect } from 'react';
import type { MemberOption } from '@/lib/types';
import { RemoteMemberSelect } from './remote-member-select';

export function MarriageFormModal({
  open,
  title,
  spouseName,
  seedOptions = [],
  loading,
  initialValue,
  canSelectSpouse = true,
  disabledIds = [],
  onCancel,
  onSubmit,
}: {
  open: boolean;
  title: string;
  spouseName?: string;
  seedOptions?: MemberOption[];
  loading?: boolean;
  initialValue?: Record<string, unknown>;
  canSelectSpouse?: boolean;
  disabledIds?: string[];
  onCancel: () => void;
  onSubmit: (values: Record<string, unknown>) => Promise<void> | void;
}) {
  const [form] = Form.useForm();
  const marriageStatus = Form.useWatch('status', form) as string | undefined;

  useEffect(() => {
    if (!open) {
      return;
    }

    form.resetFields();
    form.setFieldsValue({
      ...initialValue,
      startDate: initialValue?.startDate ? dayjs(String(initialValue.startDate)) : undefined,
      endDate: initialValue?.endDate ? dayjs(String(initialValue.endDate)) : undefined,
    });
  }, [form, initialValue, open]);

  useEffect(() => {
    if (!open || marriageStatus !== 'ACTIVE') {
      return;
    }

    if (form.getFieldValue('endDate')) {
      form.setFieldValue('endDate', undefined);
    }
  }, [form, marriageStatus, open]);

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={async (values) => {
          await onSubmit({
            ...values,
            startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : undefined,
            endDate:
              values.status === 'ACTIVE'
                ? undefined
                : values.endDate
                  ? values.endDate.format('YYYY-MM-DD')
                  : undefined,
          });
        }}
      >
        {canSelectSpouse ? (
          <Form.Item
            name="spouseId"
            label="配偶成员"
            rules={[{ required: true, message: '请选择配偶成员' }]}
          >
            <RemoteMemberSelect
              placeholder="搜索并选择配偶"
              disabledIds={disabledIds}
              seedOptions={seedOptions}
              allowClear={false}
            />
          </Form.Item>
        ) : (
          <Form.Item label="配偶成员">
            <Input value={spouseName} disabled />
          </Form.Item>
        )}
        <Form.Item name="status" label="婚姻状态">
          <Select
            options={[
              { label: '婚姻存续', value: 'ACTIVE' },
              { label: '离异', value: 'DIVORCED' },
              { label: '丧偶', value: 'WIDOWED' },
            ]}
          />
        </Form.Item>
        <Form.Item name="startDate" label="开始日期">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="endDate" label="结束日期">
          <DatePicker
            style={{ width: '100%' }}
            disabled={marriageStatus === 'ACTIVE'}
            placeholder={marriageStatus === 'ACTIVE' ? '婚姻存续时无需填写结束日期' : '请选择结束日期'}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
