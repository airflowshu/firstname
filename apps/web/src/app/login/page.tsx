'use client';

import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Form, Input, Space, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { api, ApiError } from '@/lib/api';

const { Paragraph, Text, Title } = Typography;

export default function LoginPage() {
  const router = useRouter();
  const { token, login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const { message } = App.useApp();

  useEffect(() => {
    if (token) {
      router.replace('/dashboard');
    }
  }, [router, token]);

  return (
    <div className="login-page">
      <div className="login-card">
        <section className="login-hero">
          <div>
            <span className="family-badge">家族谱系 · 血缘图谱 · 称呼计算</span>
            <Title level={1} style={{ color: '#fff7ef', marginTop: 24 }}>
              中国家族姓氏血亲管理系统
            </Title>
            <Paragraph style={{ color: 'rgba(255,247,239,0.88)', fontSize: 16 }}>
              围绕成员档案、父母与配偶关系维护，构建可查询、可统计、可视化的家族关系网络。
            </Paragraph>
          </div>
          <Space direction="vertical" size={16}>
            <Card
              variant="borderless"
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff7ef' }}
            >
              <Text style={{ color: '#fff7ef' }}>首页统计</Text>
              <Paragraph style={{ color: 'rgba(255,247,239,0.82)', marginBottom: 0 }}>
                成员总数、男女分布、代际数量、最近新增和最近变更一眼可见。
              </Paragraph>
            </Card>
            <Card
              variant="borderless"
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff7ef' }}
            >
              <Text style={{ color: '#fff7ef' }}>图谱切换</Text>
              <Paragraph style={{ color: 'rgba(255,247,239,0.82)', marginBottom: 0 }}>
                点击节点自动切换中心人物，动态展示父母、配偶、子女与兄弟姐妹。
              </Paragraph>
            </Card>
          </Space>
        </section>

        <section className="login-form-panel">
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <div>
              <Title level={2} style={{ marginBottom: 8 }}>
                欢迎登录
              </Title>
              <Text type="secondary">
                管理员可维护数据；普通角色可浏览统计、成员详情、关系图与称呼计算。
              </Text>
            </div>

            <Alert
              type="info"
              showIcon
              message="演示账号"
              description="管理员：admin / admin123456　　查看用户：viewer / viewer123456"
            />

            <Form
              layout="vertical"
              initialValues={{ username: 'admin', password: 'admin123456' }}
              onFinish={async (values) => {
                try {
                  setSubmitting(true);
                  const result = await api.login(values);
                  login(result.accessToken, result.user);
                  message.success('登录成功，正在进入系统');
                  router.replace('/dashboard');
                } catch (error) {
                  message.error(error instanceof ApiError ? error.message : '登录失败，请稍后重试');
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              <Form.Item
                label="用户名"
                name="username"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input prefix={<UserOutlined />} size="large" placeholder="请输入用户名" />
              </Form.Item>
              <Form.Item
                label="密码"
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password prefix={<LockOutlined />} size="large" placeholder="请输入密码" />
              </Form.Item>
              <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
                登录系统
              </Button>
            </Form>
          </Space>
        </section>
      </div>
    </div>
  );
}
