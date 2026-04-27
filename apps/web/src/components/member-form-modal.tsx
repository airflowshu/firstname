'use client';

import dayjs from 'dayjs';
import { DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import { useEffect } from 'react';
import type { LifeStatus } from '@/lib/types';
import type { MemberListItem, MemberOption } from '@/lib/types';
import { RemoteMemberSelect } from './remote-member-select';

type MemberFormValue = Partial<MemberListItem> & {
  father?: { id: string; name: string; gender?: 'MALE' | 'FEMALE' | 'UNKNOWN' } | null;
  mother?: { id: string; name: string; gender?: 'MALE' | 'FEMALE' | 'UNKNOWN' } | null;
};

export function MemberFormModal({
  open,
  title,
  initialValue,
  loading,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initialValue?: MemberFormValue;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (values: Record<string, unknown>) => Promise<void> | void;
}) {
  const [form] = Form.useForm();
  const lifeStatus = Form.useWatch('lifeStatus', form) as LifeStatus | undefined;

  useEffect(() => {
    if (!open) {
      return;
    }

    form.resetFields();
    form.setFieldsValue({
      ...initialValue,
      birthDate: initialValue?.birthDate ? dayjs(initialValue.birthDate) : undefined,
      deathDate: initialValue?.deathDate ? dayjs(initialValue.deathDate) : undefined,
    });
  }, [form, initialValue, open]);

  useEffect(() => {
    if (!open || lifeStatus === 'DECEASED') {
      return;
    }

    if (form.getFieldValue('deathDate')) {
      form.setFieldValue('deathDate', undefined);
    }
  }, [form, lifeStatus, open]);

  const seedOptions: MemberOption[] = [
    initialValue?.father
      ? {
          id: initialValue.father.id,
          name: initialValue.father.name,
          gender: initialValue.father.gender ?? 'UNKNOWN',
          subtitle: '父亲',
        }
      : null,
    initialValue?.mother
      ? {
          id: initialValue.mother.id,
          name: initialValue.mother.name,
          gender: initialValue.mother.gender ?? 'UNKNOWN',
          subtitle: '母亲',
        }
      : null,
  ].filter(Boolean) as MemberOption[];

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      destroyOnHidden
      width={760}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={async (values) => {
          await onSubmit({
            ...values,
            birthDate: values.birthDate ? values.birthDate.format('YYYY-MM-DD') : undefined,
            deathDate: values.deathDate ? values.deathDate.format('YYYY-MM-DD') : undefined,
          });
        }}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="请输入成员姓名" />
          </Form.Item>
          <Form.Item name="gender" label="性别" rules={[{ required: true, message: '请选择性别' }]}>
            <Select
              options={[
                { label: '男', value: 'MALE' },
                { label: '女', value: 'FEMALE' },
                { label: '未知', value: 'UNKNOWN' },
              ]}
            />
          </Form.Item>
          <Form.Item name="birthDate" label="出生日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="deathDate" label="去世日期">
            <DatePicker
              style={{ width: '100%' }}
              disabled={lifeStatus !== 'DECEASED'}
              placeholder={lifeStatus === 'DECEASED' ? '请选择去世日期' : '请先将生命状态设为已故'}
            />
          </Form.Item>
          <Form.Item name="lifeStatus" label="生命状态">
            <Select
              options={[
                { label: '在世', value: 'ALIVE' },
                { label: '已故', value: 'DECEASED' },
                { label: '未知', value: 'UNKNOWN' },
              ]}
            />
          </Form.Item>
          <Form.Item name="generationName" label="字辈 / 代际">
            <Input placeholder="如：振、国、磊" />
          </Form.Item>
          <Form.Item name="birthOrder" label="排行">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="nativePlace" label="籍贯">
            <Input placeholder="如：江苏徐州" />
          </Form.Item>
          <Form.Item name="fatherId" label="父亲">
            <RemoteMemberSelect
              placeholder="搜索并选择父亲"
              disabledIds={initialValue?.id ? [initialValue.id] : []}
              seedOptions={seedOptions}
            />
          </Form.Item>
          <Form.Item name="motherId" label="母亲">
            <RemoteMemberSelect
              placeholder="搜索并选择母亲"
              disabledIds={initialValue?.id ? [initialValue.id] : []}
              seedOptions={seedOptions}
            />
          </Form.Item>
        </div>
        <Form.Item name="notes" label="备注">
          <Input.TextArea rows={4} placeholder="可记录族谱说明、生平简介、额外备注等" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
