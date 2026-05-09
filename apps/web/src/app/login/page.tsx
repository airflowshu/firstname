'use client';

import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, App, Button, Checkbox, Form, Input, Space, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { api, ApiError } from '@/lib/api';
import type { AuthUser } from '@/lib/types';

const { Paragraph, Text, Title } = Typography;

function resolveLoginRedirect(user: AuthUser | null, fallback: string) {
  if (user?.platformRole === 'SUPER' && !user.activeFamilyId) {
    return '/platform';
  }

  return fallback;
}

export default function LoginPage() {
  const router = useRouter();
  const { token, user, login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [redirectPath, setRedirectPath] = useState('/dashboard');
  const { message } = App.useApp();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const nextRedirect = params.get('redirect');

    if (nextRedirect?.startsWith('/')) {
      setRedirectPath(nextRedirect);
    }
  }, []);

  useEffect(() => {
    if (token) {
      router.replace(resolveLoginRedirect(user, redirectPath));
    }
  }, [redirectPath, router, token, user]);

  return (
    <div className="login-page">
      <div className="login-bg-scenery" aria-hidden />
      <div className="login-card">
        <section className="login-hero">
          <div>
            <span className="family-badge">家族谱系 · 血脉图谱 · 称呼计算</span>
            <Title level={1} className="login-hero-title">
              中国家族姓氏
              <br />
              血亲管理系统
            </Title>
            <Paragraph className="login-hero-desc">
              围绕成员档案、父母与配偶关系维护，构建可查询、可统计、可视化的家族关系网络。
            </Paragraph>
          </div>
          <Space direction="vertical" size={14} className="login-feature-list">
            <div className="login-feature-card">
              <div className="login-feature-icon">◉</div>
              <div>
                <Text className="login-feature-title">首页统计</Text>
                <Paragraph className="login-feature-desc">成员总数、男女分布、代际数量、最新新增和最近变更一目了然。</Paragraph>
              </div>
            </div>
            <div className="login-feature-card">
              <div className="login-feature-icon">◎</div>
              <div>
                <Text className="login-feature-title">图谱切换</Text>
                <Paragraph className="login-feature-desc">点击节点自动切换中心人物，动态展示父母、配偶、子女与兄弟姐妹。</Paragraph>
              </div>
            </div>
          </Space>
        </section>

        <section className="login-form-panel">
          <Space direction="vertical" size={18} style={{ width: '100%' }}>
            <div className="login-form-header">
              <Title level={2}>欢迎登录</Title>
              <Text type="secondary">支持手机号或用户名登录；同一账号可在多个家族之间切换。</Text>
            </div>

            <Alert
              type="info"
              showIcon
              className="login-demo-alert"
              message="演示账号"
              description="管理员：admin / admin123456　查看用户：viewer / viewer123456"
            />

            <Form
              layout="vertical"
              initialValues={{ username: 'admin', password: 'admin123456', remember: true }}
              onFinish={async (values) => {
                try {
                  setSubmitting(true);
                  const result = await api.login(values);
                  login(result.accessToken, result.user);
                  message.success('登录成功，正在进入系统');
                  router.replace(resolveLoginRedirect(result.user, redirectPath));
                } catch (error) {
                  message.error(error instanceof ApiError ? error.message : '登录失败，请稍后重试');
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              <Form.Item
                label="用户名或手机号"
                name="username"
                rules={[{ required: true, message: '请输入用户名或手机号' }]}
              >
                <Input prefix={<UserOutlined />} size="large" placeholder="请输入用户名或手机号" />
              </Form.Item>
              <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}>
                <Input.Password prefix={<LockOutlined />} size="large" placeholder="请输入密码" />
              </Form.Item>
              <div className="login-options-row">
                <Form.Item name="remember" valuePropName="checked" noStyle>
                  <Checkbox>记住我</Checkbox>
                </Form.Item>
                <a href="#" onClick={(e) => e.preventDefault()}>
                  忘记密码？
                </a>
              </div>
              <Button type="primary" htmlType="submit" size="large" block loading={submitting} className="login-submit-btn">
                登录系统
              </Button>
            </Form>
            <div className="login-form-footer">传承家族文化 · 连接血脉亲情</div>
          </Space>
        </section>
      </div>
    </div>
  );
}
