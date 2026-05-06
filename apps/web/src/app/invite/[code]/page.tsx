'use client';

import { LockOutlined, PhoneOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Card, Form, Input, Result, Spin, Typography } from 'antd';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

const { Paragraph, Text, Title } = Typography;

export default function InvitePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const code = params.code;
  const [submitting, setSubmitting] = useState(false);

  const inviteQuery = useQuery({
    queryKey: ['invitation', code],
    queryFn: () => api.inspectInvitation(code),
    enabled: Boolean(code),
  });

  const invitation = inviteQuery.data;

  return (
    <div className="invite-page">
      <Card className="invite-card">
        {inviteQuery.isLoading ? (
          <div className="page-center">
            <Spin size="large" />
          </div>
        ) : inviteQuery.isError || !invitation ? (
          <Result
            status="404"
            title="邀请链接不存在"
            subTitle="请确认链接是否完整，或联系邀请人重新发送。"
          />
        ) : !invitation.available ? (
          <Result status="warning" title="邀请链接不可用" subTitle="该链接可能已过期或已被使用。" />
        ) : (
          <>
            <div className="invite-header">
              <Text type="secondary">
                {invitation.type === 'FAMILY_ADMIN' ? '创建新的家族系统' : '加入家族'}
              </Text>
              <Title level={2}>
                {invitation.type === 'FAMILY_ADMIN'
                  ? '接受超级管理员邀请'
                  : `加入${invitation.family?.name ?? '当前家族'}`}
              </Title>
              <Paragraph>
                请使用手机号作为平台唯一身份，并设置一个可登录的用户名。若手机号已注册，输入原密码即可加入。
              </Paragraph>
            </div>

            <Alert
              type="info"
              showIcon
              message={`链接有效期至 ${new Date(invitation.expiresAt).toLocaleString()}`}
            />

            <Form
              layout="vertical"
              className="invite-form"
              onFinish={async (values) => {
                try {
                  setSubmitting(true);
                  await api.acceptInvitation(code, values);
                  message.success('邀请已接受，请登录进入系统');
                  router.replace(`/login?redirect=${encodeURIComponent('/dashboard')}`);
                } catch (error) {
                  message.error(
                    error instanceof ApiError ? error.message : '接受邀请失败，请稍后重试',
                  );
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {invitation.type === 'FAMILY_ADMIN' ? (
                <Form.Item
                  label="家族名称"
                  name="familyName"
                  rules={[{ required: true, message: '请输入家族名称' }]}
                >
                  <Input prefix={<TeamOutlined />} size="large" placeholder="例如：王氏家族" />
                </Form.Item>
              ) : null}

              <Form.Item
                label="手机号"
                name="phone"
                rules={[{ required: true, message: '请输入手机号' }]}
              >
                <Input prefix={<PhoneOutlined />} size="large" placeholder="请输入手机号" />
              </Form.Item>
              <Form.Item
                label="用户名"
                name="username"
                rules={[
                  { required: true, message: '请输入用户名' },
                  { min: 2, message: '用户名至少 2 位' },
                  { max: 50, message: '用户名最多 50 位' },
                ]}
              >
                <Input prefix={<UserOutlined />} size="large" placeholder="用于登录，例如 wangts_admin" />
              </Form.Item>
              <Form.Item label="姓名/昵称" name="displayName">
                <Input prefix={<UserOutlined />} size="large" placeholder="可选，默认使用用户名" />
              </Form.Item>
              <Form.Item
                label="密码"
                name="password"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 8, message: '密码至少 8 位' },
                ]}
              >
                <Input.Password prefix={<LockOutlined />} size="large" placeholder="请输入密码" />
              </Form.Item>
              <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
                接受邀请
              </Button>
            </Form>
          </>
        )}
      </Card>
    </div>
  );
}
