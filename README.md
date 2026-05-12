# 中国家族血亲管理系统

一个基于 `Next.js + NestJS + PostgreSQL + Prisma` 的家族血亲管理系统，支持成员档案、血缘关系图谱、亲戚称呼计算、账号权限、操作日志与本地磁盘头像上传。

## 技术栈

- 前端：`Next.js 16`、`React 19`、`Ant Design`、`AntV G6`、`React Query`
- 后端：`NestJS 11`、`Prisma`、`JWT`、`Swagger`
- 数据库：`PostgreSQL`
- 部署：`Docker Compose + Nginx`

## 目录结构

- `apps/web`：前端后台界面
- `apps/api`：后端 API、Prisma Schema、种子数据
- `deploy/nginx.conf`：反向代理配置
- `docker-compose.yml`：容器化部署编排

## 本地开发

### 1. 安装依赖

```bash
pnpm install
```

### 2. 准备数据库

推荐本机或 Docker 启动 PostgreSQL，并确保 `DATABASE_URL` 可用。

### 3. 生成 Prisma Client

```bash
pnpm db:generate
```

### 4. 执行迁移 / 初始化

```bash
pnpm --filter @fisrtname/api prisma migrate deploy
pnpm db:seed
```

### 5. 配置env
- 生成`JWT_SECRET `
```node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 6. 启动开发环境

```bash
pnpm dev
```

- 前端默认：`http://localhost:3000`
- 后端默认：`http://localhost:3001`
- Swagger：`http://localhost:3001/docs`

## 演示账号

- 管理员：`admin / admin123456`
- 查看用户：`viewer / viewer123456`

## 核心能力

- 成员档案 CRUD、父母关系绑定、婚姻关系维护
- 首页统计：成员总数、男女分布、在世/已故、代际数量、婚配数量
- 关系图谱：点击节点自动切换中心人物并重新布局
- 亲戚称呼：成员互算 + 路径选择器计算
- 家族别名：标准称呼到家族习惯叫法映射
- 管理员/查看用户双角色权限
- 关键操作日志
- 头像上传到服务器本地磁盘

## 验证命令

```bash
pnpm build
pnpm --filter @fisrtname/api test -- --runInBand
```

## Docker 部署

见 `docs/deployment.md`
