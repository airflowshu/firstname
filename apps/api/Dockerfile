FROM node:20-slim

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @fisrtname/api prisma generate
RUN pnpm --filter @fisrtname/api build

EXPOSE 3001

CMD ["pnpm", "--filter", "@fisrtname/api", "start:prod"]
