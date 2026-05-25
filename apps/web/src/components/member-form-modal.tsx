'use client';

import dayjs from 'dayjs';
import {
  Alert,
  AutoComplete,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import type { MemberMutationPayload } from '@/lib/api';
import { api, ApiError } from '@/lib/api';
import type { DuplicateMemberCheckResult, LifeStatus } from '@/lib/types';
import type { MemberListItem, MemberOption } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { CemeteryMapPicker } from './cemetery-map-picker';
import { RemoteMemberSelect } from './remote-member-select';

const { Text } = Typography;

type MemberFormValue = Partial<MemberListItem> & {
  father?: { id: string; name: string; gender?: 'MALE' | 'FEMALE' | 'UNKNOWN' } | null;
  mother?: { id: string; name: string; gender?: 'MALE' | 'FEMALE' | 'UNKNOWN' } | null;
};

type MemberFieldKey = 'gender' | 'fatherId' | 'motherId';

type ExistingMemberNameMatchConfig = {
  enabled?: boolean;
  gender?: MemberListItem['gender'];
  disabledIds?: string[];
  relationLabel?: string;
};

export function MemberFormModal({
  open,
  title,
  initialValue,
  hint,
  disabledFields,
  hiddenFields,
  existingMemberNameMatch,
  loading,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initialValue?: MemberFormValue;
  hint?: string;
  disabledFields?: Partial<Record<MemberFieldKey, boolean>>;
  hiddenFields?: Partial<Record<MemberFieldKey, boolean>>;
  existingMemberNameMatch?: ExistingMemberNameMatchConfig;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (values: MemberMutationPayload) => Promise<void> | void;
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
  const watchedCemeteryLatitude = Form.useWatch('cemeteryLatitude', form) as number | undefined | null;
  const watchedCemeteryLongitude = Form.useWatch('cemeteryLongitude', form) as number | undefined | null;
  const watchedCemeteryName = Form.useWatch('cemeteryName', form) as string | undefined | null;
  const watchedCemeteryAddress = Form.useWatch('cemeteryAddress', form) as string | undefined | null;
  const watchedCemeteryPoiId = Form.useWatch('cemeteryPoiId', form) as string | undefined | null;
  const watchedCemeteryRemark = Form.useWatch('cemeteryRemark', form) as string | undefined | null;
  const [duplicateResult, setDuplicateResult] = useState<DuplicateMemberCheckResult | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [nameMatchOptions, setNameMatchOptions] = useState<MemberOption[]>([]);
  const [fetchingNameMatches, setFetchingNameMatches] = useState(false);
  const [selectedExistingMember, setSelectedExistingMember] = useState<MemberOption | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    form.resetFields();
    form.setFieldsValue({
      ...initialValue,
      birthDate: initialValue?.birthDate ? dayjs(initialValue.birthDate) : undefined,
      deathDate: initialValue?.deathDate ? dayjs(initialValue.deathDate) : undefined,
      cemeteryLatitude: initialValue?.cemeteryLatitude ?? null,
      cemeteryLongitude: initialValue?.cemeteryLongitude ?? null,
      cemeteryName: initialValue?.cemeteryName ?? null,
      cemeteryAddress: initialValue?.cemeteryAddress ?? null,
      cemeteryPoiId: initialValue?.cemeteryPoiId ?? null,
      cemeteryRemark: initialValue?.cemeteryRemark ?? null,
    });
    setSelectedExistingMember(null);
    setNameMatchOptions([]);
  }, [form, initialValue, open]);

  useEffect(() => {
    if (!open || lifeStatus === undefined || lifeStatus === 'DECEASED') {
      return;
    }

    form.setFieldsValue({
      deathDate: undefined,
      cemeteryLatitude: null,
      cemeteryLongitude: null,
      cemeteryName: null,
      cemeteryAddress: null,
      cemeteryPoiId: null,
      cemeteryRemark: null,
    });
  }, [form, lifeStatus, open]);

  useEffect(() => {
    if (!open) {
      setDuplicateResult(null);
      return;
    }

    if (selectedExistingMember) {
      setDuplicateResult(null);
      setCheckingDuplicate(false);
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
    selectedExistingMember,
    watchedBirthDate,
    watchedFatherId,
    watchedGender,
    watchedGenerationName,
    watchedMotherId,
    watchedName,
    watchedNativePlace,
  ]);

  useEffect(() => {
    if (!open || !existingMemberNameMatch?.enabled) {
      setNameMatchOptions([]);
      setSelectedExistingMember(null);
      return;
    }

    const normalizedName = watchedName?.trim();
    if (!normalizedName) {
      setNameMatchOptions([]);
      setSelectedExistingMember(null);
      return;
    }

    if (selectedExistingMember && selectedExistingMember.name !== normalizedName) {
      setSelectedExistingMember(null);
    }

    const timer = window.setTimeout(() => {
      setFetchingNameMatches(true);
      void api
        .getMemberOptions(normalizedName)
        .then((options) => {
          const disabledIds = new Set(existingMemberNameMatch.disabledIds ?? []);
          setNameMatchOptions(
            options.filter(
              (option) =>
                !disabledIds.has(option.id) &&
                (!existingMemberNameMatch.gender || option.gender === existingMemberNameMatch.gender),
            ),
          );
        })
        .catch(() => {
          setNameMatchOptions([]);
        })
        .finally(() => {
          setFetchingNameMatches(false);
        });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    existingMemberNameMatch?.disabledIds,
    existingMemberNameMatch?.enabled,
    existingMemberNameMatch?.gender,
    open,
    selectedExistingMember,
    watchedName,
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

  const nameAutocompleteOptions = useMemo(
    () =>
      nameMatchOptions.map((option) => ({
        value: option.name,
        member: option,
        label: (
          <div className="member-select-option-line" title={[option.name, option.subtitle].filter(Boolean).join(' · ')}>
            <span className="member-select-option-name">{option.name}</span>
            {option.subtitle ? <span className="member-select-option-native">· {option.subtitle}</span> : null}
          </div>
        ),
      })),
    [nameMatchOptions],
  );

  const resetExistingMemberFields = () => {
    form.setFieldsValue({
      gender: initialValue?.gender,
      birthDate: undefined,
      deathDate: undefined,
      lifeStatus: initialValue?.lifeStatus ?? 'ALIVE',
      cemeteryLatitude: null,
      cemeteryLongitude: null,
      cemeteryName: null,
      cemeteryAddress: null,
      cemeteryPoiId: null,
      cemeteryRemark: null,
      generationName: undefined,
      birthOrder: undefined,
      nativePlace: undefined,
      notes: undefined,
    });
  };

  const applyExistingMember = async (option: MemberOption) => {
    setSelectedExistingMember(option);
    setDuplicateResult(null);
    setCheckingDuplicate(false);
    form.setFieldsValue({
      name: option.name,
      gender: option.gender,
    });

    try {
      const member = await api.getMember(option.id);
      const subtitle = [
        member.birthDate ? `${dayjs(member.birthDate).format('YYYY-MM-DD')} 生` : null,
        member.deathDate ? `${dayjs(member.deathDate).format('YYYY-MM-DD')} 殁` : null,
        member.generationName ? `字辈 ${member.generationName}` : null,
        member.nativePlace,
      ]
        .filter(Boolean)
        .join(' · ');

      setSelectedExistingMember({
        id: member.id,
        name: member.name,
        gender: member.gender,
        subtitle,
      });
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
      });
    } catch {
      setSelectedExistingMember(option);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      forceRender
      destroyOnHidden
      width={760}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={async (values) => {
          const payload: MemberMutationPayload = {
            ...values,
            existingMemberId: existingMemberNameMatch?.enabled ? selectedExistingMember?.id : undefined,
            birthDate: values.birthDate ? values.birthDate.format('YYYY-MM-DD') : undefined,
            deathDate:
              values.lifeStatus === 'DECEASED'
                ? values.deathDate
                  ? values.deathDate.format('YYYY-MM-DD')
                  : null
                : null,
            cemeteryLatitude: values.lifeStatus === 'DECEASED' ? (values.cemeteryLatitude ?? null) : null,
            cemeteryLongitude:
              values.lifeStatus === 'DECEASED' ? (values.cemeteryLongitude ?? null) : null,
            cemeteryName: values.lifeStatus === 'DECEASED' ? values.cemeteryName?.trim() || null : null,
            cemeteryAddress:
              values.lifeStatus === 'DECEASED' ? values.cemeteryAddress?.trim() || null : null,
            cemeteryPoiId: values.lifeStatus === 'DECEASED' ? values.cemeteryPoiId?.trim() || null : null,
            cemeteryRemark:
              values.lifeStatus === 'DECEASED' ? values.cemeteryRemark?.trim() || null : null,
          };

          await onSubmit(payload);
        }}
      >
        {selectedExistingMember ? (
          <Alert
            style={{ marginBottom: 16 }}
            type="success"
            showIcon
            message={`已选择已有成员作为${existingMemberNameMatch?.relationLabel ?? '亲属'}`}
            description={`下方为“${selectedExistingMember.name}”当前资料概要。提交后只绑定该成员，不会创建同名新成员。`}
          />
        ) : hint ? (
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
            extra={
              existingMemberNameMatch?.enabled
                ? '可输入姓名后从匹配结果中选择已有成员；不选择则创建新成员'
                : checkingDuplicate
                  ? '正在检测是否与现有成员重复…'
                  : '输入姓名后系统会自动检查疑似重复成员'
            }
          >
            {existingMemberNameMatch?.enabled ? (
              <AutoComplete
                allowClear
                options={nameAutocompleteOptions}
                notFoundContent={fetchingNameMatches ? '正在检索匹配成员…' : '暂无匹配成员'}
                placeholder="请输入姓名，或选择已有成员"
                onSelect={(_, option) => {
                  const memberOption = (option as { member?: MemberOption }).member;
                  if (memberOption) {
                    void applyExistingMember(memberOption);
                  }
                }}
                onChange={(value) => {
                  if (selectedExistingMember && value !== selectedExistingMember.name) {
                    setSelectedExistingMember(null);
                    resetExistingMemberFields();
                  }
                }}
              />
            ) : (
              <Input placeholder="请输入成员姓名" />
            )}
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
            <DatePicker style={{ width: '100%' }} disabled={Boolean(selectedExistingMember)} />
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
              disabled={Boolean(selectedExistingMember) || lifeStatus !== 'DECEASED'}
              placeholder={lifeStatus === 'DECEASED' ? '请选择去世日期' : '请先将生命状态设为已故'}
            />
          </Form.Item>
          <Form.Item name="lifeStatus" label="生命状态">
            <Select
              disabled={Boolean(selectedExistingMember)}
              options={[
                { label: '在世', value: 'ALIVE' },
                { label: '已故', value: 'DECEASED' },
                { label: '未知', value: 'UNKNOWN' },
              ]}
            />
          </Form.Item>
          <Form.Item name="generationName" label="字辈 / 代际">
            <Input disabled={Boolean(selectedExistingMember)} placeholder="如：振、国、磊" />
          </Form.Item>
          <Form.Item name="birthOrder" label="排行">
            <InputNumber disabled={Boolean(selectedExistingMember)} min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="nativePlace" label="籍贯">
            <Input disabled={Boolean(selectedExistingMember)} placeholder="如：江苏徐州" />
          </Form.Item>
          {hiddenFields?.fatherId ? null : (
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
          )}
          {hiddenFields?.motherId ? null : (
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
          )}
        </div>
        {lifeStatus === 'DECEASED' ? (
          <Form.Item label="墓地位置标记" style={{ marginTop: 8 }}>
            <CemeteryMapPicker
              value={{
                cemeteryLatitude: watchedCemeteryLatitude,
                cemeteryLongitude: watchedCemeteryLongitude,
                cemeteryName: watchedCemeteryName,
                cemeteryAddress: watchedCemeteryAddress,
                cemeteryPoiId: watchedCemeteryPoiId,
                cemeteryRemark: watchedCemeteryRemark,
              }}
              disabled={Boolean(selectedExistingMember)}
              onChange={(nextValue) => form.setFieldsValue(nextValue)}
            />
          </Form.Item>
        ) : null}
        <Form.Item name="cemeteryLatitude" hidden>
          <InputNumber />
        </Form.Item>
        <Form.Item name="cemeteryLongitude" hidden>
          <InputNumber />
        </Form.Item>
        <Form.Item name="cemeteryName" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="cemeteryAddress" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="cemeteryPoiId" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="cemeteryRemark" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="notes" label="备注">
          <Input.TextArea
            disabled={Boolean(selectedExistingMember)}
            rows={4}
            placeholder="可记录族谱说明、生平简介、额外备注等"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
