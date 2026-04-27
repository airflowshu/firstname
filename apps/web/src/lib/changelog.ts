import type { ChangelogEntry } from './types';

export const changelogEntries: ChangelogEntry[] = [
  {
    id: 'v1.0.0',
    version: 'v1.0.0',
    releaseDate: '2026-04-01',
    summary: '家族血亲管理系统功能基线完成，核心业务与管理能力已全链路可用。',
    changes: [
      {
        type: 'feat',
        content:
          '成员管理全流程可用：支持成员档案增删改查、成员详情维护、父母关系与婚姻关系管理、成员头像上传及成员数据导出。',
      },
      {
        type: 'feat',
        content:
          '关系图谱能力可用：支持以成员为中心的关系可视化浏览、节点点击切换中心人物、关系称呼标签展示，以及已故成员节点置灰展示。',
      },
      {
        type: 'feat',
        content:
          '称呼计算能力可用：支持成员互算与路径推算两种模式，输出标准称呼、家族称呼别名、关系链路与关系编码。',
      },
      {
        type: 'feat',
        content:
          '权限与审计体系可用：支持登录鉴权、管理员/查看用户分级访问、用户权限管理以及关键操作审计日志查询。',
      },
      {
        type: 'feat',
        content:
          '运营与展示页面可用：已完成首页统计、系统设置（称呼别名映射）、版本更新日志时间线等页面能力。',
      },
    ],
  },
];
