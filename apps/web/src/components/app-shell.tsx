'use client';

import {
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Dropdown, Layout, Menu, Space, Typography } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { appMenus } from '@/lib/constants';
import { useAuth } from './auth-provider';

const { Header, Content, Sider } = Layout;
const { Text, Title } = Typography;

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user, isAdmin, logout } = useAuth();

  const menuItems = useMemo(
    () =>
      appMenus
        .filter((item) => !item.adminOnly || isAdmin)
        .map((item) => ({
          key: item.key,
          icon: <item.icon />,
          label: item.label,
        })),
    [isAdmin],
  );

  const selectedKey = useMemo(() => {
    return menuItems.find((item) => pathname.startsWith(item.key))?.key ?? '/dashboard';
  }, [menuItems, pathname]);

  return (
    <Layout className="app-layout">
      <Sider
        breakpoint="lg"
        collapsedWidth={72}
        collapsible
        collapsed={collapsed}
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
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => router.push(key)}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <div className="header-main">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((current) => !current)}
            />
            <div className="header-title-block">
              <Text strong className="header-title">
                中国家族姓氏血亲管理系统
              </Text>
              <div className="header-subtitle">成员档案、关系图谱、称呼计算一体化后台</div>
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
                <div className="header-username">{user?.username}</div>
                <Text type="secondary" className="header-user-role">
                  {isAdmin ? '管理员' : '普通查看用户'}
                </Text>
              </div>
            </Space>
          </Dropdown>
        </Header>
        <Content className="app-content">{children}</Content>
      </Layout>
    </Layout>
  );
}
