import {
  ApartmentOutlined,
  AuditOutlined,
  DashboardOutlined,
  NodeIndexOutlined,
  ProfileOutlined,
  SettingOutlined,
  SnippetsOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';

export const TOKEN_STORAGE_KEY = 'fisrtname-token';
export const USER_STORAGE_KEY = 'fisrtname-user';

export const appMenus = [
  { key: '/dashboard', icon: DashboardOutlined, label: '首页统计' },
  { key: '/members', icon: TeamOutlined, label: '成员管理' },
  { key: '/graph', icon: NodeIndexOutlined, label: '关系图谱' },
  { key: '/kinship', icon: ApartmentOutlined, label: '称呼计算' },
  { key: '/supplement-requests', icon: SnippetsOutlined, label: '资料补充' },
  { key: '/changelog', icon: ProfileOutlined, label: '版本更新日志' },
  { key: '/users', icon: UserOutlined, label: '用户权限', adminOnly: true },
  { key: '/audit-logs', icon: AuditOutlined, label: '操作日志', adminOnly: true },
  { key: '/settings', icon: SettingOutlined, label: '系统设置', adminOnly: true },
];

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
