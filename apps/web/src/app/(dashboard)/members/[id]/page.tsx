'use client';

import { ArrowLeftOutlined, EditOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Avatar,
  Button,
  Card,
  Descriptions,
  Divider,
  Image,
  List,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { MarriageFormModal } from '@/components/marriage-form-modal';
import { MemberFormModal } from '@/components/member-form-modal';
import { useAuth } from '@/components/auth-provider';
import { api, ApiError } from '@/lib/api';
import { formatDate, toAbsoluteAssetUrl } from '@/lib/format';

const { Paragraph, Text, Title } = Typography;

export default function MemberDetailPage() {
  const { message } = App.useApp();
  const params = useParams<{ id: string }>();
  const memberId = Array.isArray(params.id) ? params.id[0] : params.id;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { isAdmin } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [marriageOpen, setMarriageOpen] = useState(false);
  const [editingMarriage, setEditingMarriage] = useState<{
    id: string;
    spouseName: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
  } | null>(null);

  const memberQuery = useQuery({
    queryKey: ['member', memberId],
    queryFn: () => api.getMember(memberId),
  });

  const member = memberQuery.data;

  const saveMemberMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.updateMember(memberId, payload),
    onSuccess: async () => {
      message.success('成员信息已更新');
      setEditOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['member', memberId] }),
        queryClient.invalidateQueries({ queryKey: ['members'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '更新失败');
    },
  });

  const marriageMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => {
      if (editingMarriage) {
        return api.updateMarriage(memberId, editingMarriage.id, payload);
      }

      return api.createMarriage(memberId, payload);
    },
    onSuccess: async () => {
      message.success(editingMarriage ? '婚姻关系已更新' : '婚姻关系已创建');
      setMarriageOpen(false);
      setEditingMarriage(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['member', memberId] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '保存婚姻关系失败');
    },
  });

  const removeMarriageMutation = useMutation({
    mutationFn: (marriageId: string) => api.deleteMarriage(memberId, marriageId),
    onSuccess: async () => {
      message.success('婚姻关系已删除');
      await queryClient.invalidateQueries({ queryKey: ['member', memberId] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '删除婚姻关系失败');
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadMemberPhoto(memberId, file),
    onSuccess: async () => {
      message.success('头像上传成功');
      await queryClient.invalidateQueries({ queryKey: ['member', memberId] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '头像上传失败');
    },
  });

  return (
    <AuthGuard>
      <div className="page-stack">
        <Card className="soft-panel">
          <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space align="start" size={16}>
              <Button icon={<ArrowLeftOutlined />}>
                <Link href="/members">返回成员列表</Link>
              </Button>
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
                  <Title level={3} style={{ marginBottom: 8 }}>
                    {member?.name}
                  </Title>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    {member?.gender === 'MALE' ? '男' : member?.gender === 'FEMALE' ? '女' : '未知'}{' '}
                    · {member?.generationName ? `字辈 ${member.generationName} · ` : ''}
                    {member?.nativePlace ?? '籍贯待补充'}
                  </Paragraph>
                </div>
              </Space>
            </Space>
            {isAdmin ? (
              <Space>
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
                <Button
                  icon={<UploadOutlined />}
                  loading={uploadMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  上传头像
                </Button>
                <Button type="primary" icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
                  编辑档案
                </Button>
              </Space>
            ) : null}
          </Space>
        </Card>

        <Card loading={memberQuery.isLoading} className="soft-panel" title="基础信息">
          {member ? (
            <Descriptions column={{ xs: 1, md: 2, xl: 3 }}>
              <Descriptions.Item label="出生日期">{formatDate(member.birthDate)}</Descriptions.Item>
              <Descriptions.Item label="去世日期">{formatDate(member.deathDate)}</Descriptions.Item>
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
              <Descriptions.Item label="备注" span={3}>
                {member.notes ?? '暂无备注'}
              </Descriptions.Item>
            </Descriptions>
          ) : null}
        </Card>

        <Card className="soft-panel" title="直系与同辈关系">
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
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
                        {item.gender === 'MALE' ? '男' : item.gender === 'FEMALE' ? '女' : '未知'}
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
                        {item.gender === 'MALE' ? '男' : item.gender === 'FEMALE' ? '女' : '未知'}
                      </Tag>
                      <Text type="secondary">
                        {item.birthOrder ? `排行 ${item.birthOrder}` : formatDate(item.birthDate)}
                      </Text>
                    </Space>
                  </List.Item>
                )}
              />
            </div>
          </Space>
        </Card>

        <Card
          className="soft-panel"
          title="婚姻关系"
          extra={
            isAdmin ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setMarriageOpen(true)}>
                新增婚姻关系
              </Button>
            ) : null
          }
        >
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
                  isAdmin ? (
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
                        编辑
                      </Button>
                      <Popconfirm
                        title="确定删除这条婚姻关系吗？"
                        onConfirm={() => removeMarriageMutation.mutate(record.id)}
                      >
                        <Button size="small" danger>
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  ) : (
                    '-'
                  ),
              },
            ]}
          />
        </Card>

        <MemberFormModal
          open={editOpen}
          title={`编辑成员：${member?.name ?? ''}`}
          initialValue={member}
          loading={saveMemberMutation.isPending}
          onCancel={() => setEditOpen(false)}
          onSubmit={async (values) => {
            await saveMemberMutation.mutateAsync(values);
          }}
        />

        <MarriageFormModal
          open={marriageOpen}
          title={editingMarriage ? `编辑婚姻关系：${editingMarriage.spouseName}` : '新增婚姻关系'}
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
      </div>
    </AuthGuard>
  );
}
