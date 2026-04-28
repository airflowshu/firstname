'use client';

import dayjs from 'dayjs';
import { Alert, DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import { useEffect } from 'react';
import type { MemberDetail } from '@/lib/types';

type SupplementRequestFormValues = {
  name?: string;
  gender?: MemberDetail['gender'];
  birthDate?: dayjs.Dayjs;
  deathDate?: dayjs.Dayjs;
  lifeStatus?: MemberDetail['lifeStatus'];
  generationName?: string;
  birthOrder?: number;
  nativePlace?: string;
  notes?: string;
  reason?: string;
};

export function SupplementRequestModal({
  open,
  member,
  loading,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  member?: MemberDetail;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (values: {
    patch: Record<string, unknown>;
    reason?: string;
  }) => Promise<void> | void;
}) {
  const [form] = Form.useForm<SupplementRequestFormValues>();
  const lifeStatus = Form.useWatch('lifeStatus', form);

  useEffect(() => {
    if (!open || !member) {
      return;
    }

    form.resetFields();
    form.setFieldsValue({
      name: member.name,
      gender: member.gender,
      birthDate: member.birthDate ? dayjs(member.birthDate) : undefined,
      deathDate: member.deathDate ? dayjs(member.deathDate) : undefined,
      lifeStatus: member.lifeStatus,
      generationName: member.generationName ?? undefined,
      birthOrder: member.birthOrder ?? undefined,
      nativePlace: member.nativePlace ?? undefined,
      notes: member.notes ?? undefined,
      reason: undefined,
    });
  }, [form, member, open]);

  useEffect(() => {
    if (!open || lifeStatus === 'DECEASED') {
      return;
    }

    if (form.getFieldValue('deathDate')) {
      form.setFieldValue('deathDate', undefined);
    }
  }, [form, lifeStatus, open]);

  return (
    <Modal
      open={open}
      title={member ? `提交资料补充：${member.name}` : '提交资料补充'}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="提交申请"
      cancelText="取消"
      destroyOnHidden
      width={760}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={async (values) => {
          if (!member) {
            return;
          }

          const patch: Record<string, unknown> = {};
          const setIfChanged = (key: string, nextValue: unknown, currentValue: unknown) => {
            if (nextValue === undefined || nextValue === null || nextValue === '') {
              return;
            }

            if (nextValue !== currentValue) {
              patch[key] = nextValue;
            }
          };

          setIfChanged('name', values.name?.trim(), member.name);
          setIfChanged('gender', values.gender, member.gender);
          setIfChanged(
            'birthDate',
            values.birthDate ? values.birthDate.format('YYYY-MM-DD') : undefined,
            member.birthDate ? dayjs(member.birthDate).format('YYYY-MM-DD') : undefined,
          );
          setIfChanged(
            'deathDate',
            values.deathDate ? values.deathDate.format('YYYY-MM-DD') : undefined,
            member.deathDate ? dayjs(member.deathDate).format('YYYY-MM-DD') : undefined,
          );
          setIfChanged('lifeStatus', values.lifeStatus, member.lifeStatus);
          setIfChanged('generationName', values.generationName?.trim(), member.generationName ?? undefined);
          setIfChanged('birthOrder', values.birthOrder, member.birthOrder ?? undefined);
          setIfChanged('nativePlace', values.nativePlace?.trim(), member.nativePlace ?? undefined);
          setIfChanged('notes', values.notes?.trim(), member.notes ?? undefined);

          await onSubmit({
            patch,
            reason: values.reason?.trim() || undefined,
          });
        }}
      >
        <Alert
          style={{ marginBottom: 16 }}
          type="info"
          showIcon
          message="补充申请说明"
          description="普通查看用户不能直接修改主数据。你提交后，管理员审核通过后才会正式写入成员资料。"
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Item name="name" label="姓名">
            <Input placeholder="请输入成员姓名" />
          </Form.Item>
          <Form.Item name="gender" label="性别">
            <Select
              options={[
                { label: '男', value: 'MALE' },
                { label: '女', value: 'FEMALE' },
                { label: '未知', value: 'UNKNOWN' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="birthDate"
            label="出生日期"
            dependencies={['deathDate']}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const deathDate = getFieldValue('deathDate') as dayjs.Dayjs | undefined;
                  if (value && deathDate && value.isAfter(deathDate, 'day')) {
                    return Promise.reject(new Error('出生日期不能晚于去世日期'));
                  }

                  return Promise.resolve();
                },
              }),
            ]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="deathDate"
            label="去世日期"
            dependencies={['birthDate']}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const birthDate = getFieldValue('birthDate') as dayjs.Dayjs | undefined;
                  if (value && birthDate && birthDate.isAfter(value, 'day')) {
                    return Promise.reject(new Error('去世日期不能早于出生日期'));
                  }

                  return Promise.resolve();
                },
              }),
            ]}
          >
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
        </div>
        <Form.Item name="notes" label="备注">
          <Input.TextArea rows={4} placeholder="补充生平说明、家族备注等" />
        </Form.Item>
        <Form.Item name="reason" label="补充说明">
          <Input.TextArea rows={3} placeholder="说明本次补充资料的来源或背景，便于管理员审核" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
