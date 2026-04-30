'use client';

import {
  LogoutOutlined,
  MenuOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Drawer, Dropdown, Layout, Menu, Space, Typography } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useViewportMode } from '@/hooks/use-viewport-mode';
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
  const { user, isAdmin, logout } = useAuth();
  const { isMobile } = useViewportMode();
  const pageMeta = useMemo(() => resolvePageMeta(pathname), [pathname]);
  const resolvedIsAdmin = mounted ? isAdmin : false;
  const resolvedUser = mounted ? user : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  const menuItems = useMemo(
    () =>
      appMenus
        .filter((item) => !item.adminOnly || resolvedIsAdmin)
        .map((item) => ({
          key: item.key,
          icon: <item.icon />,
          label: item.label,
        })),
    [resolvedIsAdmin],
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
            <Title level={4} className="brand-title">
              {collapsed ? '谱' : '家族姓氏系统'}
            </Title>
            {!collapsed ? <Text type="secondary">中国家族血亲关系管理</Text> : null}
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
              onClick={() =>
                isMobile ? setDrawerOpen(true) : setCollapsed((current) => !current)
              }
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
          <Dropdown
            menu={{
              items: [
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
                  {resolvedIsAdmin ? '管理员' : '普通查看用户'}
                </Text>
              </div>
            </Space>
          </Dropdown>
        </Header>
        <Content className="app-content">{children}</Content>
      </Layout>
      <Drawer
        placement="left"
        title="家族姓氏系统"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={280}
        className="app-nav-drawer"
      >
        <div className="app-brand app-brand-drawer">
          <Title level={4} className="brand-title">
            家族姓氏系统
          </Title>
          <Text type="secondary">中国家族血亲关系管理</Text>
        </div>
        {navigationMenu}
      </Drawer>
    </Layout>
  );
}
