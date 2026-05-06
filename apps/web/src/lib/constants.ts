import {
  ApartmentOutlined,
  AuditOutlined,
  BookOutlined,
  DashboardOutlined,
  GlobalOutlined,
  NodeIndexOutlined,
  ProfileOutlined,
  SettingOutlined,
  SnippetsOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';

export const appMenus = [
  { key: '/dashboard', icon: DashboardOutlined, label: '首页统计' },
  { key: '/members', icon: TeamOutlined, label: '成员管理' },
  { key: '/assets', icon: BookOutlined, label: '家族资料' },
  { key: '/graph', icon: NodeIndexOutlined, label: '关系图谱' },
  { key: '/kinship', icon: ApartmentOutlined, label: '称呼计算' },
  { key: '/supplement-requests', icon: SnippetsOutlined, label: '资料补充' },
  { key: '/changelog', icon: ProfileOutlined, label: '版本更新日志' },
  { key: '/platform', icon: GlobalOutlined, label: '平台管理', superOnly: true },
  { key: '/users', icon: UserOutlined, label: '用户权限', adminOnly: true },
  { key: '/audit-logs', icon: AuditOutlined, label: '操作日志', adminOnly: true },
  { key: '/settings', icon: SettingOutlined, label: '系统设置', adminOnly: true },
];

type PageMeta = {
  title: string;
  parentTitle?: string;
  sectionKey?: string;
};

const dashboardRouteMeta: Array<{ test: RegExp; meta: PageMeta }> = [
  { test: /^\/dashboard$/, meta: { title: '首页统计' } },
  { test: /^\/members$/, meta: { title: '成员管理' } },
  { test: /^\/members\/[^/]+$/, meta: { title: '成员详情', parentTitle: '成员管理' } },
  { test: /^\/assets$/, meta: { title: '家族资料', parentTitle: '成员管理' } },
  { test: /^\/graph$/, meta: { title: '关系图谱', parentTitle: '成员管理' } },
  { test: /^\/kinship$/, meta: { title: '称呼计算', parentTitle: '成员管理' } },
  { test: /^\/supplement-requests$/, meta: { title: '资料补充' } },
  { test: /^\/changelog$/, meta: { title: '版本更新日志' } },
  { test: /^\/platform$/, meta: { title: '平台管理' } },
  { test: /^\/users$/, meta: { title: '用户权限', parentTitle: '系统设置' } },
  { test: /^\/audit-logs$/, meta: { title: '操作日志', parentTitle: '系统设置' } },
  { test: /^\/settings$/, meta: { title: '系统设置' } },
  { test: /^\/login$/, meta: { title: '登录' } },
];

export function resolvePageMeta(pathname: string): PageMeta {
  const matched = dashboardRouteMeta.find((item) => item.test.test(pathname));
  return matched?.meta ?? { title: '家族姓氏系统' };
}

export const kinshipTokenOptions = [
  { label: '爸爸', value: 'F' },
  { label: '妈妈', value: 'M' },
  { label: '哥哥', value: 'OB' },
  { label: '弟弟', value: 'LB' },
  { label: '姐姐', value: 'OS' },
  { label: '妹妹', value: 'LS' },
  { label: '儿子', value: 'S' },
  { label: '女儿', value: 'D' },
  { label: '丈夫', value: 'H' },
  { label: '妻子', value: 'W' },
];
