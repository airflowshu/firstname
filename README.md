# 中国家族血亲管理系统

一个基于 `Next.js + NestJS + PostgreSQL + Prisma` 的家族血亲管理系统，支持成员档案、血缘关系图谱、亲戚称呼计算、账号权限、操作日志、本地磁盘头像上传，以及 `super` 对演示家族的一键重置。
欢迎大家提交ISSUE，本人将在工作之余尽快回复，共同推进，将本开源项目做好做精！喜欢的别忘了star一下，感谢！

<img width="1920" height="945" alt="image" src="https://github.com/user-attachments/assets/2f3abd6d-b882-45ff-9226-a70486fc177b" />
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/2e0a3810-9d5a-4832-b441-0cc620f98efb" />
<img width="1920" height="945" alt="image" src="https://github.com/user-attachments/assets/3afc2003-ac61-47af-bffd-2870e85363ff" />
<img width="1920" height="945" alt="image" src="https://github.com/user-attachments/assets/4ec886a9-16e7-454d-98a3-0207cba5a248" />
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/807c6efc-36a5-4f06-b21a-80a2d5b573c7" />
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/133855df-fb02-4cc9-94db-7a38d59443db" />


## 技术栈

- 前端：`Next.js 16`、`React 19`、`Ant Design`、`AntV G6`、`React Query`
- 后端：`NestJS 11`、`Prisma`、`JWT`、`Swagger`
- 数据库：`PostgreSQL`
- 部署：`Docker Compose + Nginx`

## 目录结构

- `apps/web`：前端后台界面
- `apps/api`：后端 API、Prisma Schema、种子数据
- `apps/api/src/demo-reset`：演示家族重置模板与重置执行逻辑
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

初始化后系统会创建两类内置家族：

- `系统设置模板家族`：类型为 `TEMPLATE`，用于新家族初始化时复制称呼别名、资料标签和来源类型
- `默认演示家族`：类型为 `DEMO`，绑定默认演示模板，可由 `super` 在平台管理页一键重置

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

- 平台超级管理员：`super / ************`
- 管理员：`admin / admin123456`
- 查看用户：`viewer / viewer123456`

说明：

- `admin` 和 `viewer` 默认加入 `默认演示家族`
- `super` 可在“平台管理”页进入任意家族，也可对演示家族执行“重置演示数据”

## 核心能力

- 成员档案 CRUD、父母关系绑定、婚姻关系维护
- 首页统计：成员总数、男女分布、在世/已故、代际数量、婚配数量
- 关系图谱：点击节点自动切换中心人物并重新布局
- 亲戚称呼：成员互算 + 路径选择器计算
- 家族别名：标准称呼到家族习惯叫法映射
- 管理员/查看用户双角色权限
- 平台超级管理员视角的多家族管理
- 演示家族一键重置：仅 `DEMO` 家族显示重置入口，按绑定模板恢复初始数据
- 关键操作日志
- 头像上传到服务器本地磁盘

## 演示家族重置

系统把家族分为三类：

- `STANDARD`：普通真实家族
- `DEMO`：演示家族，可被 `super` 重置
- `TEMPLATE`：模板家族，仅作为新家族初始化的设置来源

当前实现规则：

- 只有 `super` 可以在 [platform/page.tsx](/D:/aiWorkspace/fisrtname/apps/web/src/app/(dashboard)/platform/page.tsx) 对演示家族执行“重置演示数据”
- 只有 `familyType = DEMO` 且配置了 `resetTemplateKey` 的家族会显示重置按钮
- 重置只作用于目标家族，不会清空整库，也不会影响其他真实家族
- 重置会恢复该家族的成员、婚姻、成员事件、称呼别名、资料标签、资料来源、邀请、补充申请以及家族内演示账号关系

相关实现位置：

- Prisma 标识与重置历史：[schema.prisma](/D:/aiWorkspace/fisrtname/apps/api/prisma/schema.prisma)
- 演示模板定义：[default-demo.ts](/D:/aiWorkspace/fisrtname/apps/api/src/demo-reset/templates/default-demo.ts)
- 重置执行逻辑：[demo-reset.service.ts](/D:/aiWorkspace/fisrtname/apps/api/src/demo-reset/demo-reset.service.ts)
- 平台页入口：[platform/page.tsx](/D:/aiWorkspace/fisrtname/apps/web/src/app/(dashboard)/platform/page.tsx)

## 验证命令

```bash
pnpm build
pnpm --filter @fisrtname/api test -- --runInBand
```

## Prisma 本地开发注意事项

如果本地启动 API 时出现下面这类报错：

```text
InvalidDatasourceError: Error validating datasource `db`: the URL must start with the protocol `prisma://` or `prisma+postgres://`
```

通常不是 `.env` 里的 `DATABASE_URL` 写错了，而是本地 Prisma Client 被生成为了 `Data Proxy / Accelerate` 运行模式。  
本项目开发环境应使用**本地 engine** 方式连接 PostgreSQL，不要对当前工作区使用：

```bash
prisma generate --no-engine
```

建议处理方式：

1. 先停止当前项目下正在运行的 `pnpm dev`、`@nestjs/cli --watch` 等 Node 进程
2. 重新生成 Prisma Client：

```bash
pnpm --filter @fisrtname/api prisma generate
```

3. 再重新启动项目：

```bash
pnpm dev
```

补充说明：

- Windows 下如果 `query_engine-windows.dll.node` 被占用，优先关闭当前项目相关的开发进程后再重新生成
- 本项目使用普通 `postgresql://...` 数据库连接，不需要 `prisma://` 或 `prisma+postgres://`

## Docker 部署

见 `docs/deployment.md`


## 开源协议与商业授权说明 (License & Commercial Use)

1. 本项目采用 **AGPL-3.0** 开源协议。这意味着您可以自由地使用、修改和分发本项目的代码。
2. **请商业用户特别注意：** 根据 AGPL-3.0 协议的要求，如果您在任何商业产品、云服务（SaaS）或公司内部系统中使用了本项目（或基于本项目进行了二次开发），**您必须向公众无偿开源您整个产品的完整源代码**。
3. 如果您无法接受将您自己的商业项目彻底开源，请勿将本项目用于商业行为。
4. 如需获得免除开源传染的**商业闭源授权**，请联系作者进行商务洽谈：[shull900627@gmail.com]。

