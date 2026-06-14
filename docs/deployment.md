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

- 统一入口：`http://<NAS_IP>:${NGINX_PORT:-18080}`
- API 文档：`http://<NAS_IP>:${NGINX_PORT:-18080}/api/docs`

> `postgres`/`api`/`web` 不再暴露宿主机端口，仅通过 `nginx` 统一对外。

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
- 建议开启 HTTPS（Lucky 反代层申请证书）
- `NEXT_PUBLIC_API_URL` 默认使用 `/api`，可直接配合 Nginx/Lucky 反向代理

## 7. 飞牛 NAS + Lucky 反代

### 7.1 环境变量（示例）

在项目根目录创建 `.env`（或由飞牛 NAS Compose 面板注入）：

```bash
POSTGRES_PASSWORD=请改成强密码
JWT_SECRET=请改成强随机字符串
NODE_ENV=production
NGINX_PORT=18080
NEXT_PUBLIC_API_URL=/api
CORS_ORIGIN=https://你的域名
```

### 7.2 启动与初始化

```bash
docker compose up -d --build
docker compose exec api pnpm --filter @fisrtname/api prisma migrate deploy
docker compose exec api pnpm --filter @fisrtname/api prisma db seed
```

### 7.3 Lucky 反向代理配置

- 前端域名：`app.example.com`
- 目标地址：`http://<NAS_IP>:18080`
- 开启 WebSocket 转发
- 开启 HTTPS，并在 Lucky 中签发/绑定证书

### 7.4 路由建议

- Lucky 在入口层只需代理到 Nginx
- 业务路由由容器内 `deploy/nginx.conf` 处理：
  - `/` -> `web:3000`
  - `/api/` -> `api:3001`
  - `/uploads/` -> `api:3001/uploads/`

## 8. 低配 NAS 离线镜像部署（推荐）

`docker-compose.yml` 已切换为 `image` 模式，默认镜像：

- `API_IMAGE=fisrtname/api:1.0.0`
- `WEB_IMAGE=fisrtname/web:1.0.0`

### 8.1 在本机构建并导出镜像

```bash
docker build -f apps/api/Dockerfile -t fisrtname/api:1.0.0 .
# 如果docker网络受限，加上代理配置即可    
# docker build -f apps/api/Dockerfile -t fisrtname/api:1.0.0 --build-arg http_proxy=http://192.168.31.106:7897 --build-arg https_proxy=http://192.168.31.106:7897 .
docker build -f apps/web/Dockerfile -t fisrtname/web:1.0.0 --build-arg NEXT_PUBLIC_API_URL=/api .
docker save -o fisrtname-api-1.0.0.tar fisrtname/api:1.0.0
docker save -o fisrtname-web-1.0.0.tar fisrtname/web:1.0.0
```

### 8.2 拷贝到 NAS 并导入

```bash
sudo docker load -i fisrtname-api-1.0.0.tar
sudo docker load -i fisrtname-web-1.0.0.tar
```
 此时docker images -a 中应该能看到对应的镜像

### 8.3 在 NAS 启动（不构建）

```bash
docker compose up -d
```

首次部署仍需执行数据库初始化：

```bash
docker compose exec api pnpm --filter @fisrtname/api prisma migrate deploy
docker compose exec api pnpm --filter @fisrtname/api prisma db seed
```
