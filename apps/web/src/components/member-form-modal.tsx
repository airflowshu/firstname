'use client';

import dayjs from 'dayjs';
import { Alert, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { DuplicateMemberCheckResult, LifeStatus } from '@/lib/types';
import type { MemberListItem, MemberOption } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { RemoteMemberSelect } from './remote-member-select';

const { Text } = Typography;

type MemberFormValue = Partial<MemberListItem> & {
  father?: { id: string; name: string; gender?: 'MALE' | 'FEMALE' | 'UNKNOWN' } | null;
  mother?: { id: string; name: string; gender?: 'MALE' | 'FEMALE' | 'UNKNOWN' } | null;
};

type MemberFieldKey = 'gender' | 'fatherId' | 'motherId';

export function MemberFormModal({
  open,
  title,
  initialValue,
  hint,
  disabledFields,
  loading,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initialValue?: MemberFormValue;
  hint?: string;
  disabledFields?: Partial<Record<MemberFieldKey, boolean>>;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (values: Record<string, unknown>) => Promise<void> | void;
}) {
  const [form] = Form.useForm();
  const lifeStatus = Form.useWatch('lifeStatus', form) as LifeStatus | undefined;
  const watchedName = Form.useWatch('name', form) as string | undefined;
  const watchedGender = Form.useWatch('gender', form) as MemberListItem['gender'] | undefined;
  const watchedBirthDate = Form.useWatch('birthDate', form) as dayjs.Dayjs | undefined;
  const watchedFatherId = Form.useWatch('fatherId', form) as string | undefined;
  const watchedMotherId = Form.useWatch('motherId', form) as string | undefined;
  const watchedGenerationName = Form.useWatch('generationName', form) as string | undefined;
  const watchedNativePlace = Form.useWatch('nativePlace', form) as string | undefined;
  const [duplicateResult, setDuplicateResult] = useState<DuplicateMemberCheckResult | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

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

  useEffect(() => {
    if (!open) {
      setDuplicateResult(null);
      return;
    }

    const normalizedName = watchedName?.trim();
    if (!normalizedName || normalizedName.length < 2) {
      setDuplicateResult(null);
      return;
    }

    const timer = window.setTimeout(() => {
      setCheckingDuplicate(true);
      void api
        .checkMemberDuplicates({
          excludeId: initialValue?.id,
          name: normalizedName,
          gender: watchedGender,
          birthDate: watchedBirthDate ? watchedBirthDate.format('YYYY-MM-DD') : undefined,
          fatherId: watchedFatherId,
          motherId: watchedMotherId,
          generationName: watchedGenerationName?.trim() || undefined,
          nativePlace: watchedNativePlace?.trim() || undefined,
        })
        .then((result) => {
          setDuplicateResult(result.hasMatches ? result : null);
        })
        .catch((error) => {
          if (!(error instanceof ApiError && error.status === 400)) {
            setDuplicateResult(null);
          }
        })
        .finally(() => {
          setCheckingDuplicate(false);
        });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [
    initialValue?.id,
    open,
    watchedBirthDate,
    watchedFatherId,
    watchedGender,
    watchedGenerationName,
    watchedMotherId,
    watchedName,
    watchedNativePlace,
  ]);

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
        {hint ? (
          <Alert
            style={{ marginBottom: 16 }}
            type="info"
            showIcon
            message="快速建亲属"
            description={hint}
          />
        ) : null}

        {duplicateResult ? (
          <Alert
            style={{ marginBottom: 16 }}
            type="warning"
            showIcon
            message={`发现 ${duplicateResult.matches.length} 个疑似重复成员`}
            description={
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {duplicateResult.matches.map((match) => (
                  <div key={match.id}>
                    <Space wrap size={[8, 8]}>
                      <Text strong>{match.name}</Text>
                      <Tag color={match.gender === 'MALE' ? 'blue' : match.gender === 'FEMALE' ? 'magenta' : 'default'}>
                        {match.gender === 'MALE' ? '男' : match.gender === 'FEMALE' ? '女' : '未知'}
                      </Tag>
                      <Tag>{`匹配度 ${match.score}`}</Tag>
                      {match.matchedFields.map((field) => (
                        <Tag key={field} color="orange">
                          {field}
                        </Tag>
                      ))}
                    </Space>
                    <div style={{ marginTop: 6, color: '#6b4b33', fontSize: 13 }}>
                      {[
                        formatDate(match.birthDate),
                        match.generationName ? `字辈 ${match.generationName}` : null,
                        match.nativePlace,
                        match.father?.name ? `父亲 ${match.father.name}` : null,
                        match.mother?.name ? `母亲 ${match.mother.name}` : null,
                      ]
                        .filter((item) => item && item !== '-')
                        .join(' · ')}
                    </div>
                  </div>
                ))}
              </Space>
            }
          />
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
            extra={checkingDuplicate ? '正在检测是否与现有成员重复…' : '输入姓名后系统会自动检查疑似重复成员'}
          >
            <Input placeholder="请输入成员姓名" />
          </Form.Item>
          <Form.Item name="gender" label="性别" rules={[{ required: true, message: '请选择性别' }]}>
            <Select
              disabled={Boolean(disabledFields?.gender)}
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
          <Form.Item
            name="fatherId"
            label="父亲"
            dependencies={['motherId']}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const motherId = getFieldValue('motherId') as string | undefined;
                  if (value && motherId && value === motherId) {
                    return Promise.reject(new Error('父亲和母亲不能选择同一成员'));
                  }

                  return Promise.resolve();
                },
              }),
            ]}
          >
            <RemoteMemberSelect
              placeholder="搜索并选择父亲"
              disabledIds={initialValue?.id ? [initialValue.id] : []}
              seedOptions={seedOptions}
              disabled={Boolean(disabledFields?.fatherId)}
            />
          </Form.Item>
          <Form.Item
            name="motherId"
            label="母亲"
            dependencies={['fatherId']}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const fatherId = getFieldValue('fatherId') as string | undefined;
                  if (value && fatherId && value === fatherId) {
                    return Promise.reject(new Error('父亲和母亲不能选择同一成员'));
                  }

                  return Promise.resolve();
                },
              }),
            ]}
          >
            <RemoteMemberSelect
              placeholder="搜索并选择母亲"
              disabledIds={initialValue?.id ? [initialValue.id] : []}
              seedOptions={seedOptions}
              disabled={Boolean(disabledFields?.motherId)}
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
