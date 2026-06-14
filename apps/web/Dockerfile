# ==========================================
# 1. 依赖安装阶段 (Deps Stage)
# ==========================================
FROM node:22-slim AS deps
WORKDIR /app

RUN corepack enable
RUN pnpm config set registry https://registry.npmmirror.com

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY apps/web/package.json ./apps/web/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ==========================================
# 2. 编译构建阶段 (Builder Stage)
# ==========================================
FROM node:22-slim AS builder
WORKDIR /app

RUN corepack enable

ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .

RUN pnpm --filter @fisrtname/web build

# ✨ 针对前端，用重新安装生产依赖的方式来替代 prune，完美避开非 TTY 报错
# ✨ 加上 CI=true，强行允许非 TTY 环境下的模块移除操作
RUN CI=true pnpm install --prod --frozen-lockfile

# ==========================================
# 3. 最终运行阶段 (Runner Stage)
# ==========================================
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public

# 这里的 standalone 同样不需要复杂的 deploy，直接复制编译产物即可
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
