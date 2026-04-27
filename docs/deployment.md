# 部署说明

## 1. 使用 Docker Compose 启动

```bash
docker compose up -d --build
```

启动后容器包含：

- `postgres`：PostgreSQL 数据库
- `api`：NestJS 后端
- `web`：Next.js 前端
- `nginx`：统一入口与反向代理

默认访问地址：

- 统一入口：`http://localhost`
- API 文档：`http://localhost/api/docs`

## 2. 初始化数据库

首次部署后，在 API 容器内执行：

```bash
docker compose exec api pnpm --filter @fisrtname/api prisma migrate deploy
docker compose exec api pnpm --filter @fisrtname/api prisma db seed
```

## 3. 数据与文件持久化

- 数据库卷：`postgres_data`
- 头像目录：宿主机 `./uploads` 挂载到容器 `/app/uploads`

这意味着：

- 容器重启不会丢失数据库数据
- 成员头像文件会保留在宿主机磁盘

## 4. 备份建议

### 数据库备份

```bash
docker compose exec postgres pg_dump -U postgres -d fisrtname > backup.sql
```

### 头像目录备份

直接打包宿主机 `uploads` 目录：

```bash
tar -czf uploads-backup.tar.gz uploads
```

## 5. 恢复建议

### 恢复数据库

```bash
cat backup.sql | docker compose exec -T postgres psql -U postgres -d fisrtname
```

### 恢复头像目录

将备份解压回宿主机项目根目录下的 `uploads`。

## 6. 生产环境建议

- 必须修改 `JWT_SECRET`
- 建议将 PostgreSQL 密码与密钥改为强随机值
- 建议把 `uploads` 挂载到专用数据盘
- 建议开启 HTTPS，并在 Nginx 层补充证书配置
- 如需独立域名，可把 `NEXT_PUBLIC_API_URL` 改成实际公网域名的 `/api`
