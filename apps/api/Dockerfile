# --- 基础阶段 ---
FROM node:22-slim AS base
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
RUN pnpm config set registry https://registry.npmmirror.com

# --- 依赖与构建阶段 ---
FROM base AS builder

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY apps/api/package.json ./apps/api/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @fisrtname/api prisma generate
RUN pnpm --filter @fisrtname/api build

# --- 生产依赖阶段 ---
FROM base AS prod-deps

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY apps/api/package.json ./apps/api/

RUN pnpm config set onlyBuiltDependencies "@prisma/client @prisma/engines prisma"
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod --no-optional

# --- 运行阶段 ---
FROM base AS runner
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/package.json ./package.json
COPY --from=prod-deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma /tmp/prisma-client/.prisma
RUN set -eux; prisma_client_dir="$(dirname "$(node -e 'console.log(require.resolve("@prisma/client", { paths: ["/app/apps/api"] }))')")"; mkdir -p "$prisma_client_dir/node_modules"; cp -R /tmp/prisma-client/.prisma "$prisma_client_dir/node_modules/.prisma"; rm -rf /tmp/prisma-client

EXPOSE 3001

CMD ["pnpm", "--filter", "@fisrtname/api", "start:prod"]
