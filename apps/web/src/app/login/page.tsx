'use client';

import {
  ApartmentOutlined,
  BarChartOutlined,
  InfoCircleFilled,
  LockOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { App, Button, Checkbox, Form, Input, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { api, ApiError } from '@/lib/api';
import type { AuthUser } from '@/lib/types';

const { Paragraph, Text } = Typography;

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
      <div className="login-bg-scene" aria-hidden="true">
        <span className="login-mountain login-mountain-left" />
        <span className="login-mountain login-mountain-right" />
        <span className="login-pavilion login-pavilion-left" />
        <span className="login-pavilion login-pavilion-right" />
        <span className="login-birds login-birds-one">⌁ ⌁ ⌁</span>
        <span className="login-birds login-birds-two">⌁ ⌁</span>
      </div>

      <div className="login-card">
        <section className="login-hero">
          <div className="login-hero-seal" aria-hidden="true" />
          <div className="login-hero-script" aria-hidden="true">
            <span>族谱</span>
            <span>血亲</span>
            <span>宗支</span>
            <span>世系</span>
          </div>

          <div className="login-hero-copy">
            <span className="family-badge">家族谱系 · 血脉图谱 · 称呼计算</span>
            <h1 className="login-title">
              <span className="login-title-line">中国家族姓氏</span>
              <span className="login-title-line">血亲管理系统</span>
            </h1>
            <Paragraph className="login-hero-desc">
              <span className="login-hero-quote">「忠厚传家久，诗书继世长」</span>
              <span className="login-hero-text">
                家族是一个人的根，家谱是家族的魂。在这里，我们用科技守护每一个姓氏的尊严，让飘散在历史长河中的血脉重新汇聚。围绕成员档案、父母与配偶关系维护，构建可查询、可统计、可视化的家族关系网络。
              </span>
            </Paragraph>
          </div>

          <div className="login-feature-list">
            <article className="login-feature-card">
              <span className="login-feature-icon">
                <BarChartOutlined />
              </span>
              <div>
                <Text className="login-feature-title">首页统计</Text>
                <Paragraph className="login-feature-desc">
                  成员总数、男女分布、代际数量、最新新增和最近变更一目了然。
                </Paragraph>
              </div>
            </article>
            <article className="login-feature-card">
              <span className="login-feature-icon">
                <ApartmentOutlined />
              </span>
              <div>
                <Text className="login-feature-title">图谱切换</Text>
                <Paragraph className="login-feature-desc">
                  点击节点自动切换中心人物，动态展示父母、配偶、子女与兄弟姐妹。
                </Paragraph>
              </div>
            </article>
          </div>

          <div className="login-book" aria-hidden="true" />
        </section>

        <section className="login-form-panel">
          <span className="login-cloud-art" aria-hidden="true" />
          <div className="login-form-frame">
            <div className="login-corner login-corner-tl" aria-hidden="true" />
            <div className="login-corner login-corner-tr" aria-hidden="true" />
            <div className="login-corner login-corner-bl" aria-hidden="true" />
            <div className="login-corner login-corner-br" aria-hidden="true" />

            <div className="login-form-heading">
              <h2>欢迎登录</h2>
              <span className="login-heading-rule" aria-hidden="true" />
              <Text className="login-form-subtitle">
                支持手机号或用户名登录；同一账号可在多个家族之间切换。
              </Text>
            </div>

            <div className="login-demo-box">
              <InfoCircleFilled className="login-demo-icon" />
              <div>
                <Text className="login-demo-title">演示账号</Text>
                <p>管理员：admin / admin123456</p>
                <p>查看用户：viewer / viewer123456</p>
              </div>
            </div>

            <Form
              className="login-form"
              layout="vertical"
              initialValues={{ username: 'admin', password: 'admin123456', remember: false }}
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
              <Form.Item
                label="密码"
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password prefix={<LockOutlined />} size="large" placeholder="请输入密码" />
              </Form.Item>
              <div className="login-form-options">
                <Form.Item name="remember" valuePropName="checked" noStyle>
                  <Checkbox>记住我</Checkbox>
                </Form.Item>
                <button type="button" className="login-forgot-button">
                  忘记密码？
                </button>
              </div>
              <div className="login-btn-knot-wrap">
                <span className="login-btn-knot login-btn-knot-tl" aria-hidden="true" />
                <span className="login-btn-knot login-btn-knot-tr" aria-hidden="true" />
                <span className="login-btn-knot login-btn-knot-bl" aria-hidden="true" />
                <span className="login-btn-knot login-btn-knot-br" aria-hidden="true" />
                <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
                  登录系统
                </Button>
              </div>
            </Form>

            <div className="login-form-footer">
              <span />
              <Text>传承家族文化 · 连接血脉亲情</Text>
              <span />
            </div>
            <div className="login-stamp" aria-hidden="true">
              家族
              <br />
              谱牒
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
