'use client';

import {
  LockOutlined,
  LogoutOutlined,
  MenuOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  App,
  Avatar,
  Button,
  Drawer,
  Dropdown,
  Form,
  Input,
  Layout,
  Menu,
  Modal,
  Select,
  Space,
  Spin,
  Typography,
} from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useViewportMode } from '@/hooks/use-viewport-mode';
import { api, ApiError } from '@/lib/api';
import { appMenus, resolvePageMeta } from '@/lib/constants';
import { useAuth } from './auth-provider';

const { Header, Content, Sider } = Layout;
const { Text, Title } = Typography;
const APP_SIDER_EXPANDED_WIDTH = 200;
const APP_SIDER_COLLAPSED_WIDTH = 72;

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changePasswordSaving, setChangePasswordSaving] = useState(false);
  const [passwordForm] = Form.useForm();
  const { initialized, token, user, isAdmin, isSuper, logout, switchFamily } = useAuth();
  const { message } = App.useApp();
  const { isMobile } = useViewportMode();
  const pageMeta = useMemo(() => resolvePageMeta(pathname), [pathname]);
  const resolvedIsAdmin = mounted ? isAdmin : false;
  const resolvedIsSuper = mounted ? isSuper : false;
  const resolvedUser = mounted ? user : null;
  const redirectTarget = useMemo(() => {
    const query = typeof window !== 'undefined' ? window.location.search : '';
    return `${pathname}${query}`;
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && initialized && !token) {
      router.replace(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
    }
  }, [initialized, mounted, redirectTarget, router, token]);

  useEffect(() => {
    if (
      mounted &&
      initialized &&
      token &&
      resolvedIsSuper &&
      !resolvedUser?.activeFamilyId &&
      pathname !== '/platform'
    ) {
      router.replace('/platform');
    }
  }, [
    initialized,
    mounted,
    pathname,
    resolvedIsSuper,
    resolvedUser?.activeFamilyId,
    router,
    token,
  ]);

  const menuItems = useMemo(
    () =>
      appMenus
        .filter((item) => {
          if (resolvedIsSuper && !resolvedUser?.activeFamilyId) {
            return item.superOnly;
          }

          return (!item.adminOnly || resolvedIsAdmin) && (!item.superOnly || resolvedIsSuper);
        })
        .map((item) => ({
          key: item.key,
          icon: <item.icon />,
          label: item.label,
        })),
    [resolvedIsAdmin, resolvedIsSuper, resolvedUser?.activeFamilyId],
  );

  const selectedKey = useMemo(() => {
    return menuItems.find((item) => pathname.startsWith(item.key))?.key ?? '/dashboard';
  }, [menuItems, pathname]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const layoutStyle = useMemo(
    () =>
      ({
        '--app-sider-width': `${isMobile ? 0 : collapsed ? APP_SIDER_COLLAPSED_WIDTH : APP_SIDER_EXPANDED_WIDTH}px`,
      }) as CSSProperties,
    [collapsed, isMobile],
  );

  const navigationMenu = (
    <Menu
      mode="inline"
      selectedKeys={[selectedKey]}
      items={menuItems}
      onClick={({ key }) => router.push(key)}
    />
  );

  if (!mounted || !initialized || !token) {
    return (
      <div className="page-center">
        <Spin size="large" />
      </div>
    );
  }

  if (resolvedIsSuper && !resolvedUser?.activeFamilyId && pathname !== '/platform') {
    return (
      <div className="page-center">
        <Spin size="large" />
      </div>
    );
  }

  const handleChangePassword = async (values: {
    currentPassword: string;
    newPassword: string;
  }) => {
    setChangePasswordSaving(true);
    try {
      await api.changePassword(values);
      message.success('密码已修改，请重新登录');
      setChangePasswordOpen(false);
      passwordForm.resetFields();
      await logout();
      router.replace('/login');
    } catch (error) {
      message.error(error instanceof ApiError ? error.message : '修改密码失败');
    } finally {
      setChangePasswordSaving(false);
    }
  };

  return (
    <Layout className="app-layout" style={layoutStyle}>
      {!isMobile ? (
        <Sider
          breakpoint="lg"
          width={APP_SIDER_EXPANDED_WIDTH}
          collapsedWidth={APP_SIDER_COLLAPSED_WIDTH}
          collapsible
          collapsed={collapsed}
          onBreakpoint={(broken) => setCollapsed(broken)}
          trigger={null}
          theme="light"
          className="app-sider"
        >
          <div className="app-brand">
            {collapsed ? (
              <Title level={4} className="brand-title">
                谱
              </Title>
            ) : (
              <div className="brand-main">
                <div className="brand-stamp" aria-hidden="true">
                  家族
                  <br />
                  谱牒
                </div>
                <Title level={4} className="brand-title">
                  家族血亲管理
                </Title>
              </div>
            )}
          </div>
          {navigationMenu}
        </Sider>
      ) : null}
      <Layout className={`app-main-layout${isMobile ? ' app-main-layout-mobile' : ''}`}>
        <Header className="app-header">
          <div className="header-main">
            <Button
              type="text"
              icon={
                isMobile ? (
                  <MenuOutlined />
                ) : collapsed ? (
                  <MenuUnfoldOutlined />
                ) : (
                  <MenuFoldOutlined />
                )
              }
              onClick={() => (isMobile ? setDrawerOpen(true) : setCollapsed((current) => !current))}
            />
            <div className="header-title-block">
              <div className="header-breadcrumb">
                {pageMeta.parentTitle ? (
                  <>
                    <span>{pageMeta.parentTitle}</span>
                    <span>/</span>
                  </>
                ) : null}
                <span>{pageMeta.title}</span>
              </div>
            </div>
          </div>
          {resolvedUser?.families?.length ? (
            <Select
              className="family-switcher"
              size="middle"
              value={resolvedUser.activeFamilyId ?? undefined}
              options={resolvedUser.families.map((family) => ({
                value: family.id,
                label: `${family.name}${family.role === 'ADMIN' ? ' · 管理员' : ''}`,
              }))}
              onChange={async (familyId) => {
                try {
                  await switchFamily(familyId);
                  message.success('已切换家族');
                  router.refresh();
                } catch {
                  message.error('切换家族失败，请稍后重试');
                }
              }}
            />
          ) : null}
          <Dropdown
            menu={{
              items: [
                {
                  key: 'change-password',
                  icon: <LockOutlined />,
                  label: '修改密码',
                  onClick: () => {
                    passwordForm.resetFields();
                    setChangePasswordOpen(true);
                  },
                },
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                  onClick: async () => {
                    await logout();
                    router.replace('/login');
                  },
                },
              ],
            }}
          >
            <Space className="header-user">
              <Avatar icon={<UserOutlined />} />
              <div className="header-user-meta">
                <div className="header-username">{resolvedUser?.username}</div>
                <Text type="secondary" className="header-user-role">
                  {resolvedUser?.platformRole === 'SUPER'
                    ? '超级管理员'
                    : resolvedIsAdmin
                      ? '管理员'
                      : '普通查看用户'}
                </Text>
              </div>
            </Space>
          </Dropdown>
        </Header>
        <Content className="app-content">{children}</Content>
      </Layout>
      <Modal
        open={changePasswordOpen}
        title="修改密码"
        confirmLoading={changePasswordSaving}
        onCancel={() => {
          setChangePasswordOpen(false);
          passwordForm.resetFields();
        }}
        onOk={() => passwordForm.submit()}
        forceRender
        destroyOnHidden
      >
        <Form form={passwordForm} layout="vertical" onFinish={handleChangePassword}>
          <Form.Item
            label="当前密码"
            name="currentPassword"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '新密码至少 8 位' },
              { max: 50, message: '新密码最多 50 位' },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }

                  return Promise.reject(new Error('两次输入的新密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
      <Drawer
        placement="left"
        title="家族血亲管理"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={280}
        className="app-nav-drawer"
      >
        <div className="app-brand app-brand-drawer">
          <div className="brand-main">
            <div className="brand-stamp" aria-hidden="true">
              家族
              <br />
              谱牒
            </div>
            <Title level={4} className="brand-title">
              家族血亲管理
            </Title>
          </div>
        </div>
        {navigationMenu}
      </Drawer>
    </Layout>
  );
}
