'use client';

import { DatePicker, Form, Input, Modal, Select } from 'antd';
import { useEffect } from 'react';
import type { MemberEventType } from '@/lib/types';

const eventTypeOptions: Array<{ label: string; value: MemberEventType }> = [
  { label: '出生', value: 'BIRTH' },
  { label: '婚姻', value: 'MARRIAGE' },
  { label: '离异', value: 'DIVORCE' },
  { label: '去世', value: 'DEATH' },
  { label: '迁徙', value: 'MOVE' },
  { label: '职业', value: 'CAREER' },
  { label: '荣誉', value: 'HONOR' },
  { label: '故事', value: 'STORY' },
  { label: '其他', value: 'OTHER' },
];

export function MemberEventModal({
  open,
  memberName,
  loading,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  memberName?: string;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (values: {
    eventType: MemberEventType;
    title: string;
    description?: string;
    eventDate: string;
  }) => Promise<void> | void;
}) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (!open) {
      return;
    }

    form.resetFields();
  }, [form, open]);

  return (
    <Modal
      open={open}
      title={memberName ? `新增成员事件：${memberName}` : '新增成员事件'}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="保存事件"
      cancelText="取消"
      destroyOnHidden
      width={640}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={async (values) => {
          await onSubmit({
            eventType: values.eventType,
            title: values.title.trim(),
            description: values.description?.trim() || undefined,
            eventDate: values.eventDate.format('YYYY-MM-DD'),
          });
        }}
      >
        <Form.Item
          label="事件类型"
          name="eventType"
          rules={[{ required: true, message: '请选择事件类型' }]}
        >
          <Select options={eventTypeOptions} />
        </Form.Item>
        <Form.Item label="事件标题" name="title" rules={[{ required: true, message: '请输入事件标题' }]}>
          <Input placeholder="例如：迁居上海、参加工作、获得奖项" />
        </Form.Item>
        <Form.Item label="事件日期" name="eventDate" rules={[{ required: true, message: '请选择事件日期' }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="事件说明" name="description">
          <Input.TextArea rows={4} placeholder="可补充时间线背景、事件经过、来源说明等" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
