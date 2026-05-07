'use client';

import {
  ArrowLeftOutlined,
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  FileZipOutlined,
  FilterOutlined,
  PaperClipOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Avatar,
  Button,
  Card,
  Descriptions,
  Divider,
  Dropdown,
  Image,
  Input,
  List,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Tabs,
  Timeline,
  Typography,
} from 'antd';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { useViewportMode } from '@/hooks/use-viewport-mode';
import { MarriageFormModal } from '@/components/marriage-form-modal';
import { MemberAssetModal } from '@/components/member-asset-modal';
import { MemberEventModal } from '@/components/member-event-modal';
import { MemberFormModal } from '@/components/member-form-modal';
import { SupplementAssetRequestModal } from '@/components/supplement-asset-request-modal';
import { SupplementRequestModal } from '@/components/supplement-request-modal';
import { useAuth } from '@/components/auth-provider';
import { api, ApiError } from '@/lib/api';
import { formatDate, toAbsoluteAssetUrl } from '@/lib/format';
import type { MemberAssetRecord, MemberDetail, MemberListItem, MemberTimelineEvent } from '@/lib/types';

const { Paragraph, Text, Title } = Typography;

type QuickRelativeType = 'father' | 'mother' | 'spouse' | 'child' | 'sibling';

const memberEventTypeLabelMap: Record<MemberTimelineEvent['eventType'], string> = {
  BIRTH: '出生',
  MARRIAGE: '结婚',
  DIVORCE: '离婚',
  DEATH: '去世',
  MOVE: '迁居',
  CAREER: '事业',
  HONOR: '荣誉',
  STORY: '故事',
  OTHER: '其他',
};

type MemberFormValue = Partial<MemberListItem> & {
  father?: { id: string; name: string; gender?: 'MALE' | 'FEMALE' | 'UNKNOWN' } | null;
  mother?: { id: string; name: string; gender?: 'MALE' | 'FEMALE' | 'UNKNOWN' } | null;
};

type QuickRelativeConfig = {
  relationType: QuickRelativeType;
  title: string;
  hint: string;
  initialValue?: MemberFormValue;
  disabledFields?: Partial<Record<'gender' | 'fatherId' | 'motherId', boolean>>;
  hiddenFields?: Partial<Record<'gender' | 'fatherId' | 'motherId', boolean>>;
  existingMemberNameMatch?: {
    gender?: MemberListItem['gender'];
    relationLabel: string;
  };
};

export default function MemberDetailPage() {
  const { message } = App.useApp();
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const memberId = Array.isArray(params.id) ? params.id[0] : params.id;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { isAdmin } = useAuth();
  const { isMobile } = useViewportMode();
  const [editOpen, setEditOpen] = useState(false);
  const [marriageOpen, setMarriageOpen] = useState(false);
  const [supplementOpen, setSupplementOpen] = useState(false);
  const [assetSupplementType, setAssetSupplementType] = useState<'PHOTO' | 'DOCUMENT' | null>(null);
  const [assetModalType, setAssetModalType] = useState<'PHOTO' | 'DOCUMENT' | null>(null);
  const [editingAsset, setEditingAsset] = useState<MemberAssetRecord | null>(null);
  const [assetKeyword, setAssetKeyword] = useState('');
  const [assetTag, setAssetTag] = useState<string | undefined>();
  const [eventOpen, setEventOpen] = useState(false);
  const [quickRelativeConfig, setQuickRelativeConfig] = useState<QuickRelativeConfig | null>(null);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') ?? 'overview');
  const [editingMarriage, setEditingMarriage] = useState<{
    id: string;
    spouseName: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
  } | null>(null);
  const deferredAssetKeyword = useDeferredValue(assetKeyword.trim());

  const memberQuery = useQuery({
    queryKey: ['member', memberId],
    queryFn: () => api.getMember(memberId),
  });

  const member = memberQuery.data;
  const isMemberPending = memberQuery.isLoading && !member;

  useEffect(() => {
    const nextTab = searchParams.get('tab');
    if (nextTab && nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [activeTab, searchParams]);

  const updateTab = (nextTab: string) => {
    setActiveTab(nextTab);
    const nextParams = new URLSearchParams(searchParams.toString());
    if (nextTab === 'overview') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', nextTab);
    }
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  };
  const allAssetsQuery = useQuery({
    queryKey: ['member-assets', memberId, 'all'],
    queryFn: () => api.getMemberAssets(memberId),
  });
  const filteredAssetsQuery = useQuery({
    queryKey: ['member-assets', memberId, 'filtered', deferredAssetKeyword, assetTag],
    queryFn: () =>
      api.getMemberAssets(memberId, {
        keyword: deferredAssetKeyword || undefined,
        tag: assetTag,
      }),
  });
  const matchedAssets = filteredAssetsQuery.data ?? [];
  const photoAssets = matchedAssets.filter((asset) => asset.category === 'PHOTO');
  const documentAssets = matchedAssets.filter((asset) => asset.category === 'DOCUMENT');
  const totalAssetCount = allAssetsQuery.data?.length ?? 0;
  const matchedAssetCount = matchedAssets.length;
  const totalPhotoCount = (allAssetsQuery.data ?? []).filter((asset) => asset.category === 'PHOTO').length;
  const totalDocumentCount = (allAssetsQuery.data ?? []).filter((asset) => asset.category === 'DOCUMENT').length;
  const parentRelations = member
    ? [
        member.father
          ? {
              key: 'father',
              label: '父亲' as const,
              person: member.father,
            }
          : null,
        member.mother
          ? {
              key: 'mother',
              label: '母亲' as const,
              person: member.mother,
            }
          : null,
      ].filter(
        (
          item,
        ): item is {
          key: string;
          label: '父亲' | '母亲';
          person: NonNullable<MemberDetail['father']>;
        } => Boolean(item),
      )
    : [];
  const assetTagOptions = Array.from(
    new Set((allAssetsQuery.data ?? []).flatMap((asset) => asset.tags)),
  ).map((tag) => ({
    label: tag,
    value: tag,
  }));
  const activeSpouses =
    member?.marriages.filter((marriage) => marriage.status === 'ACTIVE').map((marriage) => marriage.spouse) ??
    [];
  const onlyActiveSpouse = activeSpouses.length === 1 ? activeSpouses[0] : null;

  const saveMemberMutation = useMutation<unknown, Error, Record<string, unknown>>({
    mutationFn: (payload: Record<string, unknown>) =>
      isAdmin
        ? api.updateMember(memberId, payload)
        : api.createMemberUpdateRequest({ memberId, patch: payload }),
    onSuccess: async () => {
      message.success(isAdmin ? '成员信息已更新' : '变更申请已提交，等待管理员审核');
      setEditOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['member', memberId] }),
        queryClient.invalidateQueries({ queryKey: ['members'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['supplement-requests'] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '更新失败');
    },
  });

  const quickRelativeMutation = useMutation<
    unknown,
    Error,
    {
      relationType: QuickRelativeType;
      existingMemberId?: string;
      member: Record<string, unknown>;
    }
  >({
    mutationFn: async (payload: {
      relationType: QuickRelativeType;
      existingMemberId?: string;
      member: Record<string, unknown>;
    }) =>
      isAdmin
        ? api.createQuickRelative(memberId, payload)
        : api.createQuickRelativeRequest({
            memberId,
            request: payload,
          }),
    onSuccess: async (_result, payload) => {
      const relationLabelMap: Record<QuickRelativeType, string> = {
        father: '父亲',
        mother: '母亲',
        spouse: '配偶',
        child: '子女',
        sibling: '兄弟姐妹',
      };

      message.success(
        isAdmin
          ? payload.existingMemberId
            ? `已绑定${relationLabelMap[payload.relationType]}`
            : `已快速新增${relationLabelMap[payload.relationType]}`
          : '变更申请已提交，等待管理员审核',
      );
      setQuickRelativeConfig(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['member', memberId] }),
        queryClient.invalidateQueries({ queryKey: ['members'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['supplement-requests'] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '快速建亲属失败');
    },
  });

  const marriageMutation = useMutation<unknown, Error, Record<string, unknown>>({
    mutationFn: (payload: Record<string, unknown>) => {
      if (!isAdmin) {
        return api.createMarriageChangeRequest({
          memberId,
          action: editingMarriage ? 'UPDATE' : 'CREATE',
          marriageId: editingMarriage?.id,
          [editingMarriage ? 'update' : 'create']: payload,
        });
      }

      if (editingMarriage) {
        return api.updateMarriage(memberId, editingMarriage.id, payload);
      }

      return api.createMarriage(memberId, payload);
    },
    onSuccess: async () => {
      message.success(
        isAdmin
          ? editingMarriage
            ? '婚姻关系已更新'
            : '婚姻关系已创建'
          : '变更申请已提交，等待管理员审核',
      );
      setMarriageOpen(false);
      setEditingMarriage(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['member', memberId] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['supplement-requests'] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '保存婚姻关系失败');
    },
  });

  const removeMarriageMutation = useMutation<unknown, Error, string>({
    mutationFn: (marriageId: string) =>
      isAdmin
        ? api.deleteMarriage(memberId, marriageId)
        : api.createMarriageChangeRequest({ memberId, action: 'DELETE', marriageId }),
    onSuccess: async () => {
      message.success(isAdmin ? '婚姻关系已删除' : '变更申请已提交，等待管理员审核');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['member', memberId] }),
        queryClient.invalidateQueries({ queryKey: ['supplement-requests'] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '删除婚姻关系失败');
    },
  });

  const uploadMutation = useMutation<unknown, Error, File>({
    mutationFn: (file: File) =>
      isAdmin ? api.uploadMemberPhoto(memberId, file) : api.createMemberPhotoRequest({ memberId, file }),
    onSuccess: async () => {
      message.success(isAdmin ? '头像上传成功' : '变更申请已提交，等待管理员审核');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['member', memberId] }),
        queryClient.invalidateQueries({ queryKey: ['supplement-requests'] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '头像上传失败');
    },
  });

  const uploadAssetMutation = useMutation<
    unknown,
    Error,
    {
      category: 'PHOTO' | 'DOCUMENT';
      files: File[];
      sourceType?: string;
      title?: string;
      source?: string;
      tags: string[];
      description?: string;
    }
  >({
    mutationFn: (payload: {
      category: 'PHOTO' | 'DOCUMENT';
      files: File[];
      sourceType?: string;
      title?: string;
      source?: string;
      tags: string[];
      description?: string;
    }) =>
      isAdmin
        ? api.uploadMemberAssets(memberId, payload.category, payload)
        : api.createSupplementAssetRequest(
            {
              memberId,
              category: payload.category,
              sourceType: payload.sourceType,
              title: payload.title,
              source: payload.source,
              tags: payload.tags,
              description: payload.description,
            },
            payload.files,
          ),
    onSuccess: async (_result, payload) => {
      message.success(
        isAdmin
          ? payload.category === 'PHOTO'
            ? '成员照片已上传'
            : '成员附件已上传'
          : '变更申请已提交，等待管理员审核',
      );
      setAssetModalType(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['member-assets', memberId] }),
        queryClient.invalidateQueries({ queryKey: ['member', memberId] }),
        queryClient.invalidateQueries({ queryKey: ['supplement-requests'] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '上传资料失败');
    },
  });

  const updateAssetMutation = useMutation<
    unknown,
    Error,
    {
      assetId: string;
      sourceType?: string;
      title?: string;
      source?: string;
      tags: string[];
      description?: string;
    }
  >({
    mutationFn: (payload: {
      assetId: string;
      sourceType?: string;
      title?: string;
      source?: string;
      tags: string[];
      description?: string;
    }) =>
      isAdmin
        ? api.updateMemberAsset(memberId, payload.assetId, {
            sourceType: payload.sourceType,
            title: payload.title,
            source: payload.source,
            tags: payload.tags,
            description: payload.description,
          })
        : api.createAssetMetadataChangeRequest({
            memberId,
            assetId: payload.assetId,
            action: 'UPDATE',
            patch: {
              sourceType: payload.sourceType,
              title: payload.title,
              source: payload.source,
              tags: payload.tags,
              description: payload.description,
            },
          }),
    onSuccess: async () => {
      message.success(isAdmin ? '资料信息已更新' : '变更申请已提交，等待管理员审核');
      setEditingAsset(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['member-assets', memberId] }),
        queryClient.invalidateQueries({ queryKey: ['supplement-requests'] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '更新资料信息失败');
    },
  });

  const eventMutation = useMutation<
    unknown,
    Error,
    {
      eventType: MemberTimelineEvent['eventType'];
      title: string;
      description?: string;
      eventDate: string;
    }
  >({
    mutationFn: (payload: {
      eventType: MemberTimelineEvent['eventType'];
      title: string;
      description?: string;
      eventDate: string;
    }) =>
      isAdmin
        ? api.createMemberEvent(memberId, payload)
        : api.createEventChangeRequest({ memberId, action: 'CREATE', event: payload }),
    onSuccess: async () => {
      message.success(isAdmin ? '成员事件已新增' : '变更申请已提交，等待管理员审核');
      setEventOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['member', memberId] }),
        queryClient.invalidateQueries({ queryKey: ['supplement-requests'] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '新增成员事件失败');
    },
  });

  const deleteEventMutation = useMutation<unknown, Error, string>({
    mutationFn: (eventId: string) =>
      isAdmin
        ? api.deleteMemberEvent(memberId, eventId)
        : api.createEventChangeRequest({ memberId, action: 'DELETE', eventId }),
    onSuccess: async () => {
      message.success(isAdmin ? '成员事件已删除' : '变更申请已提交，等待管理员审核');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['member', memberId] }),
        queryClient.invalidateQueries({ queryKey: ['supplement-requests'] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '删除成员事件失败');
    },
  });

  const deleteAssetMutation = useMutation<unknown, Error, MemberAssetRecord>({
    mutationFn: (asset: MemberAssetRecord) =>
      isAdmin
        ? api.deleteMemberAsset(memberId, asset.id)
        : api.createAssetMetadataChangeRequest({
            memberId,
            assetId: asset.id,
            action: 'DELETE',
          }),
    onSuccess: async () => {
      message.success(isAdmin ? '成员资料已删除' : '变更申请已提交，等待管理员审核');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['member-assets', memberId] }),
        queryClient.invalidateQueries({ queryKey: ['supplement-requests'] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '删除资料失败');
    },
  });

  const supplementMutation = useMutation({
    mutationFn: (payload: { patch: Record<string, unknown>; reason?: string }) =>
      api.createSupplementRequest({
        memberId,
        patch: payload.patch,
        reason: payload.reason,
      }),
    onSuccess: async () => {
      message.success('补充申请已提交，等待管理员审核');
      setSupplementOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['supplement-requests'] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '提交补充申请失败');
    },
  });

  const supplementAssetMutation = useMutation({
    mutationFn: (payload: {
      category: 'PHOTO' | 'DOCUMENT';
      reason?: string;
      sourceType?: string;
      title?: string;
      source?: string;
      tags: string[];
      description?: string;
      files: File[];
    }) =>
      api.createSupplementAssetRequest(
        {
          memberId,
          category: payload.category,
          reason: payload.reason,
          sourceType: payload.sourceType,
          title: payload.title,
          source: payload.source,
          tags: payload.tags,
          description: payload.description,
        },
        payload.files,
      ),
    onSuccess: async (_result, payload) => {
      message.success(
        payload.category === 'PHOTO'
          ? '照片补充申请已提交，等待管理员审核'
          : '附件补充申请已提交，等待管理员审核',
      );
      setAssetSupplementType(null);
      await queryClient.invalidateQueries({ queryKey: ['supplement-requests'] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '提交资源补充申请失败');
    },
  });

  const openQuickRelativeModal = (relationType: QuickRelativeType) => {
    if (!member) {
      return;
    }

    const baseLifeStatus: MemberListItem['lifeStatus'] = 'ALIVE';

    if (relationType === 'father') {
      setQuickRelativeConfig({
        relationType,
        title: `快速新增父亲：${member.name}`,
        hint: '创建完成后，新成员会自动绑定为当前成员的父亲。',
        initialValue: {
          gender: 'MALE',
          lifeStatus: baseLifeStatus,
        },
        disabledFields: {
          gender: true,
        },
        hiddenFields: {
          fatherId: true,
          motherId: true,
        },
        existingMemberNameMatch: {
          gender: 'MALE',
          relationLabel: '父亲',
        },
      });
      return;
    }

    if (relationType === 'mother') {
      setQuickRelativeConfig({
        relationType,
        title: `快速新增母亲：${member.name}`,
        hint: '创建完成后，新成员会自动绑定为当前成员的母亲。',
        initialValue: {
          gender: 'FEMALE',
          lifeStatus: baseLifeStatus,
        },
        disabledFields: {
          gender: true,
        },
        hiddenFields: {
          fatherId: true,
          motherId: true,
        },
        existingMemberNameMatch: {
          gender: 'FEMALE',
          relationLabel: '母亲',
        },
      });
      return;
    }

    if (relationType === 'spouse') {
      setQuickRelativeConfig({
        relationType,
        title: `快速新增配偶：${member.name}`,
        hint: '创建完成后，将自动与当前成员建立婚姻关系。',
        initialValue: {
          gender:
            member.gender === 'MALE'
              ? 'FEMALE'
              : member.gender === 'FEMALE'
                ? 'MALE'
                : 'UNKNOWN',
          lifeStatus: baseLifeStatus,
        },
      });
      return;
    }

    if (relationType === 'child') {
      if (member.gender === 'UNKNOWN') {
        message.warning('当前成员性别未知，暂无法快速新增子女。');
        return;
      }

      const father =
        member.gender === 'MALE'
          ? { id: member.id, name: member.name, gender: member.gender }
          : onlyActiveSpouse
            ? {
                id: onlyActiveSpouse.id,
                name: onlyActiveSpouse.name,
                gender: onlyActiveSpouse.gender,
              }
            : null;
      const mother =
        member.gender === 'FEMALE'
          ? { id: member.id, name: member.name, gender: member.gender }
          : onlyActiveSpouse
            ? {
                id: onlyActiveSpouse.id,
                name: onlyActiveSpouse.name,
                gender: onlyActiveSpouse.gender,
              }
            : null;

      setQuickRelativeConfig({
        relationType,
        title: `快速新增子女：${member.name}`,
        hint:
          onlyActiveSpouse
            ? '系统会自动带入当前成员和唯一在册配偶作为子女父母。'
            : '系统会自动带入当前成员作为子女父或母，另一位家长可手动补录。',
        initialValue: {
          lifeStatus: baseLifeStatus,
          fatherId: father?.id,
          motherId: mother?.id,
          father,
          mother,
        },
        disabledFields: {
          fatherId: Boolean(father),
          motherId: Boolean(mother),
        },
        existingMemberNameMatch: {
          relationLabel: '子女',
        },
      });
      return;
    }

    if (relationType === 'sibling') {
      if (!member.father && !member.mother) {
        message.warning('当前成员尚未录入父母信息，暂无法快速新增兄弟姐妹。');
        return;
      }

      setQuickRelativeConfig({
        relationType,
        title: `快速新增兄弟姐妹：${member.name}`,
        hint: '系统会自动继承当前成员已知的父母关系。',
        initialValue: {
          lifeStatus: baseLifeStatus,
          fatherId: member.father?.id,
          motherId: member.mother?.id,
          father: member.father
            ? { id: member.father.id, name: member.father.name, gender: member.father.gender }
            : null,
          mother: member.mother
            ? { id: member.mother.id, name: member.mother.name, gender: member.mother.gender }
            : null,
        },
        disabledFields: {
          fatherId: Boolean(member.father),
          motherId: Boolean(member.mother),
        },
      });
    }
  };

  const renderAssetTags = (asset: MemberAssetRecord) =>
    asset.tags.length > 0 ? (
      <Space wrap size={[6, 6]}>
        {asset.tags.map((tag) => (
          <Tag
            key={`${asset.id}-${tag}`}
            color={assetTag === tag ? 'processing' : 'default'}
            style={{ cursor: 'pointer', marginInlineEnd: 0 }}
            onClick={() => setAssetTag(assetTag === tag ? undefined : tag)}
          >
            {tag}
          </Tag>
        ))}
      </Space>
    ) : null;

  const relationActionItems = [
    { key: 'father', label: '快速新增父亲', onClick: () => openQuickRelativeModal('father') },
    { key: 'mother', label: '快速新增母亲', onClick: () => openQuickRelativeModal('mother') },
    { key: 'child', label: '快速新增子女', onClick: () => openQuickRelativeModal('child') },
    { key: 'sibling', label: '快速新增兄弟姐妹', onClick: () => openQuickRelativeModal('sibling') },
    { key: 'spouse', label: '快速新增配偶', onClick: () => openQuickRelativeModal('spouse') },
    {
      key: 'marriage',
      label: '绑定现有配偶',
      onClick: () => {
        setEditingMarriage(null);
        setMarriageOpen(true);
      },
    },
  ];

  const adminHeaderActionItems = [
    {
      key: 'upload-avatar',
      label: '上传头像',
      onClick: () => fileInputRef.current?.click(),
    },
    {
      key: 'upload-photo',
      label: '上传照片',
      onClick: () => setAssetModalType('PHOTO'),
    },
    {
      key: 'upload-document',
      label: '上传附件',
      onClick: () => setAssetModalType('DOCUMENT'),
    },
  ];

  return (
    <AuthGuard>
      <div className="page-stack">
        <Card className="soft-panel">
          <div className="page-hero">
            <div className="page-hero-copy">
              <Space align="start" size={16} wrap>
                <Button icon={<ArrowLeftOutlined />}>
                  <Link href="/members">返回成员列表</Link>
                </Button>
                {isMemberPending ? (
                  <div className="member-hero-loading">
                    <Skeleton.Avatar active size={96} shape="square" />
                    <div className="member-hero-loading-copy">
                      <div className="page-eyebrow">Member Profile</div>
                      <Skeleton.Input active size="large" className="member-hero-loading-title" />
                      <Skeleton.Input active size="small" className="member-hero-loading-desc" />
                    </div>
                  </div>
                ) : (
                  <Space align="start" size={16}>
                    {member?.photoUrl ? (
                      <Image
                        src={toAbsoluteAssetUrl(member.photoUrl) ?? ''}
                        alt={member.name}
                        width={96}
                        height={96}
                        style={{ borderRadius: 12, objectFit: 'cover' }}
                      />
                    ) : (
                      <Avatar size={96}>{member?.name?.slice(0, 1)}</Avatar>
                    )}
                    <div>
                      <div className="page-eyebrow">Member Profile</div>
                      <Title level={3} className="page-hero-title">
                        {member?.name ?? '成员详情'}
                      </Title>
                      <Paragraph className="page-hero-desc">
                        {member?.gender === 'MALE' ? '男' : member?.gender === 'FEMALE' ? '女' : '未知'} ·{' '}
                        {member?.generationName ? `字辈 ${member.generationName} · ` : ''}
                        {member?.nativePlace ?? '籍贯（待补充）'}
                      </Paragraph>
                      {member ? (
                        <div className="member-overview-pills">
                          <button
                            type="button"
                            className="member-overview-pill"
                            onClick={() => updateTab('relations')}
                          >
                            子女 {member.children.length}
                          </button>
                          <button
                            type="button"
                            className="member-overview-pill"
                            onClick={() => updateTab('relations')}
                          >
                            兄弟姐妹 {member.siblings.length}
                          </button>
                          <button
                            type="button"
                            className="member-overview-pill"
                            onClick={() => updateTab('relations')}
                          >
                            婚姻 {member.marriages.length}
                          </button>
                          <button
                            type="button"
                            className="member-overview-pill"
                            onClick={() => updateTab('assets')}
                          >
                            资料 {totalAssetCount}
                          </button>
                          <button
                            type="button"
                            className="member-overview-pill"
                            onClick={() => updateTab('assets')}
                          >
                            照片 {totalPhotoCount}
                          </button>
                          <button
                            type="button"
                            className="member-overview-pill"
                            onClick={() => updateTab('assets')}
                          >
                            附件 {totalDocumentCount}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </Space>
                )}
              </Space>
            </div>
            <div className="page-hero-actions">
              <input
                ref={fileInputRef}
                hidden
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    uploadMutation.mutate(file);
                  }
                }}
              />
              {member ? (
                <>
                  <Dropdown menu={{ items: adminHeaderActionItems }}>
                    <Button loading={uploadMutation.isPending} disabled={isMemberPending}>
                      更多操作
                    </Button>
                  </Dropdown>
                  <Button
                    type="primary"
                    icon={<EditOutlined />}
                    disabled={isMemberPending}
                    onClick={() => setEditOpen(true)}
                  >
                    {isMobile ? (isAdmin ? '编辑' : '提交') : isAdmin ? '编辑档案' : '提交编辑'}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </Card>
        <Tabs
          activeKey={activeTab}
          onChange={updateTab}
          className="member-detail-tabs"
          items={[
            {
              key: 'overview',
              label: '概览',
              children: (
                <div className="section-stack">
                  <Card loading={memberQuery.isLoading} className="soft-panel" title="基础信息">
                    {isMemberPending ? (
                      <Skeleton active paragraph={{ rows: 4 }} />
                    ) : member ? (
                      <Descriptions column={{ xs: 1, md: 2, xl: 3 }}>
                        <Descriptions.Item label="出生日期">
                          {formatDate(member.birthDate)}
                        </Descriptions.Item>
                        {member.lifeStatus === 'ALIVE' ? null : (
                          <Descriptions.Item label="去世日期">
                            {formatDate(member.deathDate)}
                          </Descriptions.Item>
                        )}
                        <Descriptions.Item label="生命状态">
                          {member.lifeStatus === 'ALIVE'
                            ? '在世'
                            : member.lifeStatus === 'DECEASED'
                              ? '已故'
                              : '未知'}
                        </Descriptions.Item>
                        <Descriptions.Item label="父亲">{member.father?.name ?? '-'}</Descriptions.Item>
                        <Descriptions.Item label="母亲">{member.mother?.name ?? '-'}</Descriptions.Item>
                        <Descriptions.Item label="排行">{member.birthOrder ?? '-'}</Descriptions.Item>
                        <Descriptions.Item label="籍贯">{member.nativePlace ?? '-'}</Descriptions.Item>
                        <Descriptions.Item label="创建时间">
                          {formatDate(member.createdAt, 'YYYY-MM-DD HH:mm')}
                        </Descriptions.Item>
                        <Descriptions.Item label="更新时间">
                          {formatDate(member.updatedAt, 'YYYY-MM-DD HH:mm')}
                        </Descriptions.Item>
                        <Descriptions.Item label="备注" span="filled">
                          {member.notes ?? '暂无备注'}
                        </Descriptions.Item>
                      </Descriptions>
                    ) : null}
                  </Card>
                </div>
              ),
            },
            {
              key: 'relations',
              label: '关系',
              children: (
                <div className="section-stack">
                  <Card className="soft-panel">
                    <div className="page-hero">
                      <div className="page-hero-copy">
                        <Title level={5} className="page-hero-title">
                          家庭关系维护
                        </Title>
                        <Paragraph className="page-hero-desc">
                          把父母、子女、兄弟姐妹和婚姻关系集中维护；快速新增与现有配偶绑定统一从“添加关系”进入。
                        </Paragraph>
                      </div>
                      {member ? (
                        <div className="page-hero-actions">
                          <Dropdown menu={{ items: relationActionItems }}>
                            <Button type="primary" icon={<PlusOutlined />}>
                              添加关系
                            </Button>
                          </Dropdown>
                        </div>
                      ) : null}
                    </div>
                  </Card>

                  <Card className="soft-panel" title="直系与同辈关系">
                    <Space direction="vertical" size={20} style={{ width: '100%' }}>
                      <div>
                        <Text strong>父母</Text>
                        {parentRelations.length > 0 ? (
                          <div className="member-parent-grid" style={{ marginTop: 12 }}>
                            {parentRelations.map((item) => (
                              <div key={item.key} className="member-parent-card">
                                <Tag color={item.label === '父亲' ? 'blue' : 'magenta'}>
                                  {item.label}
                                </Tag>
                                <Link href={`/members/${item.person.id}`}>{item.person.name}</Link>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ marginTop: 12 }}>
                            <Text type="secondary">暂无父母关系数据</Text>
                          </div>
                        )}
                      </div>
                      <Divider style={{ margin: 0 }} />
                      <div>
                        <Text strong>子女</Text>
                        <List
                          style={{ marginTop: 12 }}
                          dataSource={member?.children ?? []}
                          locale={{ emptyText: '暂无子女成员' }}
                          renderItem={(item) => (
                            <List.Item>
                              <Space>
                                <Link href={`/members/${item.id}`}>{item.name}</Link>
                                <Tag>
                                  {item.gender === 'MALE'
                                    ? '男'
                                    : item.gender === 'FEMALE'
                                      ? '女'
                                      : '未知'}
                                </Tag>
                                <Text type="secondary">{formatDate(item.birthDate)}</Text>
                              </Space>
                            </List.Item>
                          )}
                        />
                      </div>
                      <Divider style={{ margin: 0 }} />
                      <div>
                        <Text strong>兄弟姐妹</Text>
                        <List
                          style={{ marginTop: 12 }}
                          dataSource={member?.siblings ?? []}
                          locale={{ emptyText: '暂无兄弟姐妹成员' }}
                          renderItem={(item) => (
                            <List.Item>
                              <Space>
                                <Link href={`/members/${item.id}`}>{item.name}</Link>
                                <Tag>
                                  {item.gender === 'MALE'
                                    ? '男'
                                    : item.gender === 'FEMALE'
                                      ? '女'
                                      : '未知'}
                                </Tag>
                                <Text type="secondary">
                                  {item.birthOrder
                                    ? `排行 ${item.birthOrder}`
                                    : formatDate(item.birthDate)}
                                </Text>
                              </Space>
                            </List.Item>
                          )}
                        />
                      </div>
                    </Space>
                  </Card>

                  <Card className="soft-panel" title="婚姻关系">
                    <Table
                      rowKey="id"
                      pagination={false}
                      dataSource={member?.marriages ?? []}
                      columns={[
                        {
                          title: '配偶',
                          dataIndex: ['spouse', 'name'],
                          render: (_: string, record) => (
                            <Link href={`/members/${record.spouse.id}`}>{record.spouse.name}</Link>
                          ),
                        },
                        {
                          title: '状态',
                          dataIndex: 'status',
                          render: (value: string) =>
                            value === 'ACTIVE' ? '婚姻存续' : value === 'DIVORCED' ? '离异' : '丧偶',
                        },
                        {
                          title: '开始日期',
                          dataIndex: 'startDate',
                          render: (value: string | null) => formatDate(value),
                        },
                        {
                          title: '结束日期',
                          dataIndex: 'endDate',
                          render: (value: string | null) => formatDate(value),
                        },
                        {
                          title: '操作',
                          render: (_: unknown, record) =>
                            member ? (
                              <Space>
                                <Button
                                  size="small"
                                  onClick={() => {
                                    setEditingMarriage({
                                      id: record.id,
                                      spouseName: record.spouse.name,
                                      status: record.status,
                                      startDate: record.startDate,
                                      endDate: record.endDate,
                                    });
                                    setMarriageOpen(true);
                                  }}
                                >
                                  {isAdmin ? '编辑' : '提交编辑'}
                                </Button>
                                <Popconfirm
                                  title={
                                    isAdmin
                                      ? '确定删除这条婚姻关系吗？'
                                      : '确定提交删除这条婚姻关系的审核申请吗？'
                                  }
                                  onConfirm={() => removeMarriageMutation.mutate(record.id)}
                                >
                                  <Button size="small" danger>
                                    {isAdmin ? '删除' : '提交删除'}
                                  </Button>
                                </Popconfirm>
                              </Space>
                            ) : null,
                        },
                      ]}
                    />
                  </Card>
                </div>
              ),
            },
            {
              key: 'assets',
              label: '资料',
              children: (
                <div className="section-stack">
                  <Card className="soft-panel" loading={allAssetsQuery.isLoading}>
                    <div className="member-asset-toolbar">
                      <div>
                        <Title level={5} style={{ margin: 0 }}>
                          资料检索
                        </Title>
                        <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                          已沉淀 {totalAssetCount} 项资料，当前匹配 {matchedAssetCount} 项，可按标题、来源、描述或标签检索。
                        </Paragraph>
                      </div>
                      <Space wrap className="member-asset-toolbar-actions">
                        <Input
                          allowClear
                          value={assetKeyword}
                          prefix={<SearchOutlined />}
                          placeholder="搜索资料标题、原文件名、来源或描述"
                          style={{ width: isMobile ? '100%' : 280 }}
                          onChange={(event) => setAssetKeyword(event.target.value)}
                        />
                        <Select
                          allowClear
                          value={assetTag}
                          placeholder="按标签筛选"
                          style={{ width: isMobile ? '100%' : 220 }}
                          options={assetTagOptions}
                          suffixIcon={<FilterOutlined />}
                          onChange={(value) => setAssetTag(value)}
                        />
                      </Space>
                    </div>
                    {assetTagOptions.length > 0 ? (
                      <Space wrap size={[8, 8]} style={{ marginTop: 12 }}>
                        {assetTagOptions.slice(0, 16).map((option) => (
                          <Tag
                            key={option.value}
                            color={assetTag === option.value ? 'processing' : 'default'}
                            style={{ cursor: 'pointer', marginInlineEnd: 0 }}
                            onClick={() =>
                              setAssetTag(assetTag === option.value ? undefined : option.value)
                            }
                          >
                            {option.label}
                          </Tag>
                        ))}
                      </Space>
                    ) : null}
                  </Card>

                  <Card className="soft-panel" title="家族相册">
                    {photoAssets.length > 0 ? (
                      <div className="member-photo-grid">
                        {photoAssets.map((asset) => (
                          <div key={asset.id} className="member-photo-card">
                            <Image
                              src={toAbsoluteAssetUrl(asset.fileUrl) ?? ''}
                              alt={asset.originalName}
                              width={180}
                              height={180}
                              style={{ objectFit: 'cover', borderRadius: 12 }}
                            />
                            <div className="member-asset-body">
                              <Text strong ellipsis>
                                {asset.title || asset.originalName}
                              </Text>
                              {asset.title ? (
                                <Text type="secondary" className="member-asset-subtitle">
                                  原文件：{asset.originalName}
                                </Text>
                              ) : null}
                              {asset.source ? (
                                <Text type="secondary" className="member-asset-subtitle">
                                  来源：
                                  {[asset.sourceType, asset.source].filter(Boolean).join(' · ')}
                                </Text>
                              ) : asset.sourceType ? (
                                <Text type="secondary" className="member-asset-subtitle">
                                  来源：{asset.sourceType}
                                </Text>
                              ) : null}
                              {asset.description ? (
                                <Paragraph className="member-asset-description">
                                  {asset.description}
                                </Paragraph>
                              ) : null}
                              {renderAssetTags(asset)}
                              <Text type="secondary" className="member-asset-subtitle">
                                上传于 {formatDate(asset.createdAt, 'YYYY-MM-DD HH:mm')}
                              </Text>
                            </div>
                            <div className="member-asset-footer">
                              <Text type="secondary">
                                {Math.max(1, Math.round(asset.sizeBytes / 1024))} KB
                              </Text>
                              <Space size={8}>
                                {member ? (
                                  <Button
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => setEditingAsset(asset)}
                                  >
                                    编辑
                                  </Button>
                                ) : null}
                                {member ? (
                                  <Popconfirm
                                    title="确定删除这张照片吗？"
                                    onConfirm={() => deleteAssetMutation.mutate(asset)}
                                  >
                                    <Button size="small" icon={<DeleteOutlined />} danger />
                                  </Popconfirm>
                                ) : null}
                              </Space>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Text type="secondary">
                        {deferredAssetKeyword || assetTag ? '当前筛选下暂无成员照片。' : '暂无成员照片。'}
                      </Text>
                    )}
                  </Card>

                  <Card className="soft-panel" title="资料附件">
                    <List
                      dataSource={documentAssets}
                      loading={filteredAssetsQuery.isLoading || filteredAssetsQuery.isFetching}
                      locale={{
                        emptyText:
                          deferredAssetKeyword || assetTag ? '当前筛选下暂无资料附件。' : '暂无资料附件。',
                      }}
                      renderItem={(asset) => (
                        <List.Item
                          actions={
                            member
                              ? [
                                  <Button
                                    key="edit"
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => setEditingAsset(asset)}
                                  >
                                    编辑
                                  </Button>,
                                  <Popconfirm
                                    key="delete"
                                    title="确定删除这个附件吗？"
                                    onConfirm={() => deleteAssetMutation.mutate(asset)}
                                  >
                                    <Button size="small" icon={<DeleteOutlined />} danger />
                                  </Popconfirm>,
                                ]
                              : undefined
                          }
                        >
                          <List.Item.Meta
                            avatar={
                              asset.mimeType === 'application/pdf' ? (
                                <FileTextOutlined style={{ fontSize: 20, color: '#b42318' }} />
                              ) : asset.mimeType.includes('zip') ? (
                                <FileZipOutlined style={{ fontSize: 20, color: '#7c3aed' }} />
                              ) : (
                                <PaperClipOutlined style={{ fontSize: 20, color: '#8a704f' }} />
                              )
                            }
                            title={
                              <a
                                href={toAbsoluteAssetUrl(asset.fileUrl) ?? '#'}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {asset.title || asset.originalName}
                              </a>
                            }
                            description={
                              <div className="member-asset-list-desc">
                                {asset.title ? (
                                  <Text type="secondary" className="member-asset-subtitle">
                                    原文件：{asset.originalName}
                                  </Text>
                                ) : null}
                                {asset.source ? (
                                  <Text type="secondary" className="member-asset-subtitle">
                                    来源：
                                    {[asset.sourceType, asset.source]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </Text>
                                ) : asset.sourceType ? (
                                  <Text type="secondary" className="member-asset-subtitle">
                                    来源：{asset.sourceType}
                                  </Text>
                                ) : null}
                                {asset.description ? (
                                  <Paragraph className="member-asset-description">
                                    {asset.description}
                                  </Paragraph>
                                ) : null}
                                {renderAssetTags(asset)}
                                <Text type="secondary" className="member-asset-subtitle">
                                  {Math.max(1, Math.round(asset.sizeBytes / 1024))} KB · 上传于{' '}
                                  {formatDate(asset.createdAt, 'YYYY-MM-DD HH:mm')}
                                </Text>
                              </div>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                </div>
              ),
            },
            {
              key: 'timeline',
              label: '时间线',
              children: (
                <div className="section-stack">
                  <Card
                    className="soft-panel"
                    title="成员时间线"
                    extra={
                      member ? (
                        <Button icon={<CalendarOutlined />} onClick={() => setEventOpen(true)}>
                          {isAdmin ? '新增事件' : '提交事件'}
                        </Button>
                      ) : null
                    }
                  >
                    {member?.timeline && member.timeline.length > 0 ? (
                      <Timeline
                        items={member.timeline.map((event) => ({
                          color:
                            event.source === 'system'
                              ? '#8a704f'
                              : event.eventType === 'HONOR'
                                ? '#b45309'
                                : event.eventType === 'MOVE'
                                  ? '#2563eb'
                                  : '#7b1f1f',
                          children: (
                            <div className="member-event-item">
                              <div className="member-event-header">
                                <Space wrap>
                                  <Text strong>{event.title}</Text>
                                  <Tag color={event.source === 'system' ? 'default' : 'processing'}>
                                    {event.source === 'system' ? '系统事件' : '自定义事件'}
                                  </Tag>
                                  <Tag>{memberEventTypeLabelMap[event.eventType] ?? event.eventType}</Tag>
                                </Space>
                                <Text type="secondary">{formatDate(event.eventDate)}</Text>
                              </div>
                              {event.description ? (
                                <Paragraph className="member-event-desc">{event.description}</Paragraph>
                              ) : null}
                              {event.source === 'custom' && member ? (
                                <Popconfirm
                                  title="确定删除这条自定义事件吗？"
                                  onConfirm={() => deleteEventMutation.mutate(event.id)}
                                >
                                  <Button size="small" danger icon={<DeleteOutlined />}>
                                    删除事件
                                  </Button>
                                </Popconfirm>
                              ) : null}
                            </div>
                          ),
                        }))}
                      />
                    ) : (
                      <Text type="secondary">暂无成员时间线事件。</Text>
                    )}
                  </Card>
                </div>
              ),
            },
          ]}
        />

        <MemberFormModal
          open={editOpen}
          title={`${isAdmin ? '编辑成员' : '提交成员编辑'}：${member?.name ?? ''}`}
          initialValue={member}
          loading={saveMemberMutation.isPending}
          onCancel={() => setEditOpen(false)}
          onSubmit={async (values) => {
            await saveMemberMutation.mutateAsync(values);
          }}
        />

        <MemberFormModal
          open={Boolean(quickRelativeConfig)}
          title={quickRelativeConfig?.title ?? '快速新增亲属'}
          hint={quickRelativeConfig?.hint}
          initialValue={quickRelativeConfig?.initialValue}
          disabledFields={quickRelativeConfig?.disabledFields}
          hiddenFields={quickRelativeConfig?.hiddenFields}
          existingMemberNameMatch={
            quickRelativeConfig?.existingMemberNameMatch
              ? {
                  ...quickRelativeConfig.existingMemberNameMatch,
                  enabled: true,
                  disabledIds: [memberId],
                }
              : undefined
          }
          loading={quickRelativeMutation.isPending}
          onCancel={() => setQuickRelativeConfig(null)}
          onSubmit={async (values) => {
            if (!quickRelativeConfig) {
              return;
            }

            await quickRelativeMutation.mutateAsync({
              relationType: quickRelativeConfig.relationType,
              existingMemberId:
                typeof values.existingMemberId === 'string' ? values.existingMemberId : undefined,
              member: values,
            });
          }}
        />

        <MarriageFormModal
          open={marriageOpen}
          title={
            editingMarriage
              ? `${isAdmin ? '编辑婚姻关系' : '提交婚姻关系编辑'}：${editingMarriage.spouseName}`
              : isAdmin
                ? '新增婚姻关系'
                : '提交新增婚姻关系'
          }
          spouseName={editingMarriage?.spouseName}
          canSelectSpouse={!editingMarriage}
          disabledIds={member ? [member.id] : []}
          seedOptions={[]}
          initialValue={
            editingMarriage
              ? {
                  status: editingMarriage.status,
                  startDate: editingMarriage.startDate,
                  endDate: editingMarriage.endDate,
                }
              : { status: 'ACTIVE' }
          }
          loading={marriageMutation.isPending}
          onCancel={() => {
            setMarriageOpen(false);
            setEditingMarriage(null);
          }}
          onSubmit={async (values) => {
            await marriageMutation.mutateAsync(values);
          }}
        />

        <MemberAssetModal
          open={Boolean(assetModalType) || Boolean(editingAsset)}
          mode={editingAsset ? 'edit' : 'upload'}
          category={editingAsset?.category ?? assetModalType ?? 'PHOTO'}
          memberName={member?.name}
          initialValue={editingAsset}
          loading={uploadAssetMutation.isPending || updateAssetMutation.isPending}
          onCancel={() => {
            setAssetModalType(null);
            setEditingAsset(null);
          }}
          onSubmit={async (values) => {
            if (editingAsset) {
            await updateAssetMutation.mutateAsync({
              assetId: editingAsset.id,
              sourceType: values.sourceType,
              title: values.title,
              source: values.source,
              tags: values.tags,
                description: values.description,
              });
              return;
            }

            if (!assetModalType || !values.files) {
              return;
            }

            await uploadAssetMutation.mutateAsync({
              category: assetModalType,
              files: values.files,
              sourceType: values.sourceType,
              title: values.title,
              source: values.source,
              tags: values.tags,
              description: values.description,
            });
          }}
        />

        <SupplementRequestModal
          open={supplementOpen}
          member={member as MemberDetail | undefined}
          loading={supplementMutation.isPending}
          onCancel={() => setSupplementOpen(false)}
          onSubmit={async (values) => {
            await supplementMutation.mutateAsync(values);
          }}
        />

        <SupplementAssetRequestModal
          open={Boolean(assetSupplementType)}
          category={assetSupplementType ?? 'PHOTO'}
          memberName={member?.name}
          loading={supplementAssetMutation.isPending}
          onCancel={() => setAssetSupplementType(null)}
          onSubmit={async (values) => {
            if (!assetSupplementType) {
              return;
            }

            await supplementAssetMutation.mutateAsync({
              category: assetSupplementType,
              ...values,
            });
          }}
        />

        <MemberEventModal
          open={eventOpen}
          memberName={member?.name}
          loading={eventMutation.isPending}
          onCancel={() => setEventOpen(false)}
          onSubmit={async (values) => {
            await eventMutation.mutateAsync(values);
          }}
        />
      </div>
    </AuthGuard>
  );
}
